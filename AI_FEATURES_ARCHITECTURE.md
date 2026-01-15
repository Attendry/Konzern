# AI Features Architecture

**Datum:** 14. Januar 2026  
**Autor:** Solution Architect  
**Scope:** Natural Language Chatbot + IC-Abstimmungsassistent  
**LLM:** Google Gemini 3.0 (via Google AI Studio API)

---

## Executive Summary

This document outlines the technical architecture for implementing two AI-powered features:
1. **Natural Language Chatbot** - Query consolidation data using natural language
2. **IC-Abstimmungsassistent** - AI-powered explanation and resolution of IC differences

**Approach:** Simple API-first implementation using Google Gemini 3.0. Enterprise features (Vertex AI, VPC-SC) can be layered on later.

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                               │
│  ┌─────────────────────────┐    ┌─────────────────────────────────────────┐ │
│  │     AI Chat Panel       │    │     IC Reconciliation AI Panel          │ │
│  │  • Chat Input           │    │  • AI Explain Button                    │ │
│  │  • Message History      │    │  • Correction Suggestions               │ │
│  │  • Quick Suggestions    │    │  • One-Click Apply                      │ │
│  └────────────┬────────────┘    └──────────────────┬──────────────────────┘ │
└───────────────┼─────────────────────────────────────┼───────────────────────┘
                │                                     │
                ▼                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            BACKEND (NestJS)                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                           AI Module                                     ││
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  ││
│  │  │ AI Controller   │  │ Chat Service    │  │ IC Analysis Service     │  ││
│  │  │                 │  │                 │  │                         │  ││
│  │  │ POST /ai/chat   │  │ • Parse Query   │  │ • Analyze Difference    │  ││
│  │  │ POST /ai/ic/    │  │ • Build Context │  │ • Find Root Cause       │  ││
│  │  │   explain       │  │ • Format Answer │  │ • Suggest Correction    │  ││
│  │  └────────┬────────┘  └────────┬────────┘  └────────────┬────────────┘  ││
│  │           │                    │                        │               ││
│  │           └────────────────────┴────────────────────────┘               ││
│  │                                │                                        ││
│  │                                ▼                                        ││
│  │           ┌─────────────────────────────────────────────┐               ││
│  │           │            Gemini Service                   │               ││
│  │           │  • Simple API wrapper                       │               ││
│  │           │  • Prompt management                        │               ││
│  │           │  • Response parsing                         │               ││
│  │           └────────────────────┬────────────────────────┘               ││
│  └────────────────────────────────┼─────────────────────────────────────────┘│
└───────────────────────────────────┼──────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │   Google AI Studio API        │
                    │   (Gemini 3.0)                │
                    │   api.google.com/gemini       │
                    └───────────────────────────────┘
```

---

## 2. Backend Structure

### 2.1 New Files to Create

```
backend/src/modules/ai/
├── ai.module.ts              # Module definition
├── ai.controller.ts          # REST endpoints
├── services/
│   ├── gemini.service.ts     # Gemini API wrapper (simple!)
│   ├── chat.service.ts       # Chat logic
│   └── ic-analysis.service.ts # IC difference analysis
├── prompts/
│   └── prompts.ts            # All prompts in one file
└── dto/
    ├── chat.dto.ts           # Chat request/response
    └── ic-analysis.dto.ts    # IC analysis request/response

frontend/src/
├── contexts/
│   └── AIChatContext.tsx     # Global chat state (NEW)
├── components/ai/
│   ├── GlobalAIChat.tsx      # Floating button + panel wrapper (NEW)
│   ├── AIChatPanel.tsx       # Chat panel UI (NEW)
│   └── ICExplanationCard.tsx # IC analysis card (NEW)
├── services/
│   └── aiService.ts          # AI API calls (NEW)
└── App.tsx                   # Add AIChatProvider + GlobalAIChat (MODIFY)
```

### 2.2 Environment Variables

```bash
# .env - That's it! Just one API key needed.

GEMINI_API_KEY=your-gemini-3.0-api-key
GEMINI_MODEL=gemini-3.0-flash  # or gemini-3.0-pro for complex tasks
```

---

## 3. Core Implementation

### 3.1 Gemini Service (Simple Wrapper)

```typescript
// backend/src/modules/ai/services/gemini.service.ts

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

@Injectable()
export class GeminiService implements OnModuleInit {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: this.configService.get('GEMINI_MODEL') || 'gemini-3.0-flash',
    });

    console.log('[Gemini] Initialized with model:', this.model.model);
  }

  /**
   * Simple completion - send prompt, get response
   */
  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    const fullPrompt = systemPrompt 
      ? `${systemPrompt}\n\n---\n\n${prompt}`
      : prompt;

    const result = await this.model.generateContent(fullPrompt);
    return result.response.text();
  }

  /**
   * Chat with history
   */
  async chat(
    messages: { role: 'user' | 'model'; content: string }[],
    systemPrompt?: string,
  ): Promise<string> {
    const chat = this.model.startChat({
      history: messages.slice(0, -1).map(m => ({
        role: m.role,
        parts: [{ text: m.content }],
      })),
      systemInstruction: systemPrompt,
    });

    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(lastMessage.content);
    return result.response.text();
  }

  /**
   * Streaming response
   */
  async *stream(prompt: string, systemPrompt?: string): AsyncGenerator<string> {
    const fullPrompt = systemPrompt 
      ? `${systemPrompt}\n\n---\n\n${prompt}`
      : prompt;

    const result = await this.model.generateContentStream(fullPrompt);
    
    for await (const chunk of result.stream) {
      yield chunk.text();
    }
  }
}
```

### 3.2 Chat Service

```typescript
// backend/src/modules/ai/services/chat.service.ts

