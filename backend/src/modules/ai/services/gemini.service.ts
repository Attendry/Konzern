import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

@Injectable()
export class GeminiService implements OnModuleInit {
  private readonly logger = new Logger(GeminiService.name);
  private client: GoogleGenAI;
  private modelName: string;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      this.logger.warn(
        'GEMINI_API_KEY not configured - AI features will not work',
      );
      return;
    }

    this.modelName =
      this.configService.get('GEMINI_MODEL') || 'gemini-2.5-flash';
    this.client = new GoogleGenAI({ apiKey });

    this.logger.log(`Gemini initialized with model: ${this.modelName}`);
  }

  /**
   * Check if Gemini is configured and ready
   */
  isAvailable(): boolean {
    return !!this.client;
  }

  /**
   * Simple completion - send prompt, get response
   */
  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Gemini is not configured. Please set GEMINI_API_KEY.');
    }

    try {
      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: systemPrompt
          ? {
              systemInstruction: systemPrompt,
            }
          : undefined,
      });
      return response.text;
    } catch (error: any) {
      this.logger.error(`Gemini completion error: ${error.message}`);
      throw new Error(`AI-Anfrage fehlgeschlagen: ${error.message}`);
    }
  }

  /**
   * Chat with message history
   */
  async chat(messages: ChatMessage[], systemPrompt?: string): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Gemini is not configured. Please set GEMINI_API_KEY.');
    }

    if (messages.length === 0) {
      throw new Error('No messages provided');
    }

    try {
      // Build history with system prompt as initial context
      const history: Array<{
        role: 'user' | 'model';
        parts: Array<{ text: string }>;
      }> = [];

      // Add system prompt as initial exchange if provided
      if (systemPrompt) {
        history.push({
          role: 'user',
          parts: [{ text: `System-Anweisung: ${systemPrompt}` }],
        });
        history.push({
          role: 'model',
          parts: [
            { text: 'Verstanden. Ich werde diese Anweisungen befolgen.' },
          ],
        });
      }

      // Add conversation history (except last message)
      for (const m of messages.slice(0, -1)) {
        history.push({
          role: m.role,
          parts: [{ text: m.content }],
        });
      }

      // Create chat with history
      const chat = await this.client.chats.create({
        model: this.modelName,
        history: history,
        config: systemPrompt
          ? {
              systemInstruction: systemPrompt,
            }
          : undefined,
      });

      const lastMessage = messages[messages.length - 1];
      const response = await chat.sendMessage({
        message: lastMessage.content,
      });
      return response.text;
    } catch (error: any) {
      this.logger.error(`Gemini chat error: ${error.message}`);
      throw new Error(`AI-Chat fehlgeschlagen: ${error.message}`);
    }
  }

  /**
   * Streaming response (for future use)
   */
  async *stream(prompt: string, systemPrompt?: string): AsyncGenerator<string> {
    if (!this.isAvailable()) {
      throw new Error('Gemini is not configured. Please set GEMINI_API_KEY.');
    }

    try {
      const stream = await this.client.models.generateContentStream({
        model: this.modelName,
        contents: prompt,
        config: systemPrompt
          ? {
              systemInstruction: systemPrompt,
            }
          : undefined,
      });

      for await (const chunk of stream) {
        // Handle different chunk types - may be text or other content
        if (chunk.text) {
          yield chunk.text;
        } else if (typeof chunk === 'string') {
          yield chunk;
        }
      }
    } catch (error: any) {
      this.logger.error(`Gemini stream error: ${error.message}`);
      throw new Error(`AI-Streaming fehlgeschlagen: ${error.message}`);
    }
  }

  /**
   * Get the current model name
   */
  getModelName(): string {
    return this.modelName || 'not configured';
  }
}
