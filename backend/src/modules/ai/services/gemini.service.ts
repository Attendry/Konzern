import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

@Injectable()
export class GeminiService implements OnModuleInit {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private modelName: string;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not configured - AI features will not work');
      return;
    }

    this.modelName = this.configService.get('GEMINI_MODEL') || 'gemini-2.0-flash';
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: this.modelName,
    });

    this.logger.log(`Gemini initialized with model: ${this.modelName}`);
  }

  /**
   * Check if Gemini is configured and ready
   */
  isAvailable(): boolean {
    return !!this.genAI && !!this.model;
  }

  /**
   * Simple completion - send prompt, get response
   */
  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Gemini is not configured. Please set GEMINI_API_KEY.');
    }

    const fullPrompt = systemPrompt 
      ? `${systemPrompt}\n\n---\n\nUser: ${prompt}`
      : prompt;

    try {
      const result = await this.model.generateContent(fullPrompt);
      const response = result.response;
      return response.text();
    } catch (error: any) {
      this.logger.error(`Gemini completion error: ${error.message}`);
      throw new Error(`AI-Anfrage fehlgeschlagen: ${error.message}`);
    }
  }

  /**
   * Chat with message history
   */
  async chat(
    messages: ChatMessage[],
    systemPrompt?: string,
  ): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Gemini is not configured. Please set GEMINI_API_KEY.');
    }

    if (messages.length === 0) {
      throw new Error('No messages provided');
    }

    try {
      // Convert messages to Gemini format
      const history = messages.slice(0, -1).map(m => ({
        role: m.role,
        parts: [{ text: m.content }],
      }));

      const chat = this.model.startChat({
        history,
        ...(systemPrompt && { systemInstruction: systemPrompt }),
      });

      const lastMessage = messages[messages.length - 1];
      const result = await chat.sendMessage(lastMessage.content);
      return result.response.text();
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

    const fullPrompt = systemPrompt 
      ? `${systemPrompt}\n\n---\n\nUser: ${prompt}`
      : prompt;

    try {
      const result = await this.model.generateContentStream(fullPrompt);
      
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield text;
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