import { Injectable } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { CHAT_SYSTEM_PROMPT } from '../prompts/prompts';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

@Injectable()
export class ChatService {
  constructor(
    private gemini: GeminiService,
    private supabase: SupabaseService,
  ) {}

  async processMessage(
    message: string,
    history: ChatMessage[],
    financialStatementId?: string,
  ): Promise<{ response: string; data?: any }> {
    
    // 1. Build context from database if we have a financial statement
    let context = '';
    let data: any = null;

    if (financialStatementId) {
      const contextData = await this.buildContext(financialStatementId, message);
      context = contextData.contextString;
      data = contextData.data;
    }

    // 2. Build system prompt with context
    const systemPrompt = CHAT_SYSTEM_PROMPT.replace('{CONTEXT}', context);

    // 3. Add user message to history
    const messages: ChatMessage[] = [
      ...history,
      { role: 'user', content: message },
    ];

    // 4. Get response from Gemini
    const response = await this.gemini.chat(messages, systemPrompt);

    return { response, data };
  }

  private async buildContext(
    financialStatementId: string,
    message: string,
  ): Promise<{ contextString: string; data: any }> {
    const client = this.supabase.getClient();
    
    // Detect what data the user is asking about
    const lowerMessage = message.toLowerCase();
    let data: any = {};
    let contextParts: string[] = [];

    // Get basic financial statement info
    const { data: fs } = await client
      .from('financial_statements')
      .select('*, companies(*)')
      .eq('id', financialStatementId)
      .single();

    if (fs) {
      contextParts.push(`Geschäftsjahr: ${fs.fiscal_year}`);
      contextParts.push(`Unternehmen: ${fs.companies?.name}`);
      data.financialStatement = fs;
    }

    // If asking about IC/intercompany
    if (lowerMessage.includes('ic') || lowerMessage.includes('intercompany') || 
        lowerMessage.includes('differenz')) {
      const { data: icData } = await client
        .from('ic_reconciliations')
        .select('*, company_a:companies!ic_reconciliations_company_a_id_fkey(name), company_b:companies!ic_reconciliations_company_b_id_fkey(name)')
        .eq('financial_statement_id', financialStatementId);

      if (icData && icData.length > 0) {
        const openDiffs = icData.filter(ic => ic.status === 'open');
        contextParts.push(`IC-Abstimmungen: ${icData.length} gesamt, ${openDiffs.length} offen`);
        contextParts.push(`Offene Differenzsumme: €${openDiffs.reduce((sum, ic) => sum + Math.abs(ic.difference_amount || 0), 0).toFixed(2)}`);
        data.icReconciliations = icData;
      }
    }

    // If asking about goodwill
    if (lowerMessage.includes('goodwill') || lowerMessage.includes('firmenwert') ||
        lowerMessage.includes('geschäftswert')) {
      const { data: entries } = await client
        .from('consolidation_entries')
        .select('*')
        .eq('financial_statement_id', financialStatementId)
        .eq('adjustment_type', 'capital_consolidation');

      if (entries) {
        const goodwillTotal = entries.reduce((sum, e) => sum + (e.amount || 0), 0);
        contextParts.push(`Goodwill (Kapitalkonsolidierung): €${goodwillTotal.toFixed(2)}`);
        data.goodwillEntries = entries;
      }
    }

    // If asking about consolidation status
    if (lowerMessage.includes('status') || lowerMessage.includes('übersicht') ||
        lowerMessage.includes('zusammenfassung')) {
      const { data: entries } = await client
        .from('consolidation_entries')
        .select('adjustment_type, amount')
        .eq('financial_statement_id', financialStatementId);

      if (entries) {
        const byType = entries.reduce((acc, e) => {
          acc[e.adjustment_type] = (acc[e.adjustment_type] || 0) + (e.amount || 0);
          return acc;
        }, {} as Record<string, number>);
        
        contextParts.push('Konsolidierungsbuchungen:');
        Object.entries(byType).forEach(([type, amount]) => {
          contextParts.push(`  - ${type}: €${amount.toFixed(2)}`);
        });
        data.consolidationSummary = byType;
      }
    }

    return {
      contextString: contextParts.join('\n'),
      data,
    };
  }
}
```

### 3.3 IC Analysis Service

```typescript
// backend/src/modules/ai/services/ic-analysis.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { IC_ANALYSIS_PROMPT } from '../prompts/prompts';

export interface ICExplanation {
  reconciliationId: string;
  explanation: string;
  likelyCause: 'timing' | 'fx' | 'rounding' | 'missing_entry' | 'error' | 'unknown';
  confidence: number;
  suggestedAction: string;
  correctionEntry?: {
    debitAccount: string;
    creditAccount: string;
    amount: number;
    description: string;
  };
}

