-- =====================================================
-- AI Agent Features Migration
-- Version: 2.1
-- Based on AI_AGENT_IMPLEMENTATION_PLAN.md
-- =====================================================

-- =====================================================
-- AI AUDIT LOG
-- Store all AI interactions with decisions
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_statement_id UUID REFERENCES financial_statements(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  
  -- Request
  request_text TEXT NOT NULL,
  request_mode TEXT NOT NULL CHECK (request_mode IN ('explain', 'action')),
  request_timestamp TIMESTAMPTZ DEFAULT now(),
  
  -- Response
  response_summary TEXT,
  ai_recommendation TEXT,
  ai_confidence DECIMAL(3,2),
  reasoning_chain JSONB,
  quality_indicators JSONB,
  provenance JSONB,
  
  -- User decision
  user_decision TEXT CHECK (user_decision IN ('accept', 'reject', 'modify', 'ignore')),
  user_reasoning TEXT,
  decision_timestamp TIMESTAMPTZ,
  
  -- Action taken (if any)
  action_taken TEXT,
  action_result JSONB,
  
  -- Metadata
  session_id UUID,
  tool_name TEXT,
  processing_time_ms INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_ai_audit_user ON ai_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_audit_fs ON ai_audit_log(financial_statement_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_audit_decision ON ai_audit_log(user_decision, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_audit_session ON ai_audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_tool ON ai_audit_log(tool_name, created_at DESC);

-- =====================================================
-- AI OVERRIDE LOG
-- Store override history separately for compliance
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_override_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_audit_log_id UUID REFERENCES ai_audit_log(id) ON DELETE CASCADE,
  
  ai_recommendation TEXT NOT NULL,
  ai_confidence DECIMAL(3,2),
  
  wp_decision TEXT NOT NULL,
  wp_alternative TEXT,
  wp_reasoning TEXT NOT NULL,
  wp_user_id UUID NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for override queries
CREATE INDEX IF NOT EXISTS idx_ai_override_audit ON ai_override_log(ai_audit_log_id);
CREATE INDEX IF NOT EXISTS idx_ai_override_user ON ai_override_log(wp_user_id, created_at DESC);

-- =====================================================
-- AI AGENT SESSIONS
-- Track user sessions for context management
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Mode state
  current_mode TEXT DEFAULT 'explain' CHECK (current_mode IN ('explain', 'action')),
  mode_activated_at TIMESTAMPTZ,
  mode_expires_at TIMESTAMPTZ,
  
  -- Last batch result for follow-up references
  last_batch_tool TEXT,
  last_batch_timestamp TIMESTAMPTZ,
  last_batch_total INTEGER,
  last_batch_result_index JSONB,
  
  -- Recent queries for context
  recent_queries JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_user ON ai_agent_sessions(user_id);

-- =====================================================
-- AI TOOL EXECUTIONS
-- Detailed log of tool executions for debugging/analytics
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_log_id UUID REFERENCES ai_audit_log(id) ON DELETE CASCADE,
  
  tool_name TEXT NOT NULL,
  tool_params JSONB,
  
  -- Execution details
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  success BOOLEAN,
  error_message TEXT,
  
  -- Result summary
  result_message TEXT,
  result_confidence DECIMAL(3,2),
  result_provenance JSONB,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_exec_audit ON ai_tool_executions(audit_log_id);
CREATE INDEX IF NOT EXISTS idx_ai_tool_exec_name ON ai_tool_executions(tool_name, created_at DESC);

-- =====================================================
-- AI BATCH OPERATIONS
-- Track batch operations for reporting
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_batch_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES ai_agent_sessions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  
  tool_name TEXT NOT NULL,
  
  -- Batch details
  total_items INTEGER NOT NULL,
  processed_items INTEGER DEFAULT 0,
  succeeded_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  -- Results
  summary TEXT,
  report_url TEXT,
  result_index JSONB,
  
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_batch_user ON ai_batch_operations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_batch_session ON ai_batch_operations(session_id);

-- =====================================================
-- HGB KNOWLEDGE BASE
-- Store HGB paragraphs and rules for reference
-- =====================================================
CREATE TABLE IF NOT EXISTS hgb_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  paragraph TEXT NOT NULL,  -- e.g., "§ 303 HGB"
  title TEXT NOT NULL,      -- e.g., "Schuldenkonsolidierung"
  content TEXT NOT NULL,    -- Full text of the paragraph
  
  -- Categorization
  category TEXT,            -- e.g., "Konsolidierung", "Bewertung"
  subcategory TEXT,
  
  -- Related paragraphs
  related_paragraphs TEXT[],
  
  -- Metadata
  last_updated DATE,
  source TEXT,
  
  -- Search optimization
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('german', coalesce(paragraph, '')), 'A') ||
    setweight(to_tsvector('german', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('german', coalesce(content, '')), 'B')
  ) STORED,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hgb_paragraph ON hgb_knowledge_base(paragraph);
CREATE INDEX IF NOT EXISTS idx_hgb_category ON hgb_knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_hgb_search ON hgb_knowledge_base USING gin(search_vector);

-- =====================================================
-- AI ANALYSIS CACHE
-- Cache expensive AI analyses for performance
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Cache key components
  cache_key TEXT NOT NULL UNIQUE,
  tool_name TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  
  -- Cached result
  result JSONB NOT NULL,
  
  -- Validity
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  
  -- Usage tracking
  hit_count INTEGER DEFAULT 0,
  last_hit_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_key ON ai_analysis_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON ai_analysis_cache(expires_at);

-- =====================================================
-- VIEWS FOR REPORTING
-- =====================================================

-- AI Usage Summary View
CREATE OR REPLACE VIEW ai_usage_summary AS
SELECT 
  DATE_TRUNC('day', request_timestamp) as date,
  COUNT(*) as total_interactions,
  COUNT(CASE WHEN user_decision = 'accept' THEN 1 END) as accepted,
  COUNT(CASE WHEN user_decision = 'reject' THEN 1 END) as rejected,
  COUNT(CASE WHEN user_decision = 'modify' THEN 1 END) as modified,
  COUNT(CASE WHEN user_decision = 'ignore' OR user_decision IS NULL THEN 1 END) as ignored,
  AVG(ai_confidence) as avg_confidence,
  AVG(processing_time_ms) as avg_processing_time
FROM ai_audit_log
GROUP BY DATE_TRUNC('day', request_timestamp)
ORDER BY date DESC;

-- Tool Usage View
CREATE OR REPLACE VIEW ai_tool_usage AS
SELECT 
  tool_name,
  COUNT(*) as usage_count,
  AVG(ai_confidence) as avg_confidence,
  COUNT(CASE WHEN user_decision = 'accept' THEN 1 END)::float / NULLIF(COUNT(*), 0) as accept_rate,
  AVG(processing_time_ms) as avg_processing_time
FROM ai_audit_log
WHERE tool_name IS NOT NULL
GROUP BY tool_name
ORDER BY usage_count DESC;

-- Override Analysis View
CREATE OR REPLACE VIEW ai_override_analysis AS
SELECT 
  o.wp_decision,
  COUNT(*) as count,
  AVG(o.ai_confidence) as avg_original_confidence,
  COUNT(CASE WHEN LENGTH(o.wp_reasoning) > 50 THEN 1 END) as with_detailed_reasoning
FROM ai_override_log o
GROUP BY o.wp_decision;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_ai_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM ai_analysis_cache
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get AI statistics for a period
CREATE OR REPLACE FUNCTION get_ai_statistics(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  total_interactions BIGINT,
  accept_count BIGINT,
  reject_count BIGINT,
  modify_count BIGINT,
  ignore_count BIGINT,
  avg_confidence NUMERIC,
  override_rate NUMERIC,
  low_confidence_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_interactions,
    COUNT(CASE WHEN user_decision = 'accept' THEN 1 END)::BIGINT as accept_count,
    COUNT(CASE WHEN user_decision = 'reject' THEN 1 END)::BIGINT as reject_count,
    COUNT(CASE WHEN user_decision = 'modify' THEN 1 END)::BIGINT as modify_count,
    COUNT(CASE WHEN user_decision = 'ignore' OR user_decision IS NULL THEN 1 END)::BIGINT as ignore_count,
    AVG(ai_confidence)::NUMERIC as avg_confidence,
    (COUNT(CASE WHEN user_decision IN ('reject', 'modify') THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0))::NUMERIC as override_rate,
    COUNT(CASE WHEN ai_confidence < 0.65 THEN 1 END)::BIGINT as low_confidence_count
  FROM ai_audit_log
  WHERE request_timestamp >= p_start_date
    AND request_timestamp <= p_end_date;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SEED DATA: HGB Knowledge Base
-- =====================================================

INSERT INTO hgb_knowledge_base (paragraph, title, content, category, related_paragraphs) VALUES
('§ 290 HGB', 'Pflicht zur Aufstellung', 
'(1) Die gesetzlichen Vertreter einer Kapitalgesellschaft (Mutterunternehmen) mit Sitz im Inland haben in den ersten fünf Monaten des Konzerngeschäftsjahrs für das vergangene Konzerngeschäftsjahr einen Konzernabschluss und einen Konzernlagebericht aufzustellen, wenn diese auf ein anderes Unternehmen (Tochterunternehmen) unmittelbar oder mittelbar einen beherrschenden Einfluss ausüben kann.',
'Konsolidierung', ARRAY['§ 291 HGB', '§ 292 HGB', '§ 293 HGB']),

('§ 300 HGB', 'Konsolidierungsgrundsätze, Vollständigkeitsgebot',
'(1) In den Konzernabschluss sind das Mutterunternehmen und alle Tochterunternehmen ohne Rücksicht auf den Sitz der Tochterunternehmen einzubeziehen, sofern die Einbeziehung nicht nach § 296 unterbleibt. (2) Die Vermögensgegenstände, Schulden und Rechnungsabgrenzungsposten sowie die Erträge und Aufwendungen der in den Konzernabschluss einbezogenen Unternehmen sind vollständig aufzunehmen.',
'Konsolidierung', ARRAY['§ 296 HGB', '§ 301 HGB']),

('§ 301 HGB', 'Kapitalkonsolidierung',
'(1) Der Wertansatz der dem Mutterunternehmen gehörenden Anteile an einem in den Konzernabschluss einbezogenen Tochterunternehmen wird mit dem auf diese Anteile entfallenden Betrag des Eigenkapitals des Tochterunternehmens verrechnet.',
'Konsolidierung', ARRAY['§ 300 HGB', '§ 302 HGB', '§ 309 HGB']),

('§ 303 HGB', 'Schuldenkonsolidierung',
'(1) Ausleihungen und andere Forderungen, Rückstellungen und Verbindlichkeiten zwischen den in den Konzernabschluss einbezogenen Unternehmen sowie entsprechende Rechnungsabgrenzungsposten sind wegzulassen. (2) Absatz 1 braucht nicht angewendet zu werden, wenn die wegzulassenden Beträge für die Vermittlung eines den tatsächlichen Verhältnissen entsprechenden Bildes der Vermögens-, Finanz- und Ertragslage des Konzerns nur von untergeordneter Bedeutung sind.',
'Konsolidierung', ARRAY['§ 304 HGB', '§ 305 HGB']),

('§ 304 HGB', 'Behandlung der Zwischenergebnisse',
'(1) In den Konzernabschluss zu übernehmende Vermögensgegenstände, die ganz oder teilweise auf Lieferungen oder Leistungen zwischen in den Konzernabschluss einbezogenen Unternehmen beruhen, sind mit einem Betrag anzusetzen, zu dem sie in der auf den Stichtag des Konzernabschlusses aufgestellten Jahresbilanz dieses Unternehmens angesetzt werden könnten, wenn die in den Konzernabschluss einbezogenen Unternehmen auch rechtlich ein einziges Unternehmen bilden würden.',
'Konsolidierung', ARRAY['§ 303 HGB', '§ 305 HGB']),

('§ 305 HGB', 'Aufwands- und Ertragskonsolidierung',
'(1) In der Konzern-Gewinn- und Verlustrechnung sind 1. bei den Umsatzerlösen die Erlöse aus Lieferungen und Leistungen zwischen den in den Konzernabschluss einbezogenen Unternehmen mit den auf sie entfallenden Aufwendungen zu verrechnen, soweit sie nicht als Erhöhung des Bestands an fertigen und unfertigen Erzeugnissen oder als andere aktivierte Eigenleistungen auszuweisen sind, 2. andere Erträge aus Lieferungen und Leistungen zwischen den in den Konzernabschluss einbezogenen Unternehmen mit den auf sie entfallenden Aufwendungen zu verrechnen.',
'Konsolidierung', ARRAY['§ 303 HGB', '§ 304 HGB']),

('§ 309 HGB', 'Behandlung des Unterschiedsbetrags',
'(1) Ein nach § 301 Abs. 3 auf der Aktivseite auszuweisender Unterschiedsbetrag ist in jedem folgenden Geschäftsjahr zu mindestens einem Viertel durch Abschreibungen zu tilgen. (2) Der Unterschiedsbetrag darf auch planmäßig abgeschrieben werden; die Abschreibungsdauer darf jedoch fünf Jahre nur überschreiten, wenn ein längerer Zeitraum, der 10 Jahre nicht überschreiten darf, dem voraussichtlichen Nutzungszeitraum entspricht.',
'Konsolidierung', ARRAY['§ 301 HGB'])

ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- GRANTS (if using RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE ai_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_override_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_sessions ENABLE ROW LEVEL SECURITY;

-- Policies (users can only see their own data)
CREATE POLICY "Users can view own audit logs" ON ai_audit_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own audit logs" ON ai_audit_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own audit logs" ON ai_audit_log
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own overrides" ON ai_override_log
  FOR SELECT USING (auth.uid() = wp_user_id);

CREATE POLICY "Users can insert own overrides" ON ai_override_log
  FOR INSERT WITH CHECK (auth.uid() = wp_user_id);

CREATE POLICY "Users can manage own sessions" ON ai_agent_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Grant access to service role for backend
GRANT ALL ON ai_audit_log TO service_role;
GRANT ALL ON ai_override_log TO service_role;
GRANT ALL ON ai_agent_sessions TO service_role;
GRANT ALL ON ai_tool_executions TO service_role;
GRANT ALL ON ai_batch_operations TO service_role;
GRANT ALL ON hgb_knowledge_base TO service_role;
GRANT ALL ON ai_analysis_cache TO service_role;

-- Grant read access to authenticated users for HGB knowledge
GRANT SELECT ON hgb_knowledge_base TO authenticated;
