/**
 * Legal Awareness Types
 * Types for HGB legal awareness feature
 */

export interface HGBParagraph {
  id: string;
  paragraph: string;              // "§ 303"
  fullReference: string;          // "§ 303 HGB"
  title: string;
  
  // Content
  contentSummary: string;
  contentFull?: string;
  consolidationRelevance?: string;
  
  // Versioning
  effectiveDate: Date;
  supersededDate?: Date;
  isCurrent: boolean;
  
  // Source
  sourceReference?: string;
  sourceUrl?: string;
  verifiedDate: Date;
  verifiedBy?: string;
  
  // Categorization
  category?: string;
  subcategory?: string;
  tags?: string[];
  
  // Related
  relatedParagraphs?: string[];
  relatedIdwStandards?: string[];
}

export interface LegislativeChange {
  id: string;
  paragraph: string;
  changeType: 'amendment' | 'addition' | 'repeal' | 'clarification';
  
  announcedDate?: Date;
  effectiveDate: Date;
  
  changeSummary: string;
  changeDetails?: string;
  impactOnConsolidation?: string;
  
  lawName?: string;               // "DiRUG", "CSRD-UmsG"
  sourceReference?: string;
  sourceUrl?: string;
  
  status: 'upcoming' | 'effective' | 'superseded';
  notifyUsers?: boolean;
  notificationSentAt?: Date;
}

export interface IDWStandard {
  id: string;
  standardId: string;             // "IDW RS HFA 2"
  title: string;
  
  summary: string;
  keyPoints?: string[];
  
  version?: string;
  effectiveDate: Date;
  supersededDate?: Date;
  isCurrent: boolean;
  
  sourceUrl?: string;
  verifiedDate: Date;
  
  relatedHgbParagraphs?: string[];
}

export interface LegalContext {
  // Primary paragraph for this context
  primaryParagraph: HGBParagraph;
  
  // Related paragraphs
  relatedParagraphs: HGBParagraph[];
  
  // Relevant IDW standards
  idwStandards: IDWStandard[];
  
  // Pending/recent changes
  upcomingChanges: LegislativeChange[];
  recentChanges: LegislativeChange[];  // Last 12 months
  
  // Meta
  lastVerified: Date;
  disclaimer: string;
}

export interface LegalChangeAlert {
  change: LegislativeChange;
  paragraph: HGBParagraph;
  daysUntilEffective: number;
  userHasSeen: boolean;
  impactSeverity: 'low' | 'medium' | 'high';
}