@Injectable()
export class ICAnalysisService {
  constructor(
    private gemini: GeminiService,
    private supabase: SupabaseService,
  ) {}

  async explainDifference(reconciliationId: string): Promise<ICExplanation> {
    const client = this.supabase.getClient();

    // 1. Fetch reconciliation with related data
    const { data: recon, error } = await client
      .from('ic_reconciliations')
      .select(`
        *,
        company_a:companies!ic_reconciliations_company_a_id_fkey(id, name),
        company_b:companies!ic_reconciliations_company_b_id_fkey(id, name),
        account_a:accounts!ic_reconciliations_account_a_id_fkey(account_number, name),
        account_b:accounts!ic_reconciliations_account_b_id_fkey(account_number, name)
      `)
      .eq('id', reconciliationId)
      .single();

    if (error || !recon) {
      throw new NotFoundException(`IC reconciliation ${reconciliationId} not found`);
    }

    // 2. Build context for Gemini
    const context = this.buildICContext(recon);

    // 3. Ask Gemini to analyze
    const prompt = IC_ANALYSIS_PROMPT.replace('{IC_DATA}', context);
    const response = await this.gemini.complete(prompt);

    // 4. Parse Gemini's response
    const analysis = this.parseAnalysisResponse(response, recon);

    // 5. Cache the analysis
    await client
      .from('ic_reconciliations')
      .update({
        ai_analysis: analysis,
        ai_analysis_at: new Date().toISOString(),
      })
      .eq('id', reconciliationId);

    return {
      reconciliationId,
      ...analysis,
    };
  }

  private buildICContext(recon: any): string {
    const diff = Math.abs(recon.difference_amount || 0);
    const isSmall = diff < 100;
    const isMedium = diff >= 100 && diff < 10000;

    return `
IC-Abstimmung Details:
- Unternehmen A: ${recon.company_a?.name} (Konto: ${recon.account_a?.account_number} - ${recon.account_a?.name})
- Unternehmen B: ${recon.company_b?.name} (Konto: ${recon.account_b?.account_number} - ${recon.account_b?.name})
- Betrag Unternehmen A: €${(recon.amount_company_a || 0).toFixed(2)}
- Betrag Unternehmen B: €${(recon.amount_company_b || 0).toFixed(2)}
- Differenz: €${diff.toFixed(2)}
- Status: ${recon.status}
- Differenzgröße: ${isSmall ? 'Klein (<€100)' : isMedium ? 'Mittel (€100-€10.000)' : 'Groß (>€10.000)'}
${recon.explanation ? `- Vorhandene Erklärung: ${recon.explanation}` : ''}
    `.trim();
  }

  private parseAnalysisResponse(response: string, recon: any): Omit<ICExplanation, 'reconciliationId'> {
    // Try to extract structured data from Gemini's response
    const lowerResponse = response.toLowerCase();

    // Determine likely cause
    let likelyCause: ICExplanation['likelyCause'] = 'unknown';
    let confidence = 0.5;

    if (lowerResponse.includes('timing') || lowerResponse.includes('zeitlich') || 
        lowerResponse.includes('stichtag') || lowerResponse.includes('buchungsdatum')) {
      likelyCause = 'timing';
      confidence = 0.8;
    } else if (lowerResponse.includes('währung') || lowerResponse.includes('wechselkurs') ||
               lowerResponse.includes('fx') || lowerResponse.includes('currency')) {
      likelyCause = 'fx';
      confidence = 0.8;
    } else if (lowerResponse.includes('rundung') || lowerResponse.includes('rounding') ||
               Math.abs(recon.difference_amount || 0) < 10) {
      likelyCause = 'rounding';
      confidence = 0.9;
    } else if (lowerResponse.includes('fehlend') || lowerResponse.includes('missing') ||
               lowerResponse.includes('nicht gebucht')) {
      likelyCause = 'missing_entry';
      confidence = 0.7;
    } else if (lowerResponse.includes('fehler') || lowerResponse.includes('error') ||
               lowerResponse.includes('falsch')) {
      likelyCause = 'error';
      confidence = 0.6;
    }

    // Generate suggested action based on cause
    let suggestedAction = '';
    let correctionEntry = undefined;

    switch (likelyCause) {
      case 'timing':
        suggestedAction = 'Als Stichtagsdifferenz akzeptieren oder Buchungsdatum angleichen';
        break;
      case 'fx':
        suggestedAction = 'Einheitlichen Wechselkurs verwenden und Differenz als Währungsanpassung buchen';
        correctionEntry = {
          debitAccount: recon.account_a?.account_number || '',
          creditAccount: 'Währungsdifferenzen',
          amount: Math.abs(recon.difference_amount || 0),
          description: `Währungsanpassung IC ${recon.company_a?.name} / ${recon.company_b?.name}`,
        };
        break;
      case 'rounding':
        suggestedAction = 'Als unwesentliche Rundungsdifferenz akzeptieren';
        break;
      case 'missing_entry':
        suggestedAction = 'Fehlende Gegenbuchung bei Unternehmen B erstellen';
        correctionEntry = {
          debitAccount: recon.account_b?.account_number || '',
          creditAccount: recon.account_a?.account_number || '',
          amount: Math.abs(recon.difference_amount || 0),
          description: `Nachbuchung IC-Abstimmung ${recon.company_a?.name} / ${recon.company_b?.name}`,
        };
        break;
      case 'error':
        suggestedAction = 'Manuelle Prüfung der Buchungen erforderlich';
        break;
      default:
        suggestedAction = 'Weitere Analyse erforderlich';
    }

    return {
      explanation: response,
      likelyCause,
      confidence,
      suggestedAction,
      correctionEntry,
    };
  }

