import { Injectable, Logger } from '@nestjs/common';
import {
  ReasoningChain,
  ReasoningStep,
  AlternativeInterpretation,
  QualityIndicators,
  getConfidenceLevel,
  ConfidenceLevel,
} from '../types/agent.types';

interface DataAnalysis {
  observations: string[];
  inferences: string[];
  dataPoints: string[];
  confidence: number;
}

/**
 * Service for building reasoning chains and quality indicators
 */
@Injectable()
export class ReasoningService {
  private readonly logger = new Logger(ReasoningService.name);

  /**
   * Build a reasoning chain from analysis data
   * Overloaded to accept either (analysisType, steps, alternatives) or (steps, conclusion, showAlternativesProminent)
   */
  buildReasoningChain(
    stepsOrType: ReasoningStep[] | string,
    conclusionOrSteps?: string | ReasoningStep[],
    showAlternativesOrAlternatives?: boolean | AlternativeInterpretation[],
  ): ReasoningChain {
    // Handle new signature: (steps, conclusion, showAlternativesProminent?)
    if (Array.isArray(stepsOrType)) {
      const steps = stepsOrType;
      const conclusion = conclusionOrSteps as string || this.synthesizeConclusion(steps);
      const avgConfidence = this.calculateAverageConfidence(steps);
      const showAlternativesProminent = typeof showAlternativesOrAlternatives === 'boolean' 
        ? showAlternativesOrAlternatives 
        : avgConfidence < 0.8;

      return {
        steps,
        conclusion,
        alternativeInterpretations: [],
        showAlternativesProminent,
      };
    }

    // Handle legacy signature: (analysisType, steps, alternatives)
    const steps = conclusionOrSteps as ReasoningStep[] || [];
    const alternatives = showAlternativesOrAlternatives as AlternativeInterpretation[] || [];
    const conclusion = this.synthesizeConclusion(steps);
    const avgConfidence = this.calculateAverageConfidence(steps);
    
    // Show alternatives prominently if confidence < 80%
    const showAlternativesProminent = avgConfidence < 0.8;

    return {
      steps,
      conclusion,
      alternativeInterpretations: alternatives,
      showAlternativesProminent,
    };
  }

  /**
   * Build an empty reasoning chain for error cases
   */
  buildEmptyChain(errorMessage: string): ReasoningChain {
    return {
      steps: [],
      conclusion: errorMessage,
      alternativeInterpretations: [],
      showAlternativesProminent: false,
    };
  }

  /**
   * Create a reasoning step
   */
  createStep(
    observation: string,
    inference: string,
    confidence: number,
    dataPoints: string[],
  ): ReasoningStep {
    return {
      observation,
      inference,
      confidence: Math.max(0, Math.min(1, confidence)), // Clamp to 0-1
      dataPoints,
    };
  }

  /**
   * Create an alternative interpretation
   */
  createAlternative(
    interpretation: string,
    probability: number,
    checkQuestion: string,
  ): AlternativeInterpretation {
    return {
      interpretation,
      probability: Math.max(0, Math.min(1, probability)),
      checkQuestion,
    };
  }

  /**
   * Synthesize a conclusion from reasoning steps
   */
  private synthesizeConclusion(steps: ReasoningStep[]): string {
    if (steps.length === 0) {
      return 'Keine ausreichenden Daten für eine Schlussfolgerung.';
    }

    const avgConfidence = this.calculateAverageConfidence(steps);
    
    // Find the step with highest confidence
    const mainStep = [...steps].sort((a, b) => b.confidence - a.confidence)[0];
    
    const confidencePercent = Math.round(avgConfidence * 100);
    
    return `Mit ${confidencePercent}% Wahrscheinlichkeit: ${mainStep.inference}`;
  }

  /**
   * Calculate average confidence from steps
   */
  calculateAverageConfidence(steps: ReasoningStep[]): number {
    if (steps.length === 0) return 0;
    
    const sum = steps.reduce((acc, step) => acc + step.confidence, 0);
    return sum / steps.length;
  }

  /**
   * Build quality indicators from analysis data
   */
  buildQualityIndicators(
    dataCompleteness: { percentage: number; missingData?: string[] },
    hgbConformity: boolean,
    confidenceBreakdown: { dataQuality: number; patternMatch: number; ruleMatch: number },
    deviations: string[] = [],
    historicalAccuracy?: { similarCases: number; correctPredictions: number },
  ): QualityIndicators {
    // Calculate overall confidence
    const overall = (
      confidenceBreakdown.dataQuality * 0.4 +
      confidenceBreakdown.patternMatch * 0.3 +
      confidenceBreakdown.ruleMatch * 0.3
    );

    return {
      dataCompleteness,
      ruleCompliance: {
        hgbConformity,
        deviations: deviations.length > 0 ? deviations : undefined,
      },
      historicalAccuracy: historicalAccuracy ? {
        similarCases: historicalAccuracy.similarCases,
        correctPredictions: historicalAccuracy.correctPredictions,
        accuracy: historicalAccuracy.similarCases > 0
          ? historicalAccuracy.correctPredictions / historicalAccuracy.similarCases
          : 0,
      } : undefined,
      confidenceBreakdown: {
        ...confidenceBreakdown,
        overall,
      },
      confidenceLevel: getConfidenceLevel(overall),
    };
  }

