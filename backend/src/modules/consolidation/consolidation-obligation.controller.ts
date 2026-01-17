import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ConsolidationObligationService } from './consolidation-obligation.service';
import { ConsolidationObligationResult } from './consolidation-obligation.service';
import { ConsolidationException } from '../../entities/consolidation-obligation-check.entity';

@Controller('consolidation/obligation')
export class ConsolidationObligationController {
  constructor(
    private readonly consolidationObligationService: ConsolidationObligationService,
  ) {}

  /**
   * Prüft Konsolidierungspflicht für ein Unternehmen
   * GET /api/consolidation/obligation/check/:companyId
   */
  @Get('check/:companyId')
  async checkObligation(
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ): Promise<ConsolidationObligationResult> {
    return this.consolidationObligationService.checkObligation(companyId);
  }

  /**
   * Prüft alle Unternehmen
   * POST /api/consolidation/obligation/check-all
   */
  @Post('check-all')
  async checkAll(): Promise<ConsolidationObligationResult[]> {
    return this.consolidationObligationService.checkAll();
  }

  /**
   * Ruft Warnungen ab
   * GET /api/consolidation/obligation/warnings
   */
  @Get('warnings')
  async getWarnings(): Promise<ConsolidationObligationResult[]> {
    return this.consolidationObligationService.getWarnings();
  }

  /**
   * Ruft letzte Prüfung für ein Unternehmen ab
   * GET /api/consolidation/obligation/last-check/:companyId
   */
  @Get('last-check/:companyId')
  async getLastCheck(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.consolidationObligationService.getLastCheck(companyId);
  }

  /**
   * Aktualisiert manuelle Entscheidung
   * PUT /api/consolidation/obligation/manual-decision/:companyId
   */
  @Put('manual-decision/:companyId')
  async updateManualDecision(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body()
    decision: {
      hasUnifiedManagement?: boolean;
      hasControlAgreement?: boolean;
      exceptions?: ConsolidationException[];
      comment?: string;
    },
  ): Promise<{ success: boolean; message: string }> {
    await this.consolidationObligationService.updateManualDecision(
      companyId,
      decision,
    );
    return {
      success: true,
      message: 'Manuelle Entscheidung erfolgreich aktualisiert',
    };
  }
}