  async batchAnalyze(financialStatementId: string): Promise<ICExplanation[]> {
    const client = this.supabase.getClient();

    // Get all open IC reconciliations
    const { data: openRecons } = await client
      .from('ic_reconciliations')
      .select('id')
      .eq('financial_statement_id', financialStatementId)
      .eq('status', 'open');

    if (!openRecons || openRecons.length === 0) {
      return [];
    }

    // Analyze each one (could be parallelized with Promise.all)
    const results: ICExplanation[] = [];
    for (const recon of openRecons) {
      try {
        const analysis = await this.explainDifference(recon.id);
        results.push(analysis);
      } catch (error) {
        console.error(`Failed to analyze ${recon.id}:`, error);
      }
    }

    return results;
  }
}
```

### 3.4 Prompts

```typescript
// backend/src/modules/ai/prompts/prompts.ts

export const CHAT_SYSTEM_PROMPT = `
Du bist ein KI-Assistent für Konzernabschlüsse nach HGB. Du hilfst Wirtschaftsprüfern bei der Analyse von Konsolidierungsdaten.

Deine Regeln:
- Antworte auf Deutsch, professionell und präzise
- Zeige Zahlen formatiert an (z.B. €1.234,56)
- Verweise auf HGB-Paragraphen wenn relevant (z.B. § 301 HGB)
- Bei Unsicherheit sage "Ich bin nicht sicher" statt zu raten
- Halte Antworten kurz und auf den Punkt

Aktuelle Daten des Mandats:
{CONTEXT}

Wenn keine Daten verfügbar sind, erkläre was der Benutzer tun muss um Daten zu laden.
`;

export const IC_ANALYSIS_PROMPT = `
Du bist ein Experte für konzerninterne Abstimmungen (IC-Reconciliation) nach HGB § 303.

Analysiere die folgende IC-Differenz und erkläre die wahrscheinlichste Ursache:

{IC_DATA}

Mögliche Ursachen:
1. Timing-Differenz: Buchung in unterschiedlichen Perioden
2. Währungsdifferenz: Unterschiedliche Wechselkurse verwendet
3. Rundungsdifferenz: Kleine Abweichung durch Rundung
4. Fehlende Buchung: Eine Seite hat nicht gebucht
5. Buchungsfehler: Falsche Beträge oder Konten

Antworte mit:
1. Die wahrscheinlichste Ursache
2. Eine kurze Erklärung (2-3 Sätze)
3. Empfohlene Maßnahme zur Behebung

Halte die Antwort kurz und praktisch.
`;

export const CORRECTION_PROMPT = `
Basierend auf der IC-Differenz, generiere einen Buchungsvorschlag:

{IC_DATA}

Ursache: {CAUSE}

Antworte im Format:
Soll: [Kontonummer] - [Kontoname]
Haben: [Kontonummer] - [Kontoname]  
Betrag: €[Betrag]
Buchungstext: [Beschreibung]
`;
```

### 3.5 Controller

```typescript
// backend/src/modules/ai/ai.controller.ts

import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ChatService, ChatMessage } from './services/chat.service';
import { ICAnalysisService } from './services/ic-analysis.service';
import { GeminiService } from './services/gemini.service';

// DTOs
class ChatRequestDto {
  message: string;
  history?: ChatMessage[];
  financialStatementId?: string;
}

class ICExplainRequestDto {
  reconciliationId: string;
}

class BatchAnalyzeDto {
  financialStatementId: string;
}

@Controller('ai')
export class AIController {
  constructor(
    private chatService: ChatService,
    private icAnalysisService: ICAnalysisService,
    private geminiService: GeminiService,
  ) {}

  // ==========================================
  // HEALTH CHECK
  // ==========================================

