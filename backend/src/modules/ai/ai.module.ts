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
