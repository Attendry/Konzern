/**
 * Legal Awareness Types for Frontend
 */

export interface HGBParagraph {
  id: string;
  paragraph: string;
  fullReference: string;
  title: string;
  contentSummary: string;
  contentFull?: string;
  consolidationRelevance?: string;
  effectiveDate: string;
  supersededDate?: string;
  isCurrent: boolean;
  sourceReference?: string;
  sourceUrl?: string;
  verifiedDate: string;
  verifiedBy?: string;
  category?: string;
  subcategory?: string;
  tags?: string[];
  relatedParagraphs?: string[];
  relatedIdwStandards?: string[];
}

export interface LegislativeChange {
  id: string;
  paragraph: string;
  changeType: 'amendment' | 'addition' | 'repeal' | 'clarification';
  announcedDate?: string;
  effectiveDate: string;
  changeSummary: string;
  changeDetails?: string;
  impactOnConsolidation?: string;
  lawName?: string;
  sourceReference?: string;
  sourceUrl?: string;
  status: 'upcoming' | 'effective' | 'superseded';
}

export interface IDWStandard {
  id: string;
  standardId: string;
  title: string;
  summary: string;
  keyPoints?: string[];
  version?: string;
  effectiveDate: string;
  isCurrent: boolean;
  sourceUrl?: string;
  verifiedDate: string;
  relatedHgbParagraphs?: string[];
}

export interface LegalChangeAlert {
  change: LegislativeChange;
  paragraph: HGBParagraph;
  daysUntilEffective: number;
  userHasSeen: boolean;
  impactSeverity: 'low' | 'medium' | 'high';
}
