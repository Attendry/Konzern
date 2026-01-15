-- =====================================================
-- HGB Legal Awareness - Seed Data
-- Initial data for legal awareness feature
-- =====================================================

-- Update existing HGB knowledge base entries with enhanced fields
UPDATE hgb_knowledge_base
SET 
  full_reference = paragraph,
  content_summary = LEFT(content, 200),
  content_full = content,
  consolidation_relevance = CASE paragraph
    WHEN '§ 290 HGB' THEN 'Grundlegende Bestimmung zur Konsolidierungspflicht. Bestimmt, wann ein Konzernabschluss aufgestellt werden muss.'
    WHEN '§ 300 HGB' THEN 'Vollständigkeitsgebot für die Konsolidierung. Alle Tochterunternehmen müssen einbezogen werden, sofern keine Ausnahme greift.'
    WHEN '§ 301 HGB' THEN 'Kapitalkonsolidierung eliminiert die Beteiligung gegen Eigenkapital. Grundlage für die Behandlung von Goodwill und passiven Unterschiedsbeträgen.'
    WHEN '§ 303 HGB' THEN 'Schuldenkonsolidierung eliminiert konzerninterne Forderungen und Verbindlichkeiten. Kritisch für IC-Abstimmungen.'
    WHEN '§ 304 HGB' THEN 'Behandlung von Zwischenergebnissen in Vorräten und Anlagen. Eliminiert unrealisierte Gewinne aus konzerninternen Transaktionen.'
    WHEN '§ 305 HGB' THEN 'Aufwands- und Ertragskonsolidierung eliminiert konzerninterne Umsatzerlöse und Aufwendungen.'
    WHEN '§ 309 HGB' THEN 'Regelt die planmäßige Abschreibung des Geschäftswerts (Goodwill) über maximal 10 Jahre.'
    ELSE 'Relevante Bestimmung für die Konzernrechnungslegung nach HGB.'
  END,
  effective_date = '2021-01-01', -- DiRUG effective date
  is_current = true,
  verified_date = CURRENT_DATE,
  verified_by = 'System',
  tags = CASE paragraph
    WHEN '§ 290 HGB' THEN ARRAY['Konsolidierungspflicht', 'Mutterunternehmen']
    WHEN '§ 300 HGB' THEN ARRAY['Vollständigkeitsgebot', 'Konsolidierungskreis']
    WHEN '§ 301 HGB' THEN ARRAY['Kapitalkonsolidierung', 'Eigenkapital', 'Goodwill']
    WHEN '§ 303 HGB' THEN ARRAY['Schuldenkonsolidierung', 'IC', 'Forderungen', 'Verbindlichkeiten']
    WHEN '§ 304 HGB' THEN ARRAY['Zwischenergebnisse', 'Vorräte', 'Anlagen']
    WHEN '§ 305 HGB' THEN ARRAY['Aufwandskonsolidierung', 'Ertragskonsolidierung', 'Umsatzerlöse']
    WHEN '§ 309 HGB' THEN ARRAY['Geschäftswert', 'Goodwill', 'Abschreibung']
    ELSE ARRAY['Konsolidierung']
  END,
  source_reference = 'BGBl. I 2021, S. 3338',
  source_url = 'https://www.gesetze-im-internet.de/hgb/__' || REPLACE(REPLACE(paragraph, '§ ', ''), ' HGB', '') || '.html'
WHERE paragraph IN ('§ 290 HGB', '§ 300 HGB', '§ 301 HGB', '§ 303 HGB', '§ 304 HGB', '§ 305 HGB', '§ 309 HGB');