  @Get('health')
  async healthCheck() {
    try {
      const response = await this.geminiService.complete('Say "OK" if you are working.');
      return {
        status: 'healthy',
        model: 'gemini-3.0',
        test: response.includes('OK') ? 'passed' : 'partial',
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  // ==========================================
  // CHAT
  // ==========================================

  @Post('chat')
  async chat(@Body() dto: ChatRequestDto) {
    const { response, data } = await this.chatService.processMessage(
      dto.message,
      dto.history || [],
      dto.financialStatementId,
    );

    return {
      message: response,
      data,
    };
  }

  // ==========================================
  // IC ANALYSIS
  // ==========================================

  @Post('ic/explain')
  async explainDifference(@Body() dto: ICExplainRequestDto) {
    return this.icAnalysisService.explainDifference(dto.reconciliationId);
  }

  @Post('ic/batch-analyze')
  async batchAnalyze(@Body() dto: BatchAnalyzeDto) {
    return this.icAnalysisService.batchAnalyze(dto.financialStatementId);
  }
}
```

### 3.6 Module

```typescript
// backend/src/modules/ai/ai.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AIController } from './ai.controller';
import { GeminiService } from './services/gemini.service';
import { ChatService } from './services/chat.service';
import { ICAnalysisService } from './services/ic-analysis.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [
    ConfigModule,
    SupabaseModule,
  ],
  controllers: [AIController],
  providers: [
    GeminiService,
    ChatService,
    ICAnalysisService,
  ],
  exports: [
    GeminiService,
    ChatService,
    ICAnalysisService,
  ],
})
export class AIModule {}
```

---

## 4. Frontend Components

### 4.0 Global Chat Widget Architecture

The AI Chat is a **global floating widget** accessible from any page - like a support chat bubble.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              App.tsx                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         AIChatProvider (Context)                       │  │
│  │  • Manages chat state globally                                        │  │
│  │  • Persists across page navigation                                    │  │
│  │  • Tracks current financial statement context                         │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │  │
│  │  │                     <Router>                                     │  │  │
│  │  │   ┌─────────────────────────────────────────────────────────┐   │  │  │
│  │  │   │  Current Page (Dashboard, IC, Consolidation, etc.)      │   │  │  │
│  │  │   │                                                         │   │  │  │
│  │  │   │   Page content here...                                  │   │  │  │
│  │  │   │                                                         │   │  │  │
│  │  │   └─────────────────────────────────────────────────────────┘   │  │  │
│  │  │                                                                  │  │  │
│  │  │   ┌─────────────────┐                                           │  │  │
│  │  │   │  💬 AI Chat     │  ← Floating button (always visible)       │  │  │
│  │  │   │     Button      │    Bottom-right corner                    │  │  │
│  │  │   └─────────────────┘                                           │  │  │
│  │  │                                                                  │  │  │
│  │  │   ┌─────────────────────────────────────┐                       │  │  │
│  │  │   │      AI Chat Panel                  │  ← Opens when clicked │  │  │
│  │  │   │  (Slides in from right)             │    Stays open across  │  │  │
│  │  │   │                                     │    page navigation    │  │  │
│  │  │   └─────────────────────────────────────┘                       │  │  │
│  │  └──────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- Chat button visible on every page (bottom-right corner)
- Chat panel stays open when navigating between pages
- Context automatically updates based on current page/selected data
- Keyboard shortcut to open (Ctrl+K or Cmd+K)

### 4.1 AI Service

```typescript
// frontend/src/services/aiService.ts

import api from './api';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface ChatResponse {
  message: string;
  data?: any;
}

export interface ICExplanation {
  reconciliationId: string;
  explanation: string;
  likelyCause: string;
  confidence: number;
  suggestedAction: string;
  correctionEntry?: {
    debitAccount: string;
    creditAccount: string;
    amount: number;
    description: string;
  };
}

const aiService = {
  // Health check
  async checkHealth(): Promise<{ status: string }> {
    const response = await api.get('/ai/health');
    return response.data;
  },

  // Chat
  async sendMessage(
    message: string,
    history: ChatMessage[] = [],
    financialStatementId?: string,
  ): Promise<ChatResponse> {
    const response = await api.post('/ai/chat', {
      message,
      history,
      financialStatementId,
    });
    return response.data;
  },

  // IC Analysis
  async explainDifference(reconciliationId: string): Promise<ICExplanation> {
    const response = await api.post('/ai/ic/explain', { reconciliationId });
    return response.data;
  },

  async batchAnalyze(financialStatementId: string): Promise<ICExplanation[]> {
    const response = await api.post('/ai/ic/batch-analyze', { financialStatementId });
    return response.data;
  },
};

export default aiService;
```

### 4.2 AI Chat Context (Global State)

```typescript
// frontend/src/contexts/AIChatContext.tsx

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import aiService, { ChatMessage } from '../services/aiService';

interface AIChatContextType {
  // State
  isOpen: boolean;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  financialStatementId: string | null;
  
  // Actions
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  sendMessage: (content: string) => Promise<void>;
  clearHistory: () => void;
  setFinancialStatementId: (id: string | null) => void;
}

const AIChatContext = createContext<AIChatContextType | undefined>(undefined);

export function AIChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [financialStatementId, setFinancialStatementId] = useState<string | null>(null);

  // Keyboard shortcut: Ctrl+K or Cmd+K to toggle chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const openChat = useCallback(() => setIsOpen(true), []);
  const closeChat = useCallback(() => setIsOpen(false), []);
  const toggleChat = useCallback(() => setIsOpen(prev => !prev), []);

  const sendMessage = useCallback(async (content: string) => {
    setIsLoading(true);
    setError(null);

    // Add user message immediately
    const userMessage: ChatMessage = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await aiService.sendMessage(
        content,
        messages,
        financialStatementId || undefined,
      );

      // Add AI response
      const aiMessage: ChatMessage = { role: 'model', content: response.message };
      setMessages(prev => [...prev, aiMessage]);
    } catch (err: any) {
      setError(err.message || 'Fehler bei der Kommunikation mit dem AI-Service');
      // Remove the user message if failed
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  }, [messages, financialStatementId]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return (
    <AIChatContext.Provider value={{
      isOpen,
      messages,
      isLoading,
      error,
      financialStatementId,
      openChat,
      closeChat,
      toggleChat,
      sendMessage,
      clearHistory,
      setFinancialStatementId,
    }}>
      {children}
    </AIChatContext.Provider>
  );
}

