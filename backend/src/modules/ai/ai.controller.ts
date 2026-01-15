import { Controller, Post, Get, Body, Logger } from '@nestjs/common';
import { ChatService } from './services/chat.service';
import { ICAnalysisService } from './services/ic-analysis.service';
import { GeminiService } from './services/gemini.service';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';
import { ICExplainRequestDto, BatchAnalyzeRequestDto, ICExplanationDto } from './dto/ic-analysis.dto';

@Controller('ai')
export class AIController {
  private readonly logger = new Logger(AIController.name);

  constructor(
    private chatService: ChatService,
    private icAnalysisService: ICAnalysisService,
    private geminiService: GeminiService,
  ) {}

  // ==========================================
  // HEALTH CHECK
  // ==========================================

  @Get('health')
  async healthCheck(): Promise<{
    status: string;
    model: string;
    available: boolean;
  }> {
    const available = this.geminiService.isAvailable();
    
    if (!available) {
      return {
        status: 'not configured',
        model: 'none',
        available: false,
      };
    }

    try {
      // Quick test
      const response = await this.geminiService.complete('Antworte nur mit "OK".');
      const isWorking = response.toLowerCase().includes('ok');
      
      return {
        status: isWorking ? 'healthy' : 'degraded',
        model: this.geminiService.getModelName(),
        available: true,
      };
    } catch (error: any) {
      this.logger.error(`Health check failed: ${error.message}`);
      return {
        status: `error: ${error.message}`,
        model: this.geminiService.getModelName(),
        available: false,
      };
    }
  }

  // ==========================================
  // CHAT
  // ==========================================

  @Post('chat')
  async chat(@Body() dto: ChatRequestDto): Promise<ChatResponseDto> {
    this.logger.log(`Chat request: "${dto.message.substring(0, 50)}..."`);
    
    const response = await this.chatService.processMessage(
      dto.message,
      dto.history || [],
      dto.financialStatementId,
    );

    return response;
  }

  // ==========================================
  // IC ANALYSIS
  // ==========================================

  @Post('ic/explain')
  async explainDifference(@Body() dto: ICExplainRequestDto): Promise<ICExplanationDto> {
    this.logger.log(`IC explain request for: ${dto.reconciliationId}`);
    return this.icAnalysisService.explainDifference(dto.reconciliationId);
  }

  @Post('ic/batch-analyze')
  async batchAnalyze(@Body() dto: BatchAnalyzeRequestDto): Promise<ICExplanationDto[]> {
    this.logger.log(`Batch analyze request for statement: ${dto.financialStatementId}`);
    return this.icAnalysisService.batchAnalyze(dto.financialStatementId);
  }
}