  /**
   * Create default quality indicators when analysis is not possible
   */
  createDefaultQualityIndicators(): QualityIndicators {
    return {
      dataCompleteness: {
        percentage: 0,
        missingData: ['Keine Daten verfügbar'],
      },
      ruleCompliance: {
        hgbConformity: false,
      },
      confidenceBreakdown: {
        dataQuality: 0,
        patternMatch: 0,
        ruleMatch: 0,
        overall: 0,
      },
      confidenceLevel: 'low',
    };
  }

  /**
   * Merge multiple quality indicators
   */
  mergeQualityIndicators(indicators: QualityIndicators[]): QualityIndicators {
    if (indicators.length === 0) {
      return this.createDefaultQualityIndicators();
    }

    if (indicators.length === 1) {
      return indicators[0];
    }

    // Average the numeric values
    const avgDataCompleteness = indicators.reduce(
      (sum, i) => sum + i.dataCompleteness.percentage, 0
    ) / indicators.length;

    const avgOverall = indicators.reduce(
      (sum, i) => sum + i.confidenceBreakdown.overall, 0
    ) / indicators.length;

    // Collect all missing data
    const allMissingData = indicators
      .flatMap(i => i.dataCompleteness.missingData || [])
      .filter((v, i, a) => a.indexOf(v) === i);

    // Check if all are HGB conformant
    const allConformant = indicators.every(i => i.ruleCompliance.hgbConformity);

    // Collect all deviations
    const allDeviations = indicators
      .flatMap(i => i.ruleCompliance.deviations || [])
      .filter((v, i, a) => a.indexOf(v) === i);

    return {
      dataCompleteness: {
        percentage: avgDataCompleteness,
        missingData: allMissingData.length > 0 ? allMissingData : undefined,
      },
      ruleCompliance: {
        hgbConformity: allConformant,
        deviations: allDeviations.length > 0 ? allDeviations : undefined,
      },
      confidenceBreakdown: {
        dataQuality: indicators.reduce((sum, i) => sum + i.confidenceBreakdown.dataQuality, 0) / indicators.length,
        patternMatch: indicators.reduce((sum, i) => sum + i.confidenceBreakdown.patternMatch, 0) / indicators.length,
        ruleMatch: indicators.reduce((sum, i) => sum + i.confidenceBreakdown.ruleMatch, 0) / indicators.length,
        overall: avgOverall,
      },
      confidenceLevel: getConfidenceLevel(avgOverall),
    };
  }

  /**
   * Format reasoning chain for display
   */
  formatReasoningForDisplay(reasoning: ReasoningChain): string {
    const lines: string[] = ['BEGRÜNDUNG', ''];

    reasoning.steps.forEach((step, i) => {
      lines.push(`Schritt ${i + 1}:`);
      lines.push(`  - ${step.observation}`);
      lines.push(`  > Inferenz: ${step.inference}`);
      lines.push(`  > Konfidenz: ${Math.round(step.confidence * 100)}%`);
      lines.push('');
    });

    lines.push(`FAZIT: ${reasoning.conclusion}`);

    if (reasoning.alternativeInterpretations && reasoning.alternativeInterpretations.length > 0) {
      lines.push('');
      lines.push('Alternative Interpretationen:');
      reasoning.alternativeInterpretations.forEach(alt => {
        lines.push(`  - ${alt.interpretation} (${Math.round(alt.probability * 100)}%)`);
        lines.push(`    > ${alt.checkQuestion}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Format quality indicators for display
   */
  formatQualityForDisplay(quality: QualityIndicators): string {
    const confidenceLabel = this.getConfidenceLabel(quality.confidenceLevel);
    const lines: string[] = [
      `QUALITÄTSINDIKATOREN [${confidenceLabel}] ${Math.round(quality.confidenceBreakdown.overall * 100)}%`,
      '',
      `Datenvollständigkeit: ${Math.round(quality.dataCompleteness.percentage)}%`,
    ];

    if (quality.dataCompleteness.missingData?.length) {
      lines.push(`  Fehlend: ${quality.dataCompleteness.missingData.join(', ')}`);
    }

    lines.push('');
    lines.push(`HGB-Konformität: ${quality.ruleCompliance.hgbConformity ? 'eingehalten' : 'Abweichungen'}`);
    
    if (quality.ruleCompliance.deviations?.length) {
      quality.ruleCompliance.deviations.forEach(d => {
        lines.push(`  - ${d}`);
      });
    }

    if (quality.historicalAccuracy) {
      lines.push('');
      lines.push(`Historische Trefferquote: ${Math.round(quality.historicalAccuracy.accuracy * 100)}% (${quality.historicalAccuracy.correctPredictions}/${quality.historicalAccuracy.similarCases})`);
    }

    return lines.join('\n');
  }

  /**
   * Get text label for confidence level
   */
  private getConfidenceLabel(level: ConfidenceLevel): string {
    switch (level) {
      case 'high': return 'HOCH';
      case 'medium': return 'MITTEL';
      case 'low': return 'NIEDRIG';
    }
  }
}