export function useAIChat() {
  const context = useContext(AIChatContext);
  if (context === undefined) {
    throw new Error('useAIChat must be used within an AIChatProvider');
  }
  return context;
}
```

### 4.3 Global Chat Widget (Button + Panel)

```tsx
// frontend/src/components/ai/GlobalAIChat.tsx
// This component renders both the floating button AND the chat panel

import React from 'react';
import { useAIChat } from '../../contexts/AIChatContext';
import { AIChatPanel } from './AIChatPanel';

/**
 * GlobalAIChat - Renders the floating chat button and panel
 * Place this once in App.tsx, it will be visible on all pages
 */
export const GlobalAIChat: React.FC = () => {
  const { isOpen, toggleChat } = useAIChat();

  return (
    <>
      {/* Floating Chat Button - Always visible */}
      {!isOpen && (
        <button
          onClick={toggleChat}
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            width: 60,
            height: 60,
            borderRadius: '50%',
            backgroundColor: '#1a73e8',
            color: 'white',
            border: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            zIndex: 999,
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.25)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
          }}
          title="AI Assistent öffnen (Ctrl+K)"
        >
          💬
        </button>
      )}

      {/* Chat Panel - Opens when button clicked */}
      <AIChatPanel />
    </>
  );
};
```

```tsx
// frontend/src/components/ai/AIChatPanel.tsx

import React, { useState, useRef, useEffect } from 'react';
import { useAIChat } from '../../contexts/AIChatContext';

export const AIChatPanel: React.FC = () => {
  const { 
    isOpen, 
    closeChat, 
    messages, 
    isLoading, 
    error, 
    sendMessage, 
    clearHistory,
    financialStatementId,
  } = useAIChat();
  
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const message = input;
    setInput('');
    await sendMessage(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestions = [
    'Zeige alle offenen IC-Differenzen',
    'Wie hoch ist der Konzern-Goodwill?',
    'Zusammenfassung der Konsolidierung',
    'Welche Gesellschaften sind im Konsolidierungskreis?',
  ];

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      right: 24,
      bottom: 24,
      width: 400,
      height: 550,
      backgroundColor: 'white',
      borderRadius: 16,
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      zIndex: 1000,
      animation: 'slideUp 0.2s ease-out',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        background: 'linear-gradient(135deg, #1a73e8 0%, #1557b0 100%)',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🤖</span>
          <div>
            <div style={{ fontWeight: 600 }}>Konzern AI Assistent</div>
            <div style={{ fontSize: 11, opacity: 0.9 }}>
              {financialStatementId ? 'Kontext geladen' : 'Allgemeine Fragen'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            onClick={clearHistory}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 12,
              cursor: 'pointer',
            }}
            title="Chat leeren"
          >
            Neu
          </button>
          <button 
            onClick={closeChat} 
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: 24,
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 16,
        backgroundColor: '#f8f9fa',
      }}>
        {messages.length === 0 && (
          <div>
            <p style={{ color: '#666', marginBottom: 16, fontSize: 14 }}>
              Wie kann ich helfen? Fragen Sie mich zu Konsolidierungsdaten, IC-Differenzen, oder HGB-Themen.
            </p>
            <p style={{ color: '#999', fontSize: 12, marginBottom: 12 }}>
              Vorschläge:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setInput(s)}
                  style={{
                    padding: '8px 12px',
                    fontSize: 12,
                    backgroundColor: 'white',
                    border: '1px solid #e0e0e0',
                    borderRadius: 20,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#1a73e8';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.borderColor = '#1a73e8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.color = 'black';
                    e.currentTarget.style.borderColor = '#e0e0e0';
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: 12,
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div style={{
              maxWidth: '85%',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              backgroundColor: msg.role === 'user' ? '#1a73e8' : 'white',
              color: msg.role === 'user' ? 'white' : '#333',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              whiteSpace: 'pre-wrap',
              fontSize: 14,
              lineHeight: 1.5,
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8,
            color: '#666',
          }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#1a73e8',
              animation: 'pulse 1s infinite',
            }} />
            <span style={{ fontSize: 14 }}>Denkt nach...</span>
          </div>
        )}

        {error && (
          <div style={{ 
            padding: 12, 
            backgroundColor: '#ffebee', 
            borderRadius: 8,
            color: '#c62828',
            fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: 12,
        backgroundColor: 'white',
        borderTop: '1px solid #e0e0e0',
        display: 'flex',
        gap: 8,
      }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Frage stellen... (Enter zum Senden)"
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 24,
            border: '1px solid #e0e0e0',
            outline: 'none',
            fontSize: 14,
          }}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          style={{
            padding: '10px 20px',
            backgroundColor: '#1a73e8',
            color: 'white',
            border: 'none',
            borderRadius: 24,
            cursor: 'pointer',
            fontWeight: 500,
            opacity: isLoading || !input.trim() ? 0.5 : 1,
          }}
        >
          ↑
        </button>
      </div>

      {/* CSS Animation (add to global styles or use CSS-in-JS) */}
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};
```

### 4.4 App.tsx Integration

```tsx
// frontend/src/App.tsx

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AIChatProvider } from './contexts/AIChatContext';
import { GlobalAIChat } from './components/ai/GlobalAIChat';

