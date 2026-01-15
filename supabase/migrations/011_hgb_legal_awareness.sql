-- =====================================================
-- HGB Legal Awareness Feature
-- Migration 011: Enhanced legal tracking and awareness
-- =====================================================

-- Enhanced HGB paragraphs with versioning and source tracking
-- Note: This extends the existing hgb_knowledge_base table
-- We'll add new columns to support versioning and source tracking

ALTER TABLE hgb_knowledge_base
  ADD COLUMN IF NOT EXISTS full_reference TEXT,
  ADD COLUMN IF NOT EXISTS content_summary TEXT,
  ADD COLUMN IF NOT EXISTS content_full TEXT,
  ADD COLUMN IF NOT EXISTS consolidation_relevance TEXT,
  ADD COLUMN IF NOT EXISTS effective_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS superseded_date DATE,
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_reference TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS verified_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS verified_by TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[],
  ADD COLUMN IF NOT EXISTS related_idw_standards TEXT[];

-- Update existing rows to have full_reference if missing
UPDATE hgb_knowledge_base
SET full_reference = paragraph
WHERE full_reference IS NULL;

-- Track legislative changes
CREATE TABLE IF NOT EXISTS hgb_legislative_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Change identification
  paragraph TEXT NOT NULL,              -- "§ 303 HGB"
  change_type TEXT NOT NULL CHECK (change_type IN ('amendment', 'addition', 'repeal', 'clarification')),
  
  -- Timing
  announced_date DATE,                  -- When announced/passed
  effective_date DATE NOT NULL,         -- When it takes effect
  
  -- Content
  change_summary TEXT NOT NULL,         -- Brief description
  change_details TEXT,                  -- Full details
  impact_on_consolidation TEXT,         -- Specific impact
  
  -- Legal reference
  law_name TEXT,                        -- "DiRUG", "BilRUG", "CSRD-UmsG"
  source_reference TEXT,                -- "BGBl. I 2021, S. 3338"
  source_url TEXT,
  
  -- Status
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'effective', 'superseded')),
  
  -- Notification tracking
  notify_users BOOLEAN DEFAULT true,
  notification_sent_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- IDW standards relevant to consolidation
CREATE TABLE IF NOT EXISTS idw_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Standard identification
  standard_id TEXT NOT NULL,            -- "IDW RS HFA 2"
  title TEXT NOT NULL,                  -- "Konzernrechnungslegung"
  
  -- Content
  summary TEXT NOT NULL,                -- Brief summary
  key_points TEXT[],                    -- Key takeaways for consolidation
  
  -- Versioning
  version TEXT,                         -- "Stand: 01.01.2023"
  effective_date DATE NOT NULL,
  superseded_date DATE,
  is_current BOOLEAN DEFAULT true,
  
  -- Source
  source_url TEXT,                      -- Link to IDW or purchase
  verified_date DATE NOT NULL,
  
  -- Relationships
  related_hgb_paragraphs TEXT[],        -- ['§ 303 HGB', '§ 304 HGB']
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Track which legal content users have seen (for change alerts)
CREATE TABLE IF NOT EXISTS user_legal_content_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- What they viewed
  content_type TEXT NOT NULL CHECK (content_type IN ('paragraph', 'change', 'idw_standard')),
  content_id UUID NOT NULL,
  
  -- When
  viewed_at TIMESTAMPTZ DEFAULT now(),
  dismissed_alert BOOLEAN DEFAULT false
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_hgb_paragraphs_current ON hgb_knowledge_base(paragraph) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_hgb_paragraphs_category ON hgb_knowledge_base(category) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_hgb_changes_effective ON hgb_legislative_changes(effective_date, status);
CREATE INDEX IF NOT EXISTS idx_hgb_changes_paragraph ON hgb_legislative_changes(paragraph);
CREATE INDEX IF NOT EXISTS idx_idw_current ON idw_standards(standard_id) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_user_views ON user_legal_content_views(user_id, content_type, content_id);

-- Grant access
GRANT ALL ON hgb_legislative_changes TO service_role;
GRANT ALL ON idw_standards TO service_role;
GRANT ALL ON user_legal_content_views TO service_role;

GRANT SELECT ON hgb_legislative_changes TO authenticated;
GRANT SELECT ON idw_standards TO authenticated;
GRANT SELECT ON user_legal_content_views TO authenticated;