-- Add additional relevant HGB paragraphs (only if they don't exist)
INSERT INTO hgb_knowledge_base (
  paragraph, full_reference, title, content, content_summary, content_full, 
  consolidation_relevance, category, subcategory, effective_date, is_current,
  verified_date, verified_by, source_reference, source_url, tags, related_paragraphs
)
SELECT * FROM (VALUES
  (
    '§ 306 HGB'::TEXT, '§ 306 HGB'::TEXT, 'Steuerabgrenzung'::TEXT,
    '(1) Steueraufwendungen und Steuererträge sind in der Konzern-Gewinn- und Verlustrechnung so auszuweisen, als ob die in den Konzernabschluss einbezogenen Unternehmen ein einziges Unternehmen wären. (2) Hierbei sind insbesondere die Auswirkungen von Zwischenergebnissen und von Unterschieden zwischen den handelsrechtlichen und steuerlichen Wertansätzen zu berücksichtigen.'::TEXT,
    'Steuerabgrenzung im Konzernabschluss. Berücksichtigung von Zwischenergebnissen und Bewertungsunterschieden zwischen Handels- und Steuerrecht.'::TEXT,
    '(1) Steueraufwendungen und Steuererträge sind in der Konzern-Gewinn- und Verlustrechnung so auszuweisen, als ob die in den Konzernabschluss einbezogenen Unternehmen ein einziges Unternehmen wären. (2) Hierbei sind insbesondere die Auswirkungen von Zwischenergebnissen und von Unterschieden zwischen den handelsrechtlichen und steuerlichen Wertansätzen zu berücksichtigen.'::TEXT,
    'Relevante Bestimmung für die Behandlung von Steuerabgrenzungsposten im Konzernabschluss. Besonders wichtig bei Zwischenergebnissen und Bewertungsunterschieden.'::TEXT,
    'Konsolidierung'::TEXT, 'Steuern'::TEXT,
    '2021-01-01'::DATE, true, CURRENT_DATE, 'System'::TEXT,
    'BGBl. I 2021, S. 3338'::TEXT,
    'https://www.gesetze-im-internet.de/hgb/__306.html'::TEXT,
    ARRAY['Steuerabgrenzung', 'Zwischenergebnisse', 'Steuern']::TEXT[],
    ARRAY['§ 304 HGB', '§ 305 HGB']::TEXT[]
  ),
  (
    '§ 307 HGB'::TEXT, '§ 307 HGB'::TEXT, 'Anteile anderer Gesellschafter'::TEXT,
    '(1) Auf die Anteile anderer Gesellschafter an einem in den Konzernabschluss einbezogenen Tochterunternehmen entfallende Beträge des Eigenkapitals und des Jahresergebnisses sind gesondert auszuweisen. (2) Die Anteile anderer Gesellschafter am Eigenkapital sind in der Konzernbilanz als "Anteile anderer Gesellschafter" gesondert auszuweisen.'::TEXT,
    'Ausweis von Minderheitsanteilen (Anteile anderer Gesellschafter) im Konzernabschluss. Separate Darstellung von Eigenkapital und Ergebnisanteilen.'::TEXT,
    '(1) Auf die Anteile anderer Gesellschafter an einem in den Konzernabschluss einbezogenen Tochterunternehmen entfallende Beträge des Eigenkapitals und des Jahresergebnisses sind gesondert auszuweisen. (2) Die Anteile anderer Gesellschafter am Eigenkapital sind in der Konzernbilanz als "Anteile anderer Gesellschafter" gesondert auszuweisen.'::TEXT,
    'Kritische Bestimmung für die Behandlung von Minderheitsanteilen. Bestimmt, wie nicht vollständig konsolidierte Tochterunternehmen dargestellt werden.'::TEXT,
    'Konsolidierung'::TEXT, 'Minderheitsanteile'::TEXT,
    '2021-01-01'::DATE, true, CURRENT_DATE, 'System'::TEXT,
    'BGBl. I 2021, S. 3338'::TEXT,
    'https://www.gesetze-im-internet.de/hgb/__307.html'::TEXT,
    ARRAY['Minderheitsanteile', 'Anteile anderer Gesellschafter', 'Eigenkapital']::TEXT[],
    ARRAY['§ 301 HGB']::TEXT[]
  ),
  (
    '§ 308a HGB'::TEXT, '§ 308a HGB'::TEXT, 'Währungsumrechnung'::TEXT,
    '(1) Bei der Aufstellung des Konzernabschlusses sind die auf fremde Währungen lautenden Vermögensgegenstände, Schulden, Rechnungsabgrenzungsposten sowie Aufwendungen und Erträge in Euro umzurechnen. (2) Die Umrechnung erfolgt zum Stichtagskurs für die Bilanzposten und zum Durchschnittskurs für die GuV-Posten.'::TEXT,
    'Währungsumrechnung im Konzernabschluss. Stichtagskurs für Bilanz, Durchschnittskurs für GuV.'::TEXT,
    '(1) Bei der Aufstellung des Konzernabschlusses sind die auf fremde Währungen lautenden Vermögensgegenstände, Schulden, Rechnungsabgrenzungsposten sowie Aufwendungen und Erträge in Euro umzurechnen. (2) Die Umrechnung erfolgt zum Stichtagskurs für die Bilanzposten und zum Durchschnittskurs für die GuV-Posten.'::TEXT,
    'Relevante Bestimmung für die Konsolidierung ausländischer Tochterunternehmen. Regelt die Umrechnung von Fremdwährungsabschlüssen.'::TEXT,
    'Konsolidierung'::TEXT, 'Währungsumrechnung'::TEXT,
    '2021-01-01'::DATE, true, CURRENT_DATE, 'System'::TEXT,
    'BGBl. I 2021, S. 3338'::TEXT,
    'https://www.gesetze-im-internet.de/hgb/__308a.html'::TEXT,
    ARRAY['Währungsumrechnung', 'Fremdwährung', 'Stichtagskurs', 'Durchschnittskurs']::TEXT[],
    ARRAY['§ 300 HGB']::TEXT[]
  ),
  (
    '§ 312 HGB'::TEXT, '§ 312 HGB'::TEXT, 'Assoziierte Unternehmen'::TEXT,
    '(1) Assoziierte Unternehmen sind nach der Equity-Methode zu bewerten. (2) Der Unterschiedsbetrag aus der Erstkonsolidierung ist analog zu § 309 HGB abzuschreiben.'::TEXT,
    'Behandlung assoziierter Unternehmen nach der Equity-Methode. Bewertung von Beteiligungen mit erheblichem Einfluss.'::TEXT,
    '(1) Assoziierte Unternehmen sind nach der Equity-Methode zu bewerten. (2) Der Unterschiedsbetrag aus der Erstkonsolidierung ist analog zu § 309 HGB abzuschreiben.'::TEXT,
    'Relevante Bestimmung für die Behandlung von assoziierten Unternehmen (20-50% Beteiligung). Alternative zur Vollkonsolidierung.'::TEXT,
    'Konsolidierung'::TEXT, 'Assoziierte Unternehmen'::TEXT,
    '2021-01-01'::DATE, true, CURRENT_DATE, 'System'::TEXT,
    'BGBl. I 2021, S. 3338'::TEXT,
    'https://www.gesetze-im-internet.de/hgb/__312.html'::TEXT,
    ARRAY['Assoziierte Unternehmen', 'Equity-Methode', 'Beteiligungen']::TEXT[],
    ARRAY['§ 301 HGB', '§ 309 HGB']::TEXT[]
  )
) AS v(paragraph, full_reference, title, content, content_summary, content_full, 
       consolidation_relevance, category, subcategory, effective_date, is_current,
       verified_date, verified_by, source_reference, source_url, tags, related_paragraphs)
WHERE NOT EXISTS (
  SELECT 1 FROM hgb_knowledge_base 
  WHERE hgb_knowledge_base.paragraph = v.paragraph
);

-- Insert IDW Standards relevant to consolidation (only if they don't exist)
INSERT INTO idw_standards (
  standard_id, title, summary, key_points, version, effective_date, is_current,
  verified_date, source_url, related_hgb_paragraphs
)
SELECT * FROM (VALUES
  (
    'IDW RS HFA 2'::TEXT,
    'Grundsätze ordnungsmäßiger Konzernrechnungslegung'::TEXT,
    'Richtlinie zur ordnungsmäßigen Aufstellung von Konzernabschlüssen nach HGB. Enthält Auslegungshinweise zu den HGB-Bestimmungen.'::TEXT,
    ARRAY[
      'Vollständigkeitsgebot nach § 300 HGB ist strikt zu beachten',
      'Kapitalkonsolidierung nach § 301 HGB erfordert vollständige Eliminierung',
      'Schuldenkonsolidierung nach § 303 HGB umfasst alle konzerninternen Beziehungen',
      'Zwischenergebnisse nach § 304 HGB sind vollständig zu eliminieren',
      'Geschäftswert nach § 309 HGB ist planmäßig abzuschreiben'
    ]::TEXT[],
    'Stand: 01.01.2023'::TEXT,
    '2023-01-01'::DATE,
    true,
    CURRENT_DATE,
    'https://www.idw.de'::TEXT,
    ARRAY['§ 300 HGB', '§ 301 HGB', '§ 303 HGB', '§ 304 HGB', '§ 309 HGB']::TEXT[]
  ),
  (
    'IDW RS HFA 3'::TEXT,
    'Konzernabschlussprüfung'::TEXT,
    'Richtlinie zur Prüfung von Konzernabschlüssen. Enthält Prüfungshinweise für Wirtschaftsprüfer.'::TEXT,
    ARRAY[
      'Prüfung der Konsolidierungspflicht nach § 290 HGB',
      'Prüfung der Vollständigkeit des Konsolidierungskreises',
      'Prüfung der ordnungsgemäßen Durchführung der Konsolidierungsmaßnahmen',
      'Prüfung der Behandlung von Minderheitsanteilen',
      'Prüfung der Währungsumrechnung bei ausländischen Tochterunternehmen'
    ]::TEXT[],
    'Stand: 01.01.2023'::TEXT,
    '2023-01-01'::DATE,
    true,
    CURRENT_DATE,
    'https://www.idw.de'::TEXT,
    ARRAY['§ 290 HGB', '§ 300 HGB', '§ 307 HGB', '§ 308a HGB']::TEXT[]
  ),
  (
    'IDW PS 240'::TEXT,
    'Prüfung des Konzernabschlusses und des Konzernlageberichts'::TEXT,
    'Prüfungsstandard für die Prüfung von Konzernabschlüssen nach HGB. Enthält detaillierte Prüfungshandlungen.'::TEXT,
    ARRAY[
      'Prüfung der Konsolidierungsgrundsätze',
      'Prüfung der IC-Abstimmungen und Eliminierungen',
      'Prüfung der Behandlung von Zwischenergebnissen',
      'Prüfung der Goodwill-Abschreibung',
      'Prüfung der Angaben im Konzernanhang'
    ]::TEXT[],
    'Stand: 01.01.2024'::TEXT,
    '2024-01-01'::DATE,
    true,
    CURRENT_DATE,
    'https://www.idw.de'::TEXT,
    ARRAY['§ 301 HGB', '§ 303 HGB', '§ 304 HGB', '§ 309 HGB']::TEXT[]
  )
) AS v(standard_id, title, summary, key_points, version, effective_date, is_current,
       verified_date, source_url, related_hgb_paragraphs)
WHERE NOT EXISTS (
  SELECT 1 FROM idw_standards 
  WHERE idw_standards.standard_id = v.standard_id 
    AND idw_standards.is_current = true
);

-- Update related_paragraphs in existing entries
UPDATE hgb_knowledge_base
SET related_paragraphs = ARRAY['§ 301 HGB', '§ 303 HGB', '§ 304 HGB']
WHERE paragraph = '§ 300 HGB';

UPDATE hgb_knowledge_base
SET related_paragraphs = ARRAY['§ 300 HGB', '§ 302 HGB', '§ 309 HGB']
WHERE paragraph = '§ 301 HGB';

UPDATE hgb_knowledge_base
SET related_paragraphs = ARRAY['§ 304 HGB', '§ 305 HGB']
WHERE paragraph = '§ 303 HGB';

UPDATE hgb_knowledge_base
SET related_paragraphs = ARRAY['§ 303 HGB', '§ 305 HGB']
WHERE paragraph = '§ 304 HGB';

UPDATE hgb_knowledge_base
SET related_paragraphs = ARRAY['§ 303 HGB', '§ 304 HGB']
WHERE paragraph = '§ 305 HGB';

UPDATE hgb_knowledge_base
SET related_paragraphs = ARRAY['§ 301 HGB']
WHERE paragraph = '§ 309 HGB';

-- Update related_idw_standards
UPDATE hgb_knowledge_base
SET related_idw_standards = ARRAY['IDW RS HFA 2', 'IDW PS 240']
WHERE paragraph IN ('§ 300 HGB', '§ 301 HGB', '§ 303 HGB', '§ 304 HGB', '§ 309 HGB');

UPDATE hgb_knowledge_base
SET related_idw_standards = ARRAY['IDW RS HFA 3']
WHERE paragraph IN ('§ 290 HGB', '§ 307 HGB', '§ 308a HGB');

-- Example: Add a recent legislative change (DiRUG - Digitalisierung)
-- This is an example - in production, these would be added as real changes occur
INSERT INTO hgb_legislative_changes (
  paragraph, change_type, announced_date, effective_date,
  change_summary, change_details, impact_on_consolidation,
  law_name, source_reference, source_url, status, notify_users
)
SELECT * FROM (VALUES
  (
    '§ 290 HGB'::TEXT,
    'clarification'::TEXT,
    '2021-12-15'::DATE,
    '2022-01-01'::DATE,
    'Klarstellung zur elektronischen Übermittlung von Konzernabschlüssen'::TEXT,
    'Durch das DiRUG wurde klargestellt, dass Konzernabschlüsse auch elektronisch übermittelt werden können. Die Aufbewahrungspflichten bleiben unverändert.'::TEXT,
    'Keine Auswirkung auf die Konsolidierungsmethodik. Betrifft nur die Übermittlung und Aufbewahrung.'::TEXT,
    'DiRUG'::TEXT,
    'BGBl. I 2021, S. 3338'::TEXT,
    'https://www.bgbl.de/xaver/bgbl/start.xav?startbk=Bundesanzeiger_BGBl&start=//*[@attr_id="bgbl121s3338.pdf"]'::TEXT,
    'effective'::TEXT,
    true
  )
) AS v(paragraph, change_type, announced_date, effective_date,
       change_summary, change_details, impact_on_consolidation,
       law_name, source_reference, source_url, status, notify_users)
WHERE NOT EXISTS (
  SELECT 1 FROM hgb_legislative_changes 
  WHERE hgb_legislative_changes.paragraph = v.paragraph
    AND hgb_legislative_changes.change_type = v.change_type
    AND hgb_legislative_changes.effective_date = v.effective_date
);

-- Create a function to update related_idw_standards based on related_hgb_paragraphs
-- This helps maintain referential integrity
CREATE OR REPLACE FUNCTION update_idw_related_paragraphs()
RETURNS TRIGGER AS $$
BEGIN
  -- When an IDW standard is updated, ensure related HGB paragraphs reference it
  IF NEW.related_hgb_paragraphs IS NOT NULL THEN
    UPDATE hgb_knowledge_base
    SET related_idw_standards = array_append(
      COALESCE(related_idw_standards, ARRAY[]::TEXT[]),
      NEW.standard_id
    )
    WHERE paragraph = ANY(NEW.related_hgb_paragraphs)
      AND NOT (NEW.standard_id = ANY(COALESCE(related_idw_standards, ARRAY[]::TEXT[])));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to maintain referential integrity
DROP TRIGGER IF EXISTS trigger_update_idw_related ON idw_standards;
CREATE TRIGGER trigger_update_idw_related
  AFTER INSERT OR UPDATE ON idw_standards
  FOR EACH ROW
  WHEN (NEW.is_current = true)
  EXECUTE FUNCTION update_idw_related_paragraphs();

-- Create a view for easy access to current legal context
CREATE OR REPLACE VIEW v_current_hgb_legal_context AS
SELECT 
  h.paragraph,
  h.full_reference,
  h.title,
  h.content_summary,
  h.consolidation_relevance,
  h.category,
  h.tags,
  h.related_paragraphs,
  h.related_idw_standards,
  h.source_url,
  h.verified_date,
  -- Count upcoming changes
  (SELECT COUNT(*) 
   FROM hgb_legislative_changes c 
   WHERE c.paragraph = h.paragraph 
     AND c.status = 'upcoming'
     AND c.effective_date >= CURRENT_DATE) as upcoming_changes_count,
  -- Count recent changes (last 12 months)
  (SELECT COUNT(*) 
   FROM hgb_legislative_changes c 
   WHERE c.paragraph = h.paragraph 
     AND c.status = 'effective'
     AND c.effective_date >= CURRENT_DATE - INTERVAL '12 months') as recent_changes_count
FROM hgb_knowledge_base h
WHERE h.is_current = true;

-- Grant access to the view
GRANT SELECT ON v_current_hgb_legal_context TO authenticated;
GRANT SELECT ON v_current_hgb_legal_context TO service_role;

-- Add comments for documentation
COMMENT ON TABLE hgb_legislative_changes IS 'Tracks legislative changes to HGB paragraphs relevant to consolidation';
COMMENT ON TABLE idw_standards IS 'IDW standards and pronouncements relevant to consolidation';
COMMENT ON TABLE user_legal_content_views IS 'Tracks which legal content users have viewed for change alert purposes';
COMMENT ON VIEW v_current_hgb_legal_context IS 'Current HGB legal context with change counts for easy access';