// Import your existing pages
import Dashboard from './pages/Dashboard';
import CompanyManagement from './pages/CompanyManagement';
import ConsolidatedReportPage from './pages/ConsolidatedReportPage';
// ... other pages

function App() {
  return (
    <AIChatProvider>
      <Router>
        <div className="app">
          {/* Your existing layout (Sidebar, Header, etc.) */}
          <Sidebar />
          
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/companies" element={<CompanyManagement />} />
              <Route path="/consolidated-report" element={<ConsolidatedReportPage />} />
              {/* ... other routes */}
            </Routes>
          </main>

          {/* Global AI Chat - Always visible on all pages */}
          <GlobalAIChat />
        </div>
      </Router>
    </AIChatProvider>
  );
}

export default App;
```

### 4.5 Using Chat Context from Any Page

```tsx
// Example: Setting financial statement context from Dashboard

import React, { useEffect } from 'react';
import { useAIChat } from '../contexts/AIChatContext';

const Dashboard: React.FC = () => {
  const { setFinancialStatementId } = useAIChat();
  const [selectedStatement, setSelectedStatement] = useState<string | null>(null);

  // Update AI chat context when user selects a financial statement
  useEffect(() => {
    setFinancialStatementId(selectedStatement);
  }, [selectedStatement, setFinancialStatementId]);

  return (
    <div>
      <h1>Dashboard</h1>
      
      {/* When user selects a financial statement, the AI chat 
          will automatically have context for that data */}
      <select onChange={(e) => setSelectedStatement(e.target.value)}>
        <option value="">Wählen Sie ein Geschäftsjahr...</option>
        <option value="fs-2024">Geschäftsjahr 2024</option>
        <option value="fs-2025">Geschäftsjahr 2025</option>
      </select>
      
      {/* The floating chat button is visible here, 
          and when clicked will know about the selected statement */}
    </div>
  );
};
```

### 4.6 IC Explanation Component

```tsx
// frontend/src/components/ai/ICExplanationCard.tsx

import React, { useState } from 'react';
import aiService, { ICExplanation } from '../../services/aiService';

interface ICExplanationCardProps {
  reconciliationId: string;
  onApplyCorrection?: (correction: ICExplanation['correctionEntry']) => void;
}

export const ICExplanationCard: React.FC<ICExplanationCardProps> = ({
  reconciliationId,
  onApplyCorrection,
}) => {
  const [explanation, setExplanation] = useState<ICExplanation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await aiService.explainDifference(reconciliationId);
      setExplanation(result);
    } catch (err: any) {
      setError(err.message || 'Analyse fehlgeschlagen');
    } finally {
      setIsLoading(false);
    }
  };

  const getCauseIcon = (cause: string) => {
    switch (cause) {
      case 'timing': return '⏰';
      case 'fx': return '💱';
      case 'rounding': return '🔢';
      case 'missing_entry': return '❓';
      case 'error': return '⚠️';
      default: return '❔';
    }
  };

  const getCauseLabel = (cause: string) => {
    switch (cause) {
      case 'timing': return 'Timing-Differenz';
      case 'fx': return 'Währungsdifferenz';
      case 'rounding': return 'Rundungsdifferenz';
      case 'missing_entry': return 'Fehlende Buchung';
      case 'error': return 'Buchungsfehler';
      default: return 'Unbekannt';
    }
  };

  if (!explanation && !isLoading) {
    return (
      <button
        onClick={analyze}
        style={{
          padding: '8px 16px',
          backgroundColor: '#1a73e8',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        🤖 AI Analyse
      </button>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: 16, color: '#666' }}>
        Analysiere Differenz...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16, color: 'red' }}>
        {error}
        <button onClick={analyze} style={{ marginLeft: 8 }}>Erneut versuchen</button>
      </div>
    );
  }

  if (!explanation) return null;

  return (
    <div style={{
      padding: 16,
      backgroundColor: '#f8f9fa',
      borderRadius: 8,
      border: '1px solid #e0e0e0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 24, marginRight: 8 }}>
          {getCauseIcon(explanation.likelyCause)}
        </span>
        <div>
          <strong>{getCauseLabel(explanation.likelyCause)}</strong>
          <span style={{
            marginLeft: 8,
            fontSize: 12,
            color: explanation.confidence > 0.7 ? 'green' : 'orange',
          }}>
            ({Math.round(explanation.confidence * 100)}% Konfidenz)
          </span>
        </div>
      </div>

      <p style={{ marginBottom: 12, color: '#333' }}>
        {explanation.explanation}
      </p>

      <div style={{
        padding: 12,
        backgroundColor: '#e8f4fd',
        borderRadius: 6,
        marginBottom: 12,
      }}>
        <strong>Empfehlung:</strong> {explanation.suggestedAction}
      </div>

      {explanation.correctionEntry && onApplyCorrection && (
        <button
          onClick={() => onApplyCorrection(explanation.correctionEntry!)}
          style={{
            padding: '8px 16px',
            backgroundColor: '#34a853',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Korrekturbuchung erstellen
        </button>
      )}
    </div>
  );
};
```

---

## 5. Database Schema

```sql
-- Migration: 009_ai_features.sql

-- Add AI analysis columns to ic_reconciliations
ALTER TABLE ic_reconciliations 
ADD COLUMN IF NOT EXISTS ai_analysis JSONB,
ADD COLUMN IF NOT EXISTS ai_analysis_at TIMESTAMPTZ;

-- Optional: Chat history table (if you want to persist chat)
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    financial_statement_id UUID REFERENCES financial_statements(id),
    messages JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. Dependencies

### Backend

```bash
cd backend
npm install @google/generative-ai
```

```json
// package.json addition
{
  "dependencies": {
    "@google/generative-ai": "^0.21.0"
  }
}
```

### Frontend

No additional dependencies needed - uses existing axios via `api.ts`.

---

## 7. Configuration

### Register AI Module

```typescript
// backend/src/app.module.ts

import { AIModule } from './modules/ai/ai.module';

@Module({
  imports: [
    // ... existing modules
    AIModule,  // Add this
  ],
})
export class AppModule {}
```

### Environment

```bash
# backend/.env
GEMINI_API_KEY=your-gemini-3.0-api-key
GEMINI_MODEL=gemini-3.0-flash
```

---

## 8. Implementation Checklist

### Phase 1: Core Backend Setup (Day 1-2)
- [ ] Create `backend/src/modules/ai/` folder structure
- [ ] Implement `gemini.service.ts` (Gemini 3.0 API wrapper)
- [ ] Add `GEMINI_API_KEY` to `.env`
- [ ] Register `AIModule` in `app.module.ts`
- [ ] Test basic Gemini completion via health endpoint

### Phase 2: Backend Chat & IC (Day 3-4)
- [ ] Implement `chat.service.ts` with context building
- [ ] Implement `ic-analysis.service.ts`
- [ ] Create `prompts.ts` with system prompts
- [ ] Create `ai.controller.ts` with all endpoints
- [ ] Test endpoints via curl/Postman

### Phase 3: Global Chat Frontend (Day 5-6)
- [ ] Create `AIChatContext.tsx` (global state)
- [ ] Create `GlobalAIChat.tsx` (floating button)
- [ ] Create `AIChatPanel.tsx` (chat UI)
- [ ] Create `aiService.ts` (API calls)
- [ ] Wrap App in `AIChatProvider`
- [ ] Add `GlobalAIChat` to App.tsx
- [ ] Test chat works from any page

### Phase 4: IC Analysis Frontend (Day 7-8)
- [ ] Create `ICExplanationCard.tsx`
- [ ] Integrate into IC reconciliation page
- [ ] Test explain and correction features
- [ ] Add context updates when user selects data

### Phase 5: Polish (Day 9-10)
- [ ] Error handling and fallbacks
- [ ] Loading states and animations
- [ ] Keyboard shortcut (Ctrl+K) testing
- [ ] Mobile responsiveness
- [ ] Database migration for AI columns
- [ ] Testing across all pages

---

## 9. API Reference

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ai/health` | Check if Gemini is working |
| POST | `/ai/chat` | Send chat message |
| POST | `/ai/ic/explain` | Explain IC difference |
| POST | `/ai/ic/batch-analyze` | Analyze all open differences |

### Request/Response Examples

**Chat:**
```json
// POST /ai/chat
{
  "message": "Wie hoch ist der Goodwill?",
  "financialStatementId": "uuid-here",
  "history": []
}

// Response
{
  "message": "Der Konzern-Goodwill beträgt €1.234.567,00...",
  "data": { "goodwillEntries": [...] }
}
```

**IC Explain:**
```json
// POST /ai/ic/explain
{
  "reconciliationId": "uuid-here"
}

// Response
{
  "reconciliationId": "uuid-here",
  "explanation": "Die Differenz von €2.500 resultiert wahrscheinlich...",
  "likelyCause": "timing",
  "confidence": 0.85,
  "suggestedAction": "Als Stichtagsdifferenz akzeptieren",
  "correctionEntry": null
}
```

---

## 10. Future Enhancements (Layer On Later)

| Feature | Description | When |
|---------|-------------|------|
| **Vertex AI** | EU data residency, enterprise security | When needed for compliance |
| **Streaming** | Real-time response display | For better UX |
| **Chat History** | Persist conversations | For audit trail |
| **Feedback Loop** | User ratings on AI responses | For improvement |
| **Caching** | Cache IC analyses | For performance |

---

**Estimated Implementation Time:** 10 days (2 weeks with buffer)

**Monthly Cost:** Minimal (~$2-10 depending on usage)

---

*Document Version: 2.0*  
*Created: 14. Januar 2026*  
*Updated: 14. Januar 2026 - Simplified for Gemini 3.0 API*
