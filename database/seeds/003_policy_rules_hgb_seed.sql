-- =============================================
-- Seed: Default HGB Accounting Policies and Consolidation Rules
-- Pre-configured policies, rules, and Wahlrechte for German GAAP (HGB)
-- =============================================

-- =============================================
-- 1. ACCOUNTING POLICIES (Bilanzierungsmethoden)
-- =============================================

-- Kapitalkonsolidierung Policy
INSERT INTO accounting_policies (code, name, description, category, hgb_reference, hgb_section, is_hgb_mandatory, policy_text, effective_date, status)
VALUES 
(
    'POL-CAP-001',
    'Kapitalkonsolidierung - Neubewertungsmethode',
    'Bilanzierung der Kapitalkonsolidierung nach der Neubewertungsmethode gemäß § 301 Abs. 1 HGB',
    'consolidation',
    '§ 301 HGB',
    'Die Kapitalkonsolidierung erfolgt nach der Neubewertungsmethode. Der Buchwert der dem Mutterunternehmen gehörenden Anteile wird mit dem auf diese Anteile entfallenden Betrag des Eigenkapitals des Tochterunternehmens verrechnet.',
    true,
    'Die Kapitalkonsolidierung erfolgt nach der Neubewertungsmethode gemäß § 301 Abs. 1 HGB. Der Unterschiedsbetrag zwischen dem Buchwert der Beteiligung und dem anteiligen Eigenkapital wird wie folgt behandelt:

1. **Stille Reserven und Lasten**: Zunächst werden stille Reserven und Lasten aufgedeckt und den entsprechenden Vermögensgegenständen und Schulden zugeordnet.

2. **Geschäfts- oder Firmenwert**: Ein verbleibender aktivischer Unterschiedsbetrag wird als Geschäfts- oder Firmenwert aktiviert und planmäßig über die voraussichtliche Nutzungsdauer (maximal 10 Jahre) abgeschrieben.

3. **Passiver Unterschiedsbetrag**: Ein passivischer Unterschiedsbetrag wird unter den Rückstellungen ausgewiesen und bei Realisierung ertragswirksam aufgelöst.

4. **Zeitpunkt**: Die Kapitalkonsolidierung erfolgt zum Zeitpunkt des Erwerbs der Anteile.',
    '2020-01-01',
    'active'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    policy_text = EXCLUDED.policy_text,
    status = EXCLUDED.status;

-- Schuldenkonsolidierung Policy
INSERT INTO accounting_policies (code, name, description, category, hgb_reference, hgb_section, is_hgb_mandatory, policy_text, effective_date, status)
VALUES 
(
    'POL-DEB-001',
    'Schuldenkonsolidierung',
    'Eliminierung konzerninterner Forderungen und Verbindlichkeiten gemäß § 303 HGB',
    'consolidation',
    '§ 303 HGB',
    'Forderungen und Verbindlichkeiten zwischen konsolidierten Unternehmen sind wegzulassen.',
    true,
    'Die Schuldenkonsolidierung erfolgt gemäß § 303 HGB durch vollständige Eliminierung aller konzerninternen Forderungen und Verbindlichkeiten:

1. **Forderungen und Verbindlichkeiten**: Alle Forderungen und Verbindlichkeiten zwischen vollkonsolidierten Unternehmen werden vollständig eliminiert.

2. **Aufrechnungsdifferenzen**: Entstehen bei der Aufrechnung Unterschiedsbeträge, werden diese analysiert:
   - Bei zeitlichen Differenzen: Ausweis als Aktiver/Passiver Rechnungsabgrenzungsposten
   - Bei Bewertungsdifferenzen: Ergebniswirksame Auflösung oder Anpassung der Bewertung

3. **Dokumentation**: Alle IC-Transaktionen werden dokumentiert und abgestimmt.',
    '2020-01-01',
    'active'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    policy_text = EXCLUDED.policy_text,
    status = EXCLUDED.status;

-- Zwischenergebniseliminierung Policy
INSERT INTO accounting_policies (code, name, description, category, hgb_reference, hgb_section, is_hgb_mandatory, policy_text, effective_date, status)
VALUES 
(
    'POL-ICP-001',
    'Zwischenergebniseliminierung',
    'Eliminierung von Zwischenergebnissen aus konzerninternen Lieferungen gemäß § 304 HGB',
    'consolidation',
    '§ 304 HGB',
    'Vermögensgegenstände, die auf Lieferungen oder Leistungen zwischen konsolidierten Unternehmen beruhen, sind mit dem Betrag anzusetzen, zu dem sie ohne die Zwischenergebnisse angesetzt werden könnten.',
    true,
    'Die Zwischenergebniseliminierung erfolgt gemäß § 304 HGB:

1. **Erfassung**: Alle Vermögensgegenstände, die ganz oder teilweise auf konzerninternen Lieferungen oder Leistungen beruhen, werden identifiziert.

2. **Eliminierung**: Die in diesen Vermögensgegenständen enthaltenen Zwischenergebnisse werden eliminiert, soweit sie nicht durch eine Abwertung bereits reduziert wurden.

3. **Umfang**: Die Eliminierung erfolgt grundsätzlich in voller Höhe des Zwischenergebnisses (nicht nur anteilig entsprechend der Beteiligungsquote).

4. **Latente Steuern**: Auf temporäre Differenzen aus der Zwischenergebniseliminierung werden latente Steuern gemäß § 306 HGB gebildet.',
    '2020-01-01',
    'active'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    policy_text = EXCLUDED.policy_text,
    status = EXCLUDED.status;

-- Aufwands- und Ertragskonsolidierung Policy
INSERT INTO accounting_policies (code, name, description, category, hgb_reference, hgb_section, is_hgb_mandatory, policy_text, effective_date, status)
VALUES 
(
    'POL-IEC-001',
    'Aufwands- und Ertragskonsolidierung',
    'Eliminierung konzerninterner Erträge und Aufwendungen gemäß § 305 HGB',
    'consolidation',
    '§ 305 HGB',
    'Innenumsätze sowie andere Erträge aus Lieferungen und Leistungen zwischen konsolidierten Unternehmen sind mit den auf sie entfallenden Aufwendungen zu verrechnen.',
    true,
    'Die Aufwands- und Ertragskonsolidierung erfolgt gemäß § 305 HGB:

1. **Umsatzerlöse**: Alle konzerninternen Umsatzerlöse werden mit den korrespondierenden Aufwendungen verrechnet.

2. **Sonstige Erträge**: Andere konzerninterne Erträge (z.B. Zinsen, Mieten, Lizenzen) werden ebenfalls eliminiert.

3. **Ergebnisauswirkung**: Die Konsolidierung ist ergebnisneutral, sofern Erträge und Aufwendungen sich ausgleichen.

4. **Dokumentation**: Die konzerninternen Transaktionen werden im IC-Abstimmungsprozess dokumentiert.',
    '2020-01-01',
    'active'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    policy_text = EXCLUDED.policy_text,
    status = EXCLUDED.status;

-- Latente Steuern Policy
INSERT INTO accounting_policies (code, name, description, category, hgb_reference, hgb_section, is_hgb_mandatory, policy_text, effective_date, status)
VALUES 
(
    'POL-DTX-001',
    'Latente Steuern auf Konsolidierungsmaßnahmen',
    'Bildung latenter Steuern auf temporäre Differenzen aus Konsolidierungsmaßnahmen gemäß § 306 HGB',
    'deferred_tax',
    '§ 306 HGB',
    'Auf Differenzen, die aus dem Wegfall von Zwischenergebnissen oder aus Konsolidierungsmaßnahmen resultieren und die sich in späteren Geschäftsjahren voraussichtlich abbauen, sind latente Steuern anzusetzen.',
    true,
    'Latente Steuern auf Konsolidierungsmaßnahmen werden gemäß § 306 HGB wie folgt gebildet:

1. **Ansatzpflicht**: Auf alle temporären Differenzen aus Konsolidierungsmaßnahmen sind latente Steuern zu bilden.

2. **Steuersatz**: Es wird der zum Bilanzstichtag geltende Steuersatz des jeweiligen Landes verwendet (für Deutschland ca. 30% als Gesamtbelastung).

3. **Quellen**:
   - Zwischenergebniseliminierung
   - Schuldenkonsolidierung
   - Kapitalkonsolidierung (Aufdeckung stiller Reserven)
   - Einheitliche Bewertung

4. **Saldierung**: Aktive und passive latente Steuern werden gemäß § 306 Satz 2 HGB saldiert ausgewiesen.',
    '2020-01-01',
    'active'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    policy_text = EXCLUDED.policy_text,
    status = EXCLUDED.status;

-- Minderheitenanteile Policy
INSERT INTO accounting_policies (code, name, description, category, hgb_reference, hgb_section, is_hgb_mandatory, policy_text, effective_date, status)
VALUES 
(
    'POL-MIN-001',
    'Minderheitenanteile',
    'Ausweis der Anteile anderer Gesellschafter gemäß § 307 HGB',
    'consolidation',
    '§ 307 HGB',
    'Das auf die anderen Gesellschafter entfallende anteilige Eigenkapital ist als Ausgleichsposten für Anteile anderer Gesellschafter gesondert auszuweisen.',
    true,
    'Minderheitenanteile werden gemäß § 307 HGB wie folgt behandelt:

1. **Ausweis Eigenkapital**: Der auf andere Gesellschafter entfallende Anteil am Eigenkapital wird als separater Posten im Konzerneigenkapital ausgewiesen.

2. **Ausweis GuV**: Der auf andere Gesellschafter entfallende Anteil am Jahresergebnis wird in der Konzern-GuV unter "Anderen Gesellschaftern zustehendes Ergebnis" ausgewiesen.

3. **Berechnung**: Die Minderheitenanteile werden auf Basis der aktuellen Beteiligungsquoten und des anteiligen Eigenkapitals des Tochterunternehmens berechnet.

4. **Verlustüberschuss**: Ein auf Minderheiten entfallender Verlust, der deren Anteil übersteigt, wird zunächst dem Konzern zugeordnet.',
    '2020-01-01',
    'active'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    policy_text = EXCLUDED.policy_text,
    status = EXCLUDED.status;

-- Währungsumrechnung Policy
INSERT INTO accounting_policies (code, name, description, category, hgb_reference, hgb_section, is_hgb_mandatory, policy_text, effective_date, status)
VALUES 
(
    'POL-FX-001',
    'Währungsumrechnung - Modifizierte Stichtagskursmethode',
    'Umrechnung der Abschlüsse ausländischer Tochterunternehmen gemäß § 308a HGB',
    'currency',
    '§ 308a HGB',
    'Vermögensgegenstände und Schulden sind zum Devisenkassamittelkurs am Abschlussstichtag umzurechnen, Aufwendungen und Erträge zum Durchschnittskurs.',
    true,
    'Die Währungsumrechnung erfolgt gemäß § 308a HGB nach der modifizierten Stichtagskursmethode:

1. **Vermögensgegenstände und Schulden**: Umrechnung zum Devisenkassamittelkurs am Abschlussstichtag.

2. **Aufwendungen und Erträge**: Umrechnung zum Durchschnittskurs des Geschäftsjahres.

3. **Eigenkapital**: Das gezeichnete Kapital und die Rücklagen werden zu historischen Kursen umgerechnet.

4. **Umrechnungsdifferenz**: Die sich ergebende Umrechnungsdifferenz wird erfolgsneutral im Eigenkapital unter "Eigenkapitaldifferenz aus Währungsumrechnung" ausgewiesen.

5. **Wechselkurse**: Als Wechselkurse werden die EZB-Referenzkurse zum Stichtag und der gewichtete Durchschnittskurs verwendet.',
    '2020-01-01',
    'active'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    policy_text = EXCLUDED.policy_text,
    status = EXCLUDED.status;

-- =============================================
-- 2. CONSOLIDATION RULES (Konsolidierungsregeln)
-- =============================================

-- Kapitalkonsolidierung Rule
INSERT INTO consolidation_rules (code, name, description, rule_type, hgb_reference, hgb_description, flexibility, is_hgb_mandatory, rule_config, parameters, execution_order, is_active)
VALUES 
(
    'RULE-CAP-001',
    'Kapitalkonsolidierung - Erstkonsolidierung',
    'Durchführung der erstmaligen Kapitalkonsolidierung nach der Neubewertungsmethode',
    'capital_consolidation',
    '§ 301 HGB',
    'Die Wertansätze der in den Konzernabschluss aufgenommenen Vermögensgegenstände und Schulden sind nach einheitlichen Bewertungsmethoden zu bemessen.',
    'mandatory',
    true,
    '{"type": "capital_consolidation", "method": "revaluation", "goodwillAmortization": {"method": "straight_line", "maxYears": 10, "minYears": 5}}',
    '{"defaultUsefulLife": 10, "goodwillTestRequired": true}',
    10,
    true
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    rule_config = EXCLUDED.rule_config,
    parameters = EXCLUDED.parameters;

-- Folgekonsolidierung Rule
INSERT INTO consolidation_rules (code, name, description, rule_type, hgb_reference, hgb_description, flexibility, is_hgb_mandatory, rule_config, parameters, execution_order, is_active)
VALUES 
(
    'RULE-CAP-002',
    'Kapitalkonsolidierung - Folgekonsolidierung',
    'Fortführung der Kapitalkonsolidierung in den Folgejahren',
    'capital_consolidation',
    '§ 301 HGB',
    'Fortschreibung der Kapitalkonsolidierung einschließlich Goodwill-Abschreibung',
    'mandatory',
    true,
    '{"type": "capital_consolidation_followup", "method": "continuation", "actions": ["goodwill_amortization", "dividend_elimination", "equity_update"]}',
    '{"autoGoodwillAmortization": true}',
    15,
    true
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    rule_config = EXCLUDED.rule_config,
    parameters = EXCLUDED.parameters;

-- Schuldenkonsolidierung Rule
INSERT INTO consolidation_rules (code, name, description, rule_type, hgb_reference, hgb_description, flexibility, is_hgb_mandatory, rule_config, parameters, execution_order, is_active)
VALUES 
(
    'RULE-DEB-001',
    'Schuldenkonsolidierung',
    'Eliminierung konzerninterner Forderungen und Verbindlichkeiten',
    'debt_consolidation',
    '§ 303 HGB',
    'Forderungen und Verbindlichkeiten zwischen konsolidierten Unternehmen sind wegzulassen.',
    'mandatory',
    true,
    '{"type": "debt_consolidation", "method": "full_elimination", "accounts": ["receivables", "payables", "loans"]}',
    '{"toleranceAmount": 0.01, "autoEliminate": true}',
    20,
    true
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    rule_config = EXCLUDED.rule_config,
    parameters = EXCLUDED.parameters;

-- Zwischenergebniseliminierung Rule
INSERT INTO consolidation_rules (code, name, description, rule_type, hgb_reference, hgb_description, flexibility, is_hgb_mandatory, rule_config, parameters, execution_order, is_active)
VALUES 
(
    'RULE-ICP-001',
    'Zwischenergebniseliminierung - Vorräte',
    'Eliminierung von Zwischenergebnissen in konzerninternen Vorräten',
    'intercompany_profit',
    '§ 304 HGB',
    'Zwischenergebnisse in konzerninternen Lieferungen sind zu eliminieren.',
    'mandatory',
    true,
    '{"type": "intercompany_profit", "assetType": "inventory", "method": "full_elimination", "affectsIncome": true}',
    '{"marginEstimate": 0.25, "materialityThreshold": 10000}',
    30,
    true
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    rule_config = EXCLUDED.rule_config,
    parameters = EXCLUDED.parameters;

-- Aufwands-/Ertragskonsolidierung Rule
INSERT INTO consolidation_rules (code, name, description, rule_type, hgb_reference, hgb_description, flexibility, is_hgb_mandatory, rule_config, parameters, execution_order, is_active)
VALUES 
(
    'RULE-IEC-001',
    'Aufwands- und Ertragskonsolidierung',
    'Eliminierung konzerninterner Erträge und Aufwendungen',
    'income_expense',
    '§ 305 HGB',
    'Innenumsätze sowie andere Erträge sind mit den korrespondierenden Aufwendungen zu verrechnen.',
    'mandatory',
    true,
    '{"type": "income_expense", "method": "full_elimination", "categories": ["revenue", "cost_of_sales", "interest", "rent", "services"]}',
    '{"autoEliminate": true}',
    40,
    true
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    rule_config = EXCLUDED.rule_config,
    parameters = EXCLUDED.parameters;

-- Latente Steuern Rule
INSERT INTO consolidation_rules (code, name, description, rule_type, hgb_reference, hgb_description, flexibility, is_hgb_mandatory, rule_config, parameters, execution_order, is_active)
VALUES 
(
    'RULE-DTX-001',
    'Latente Steuern - Konsolidierung',
    'Bildung latenter Steuern auf temporäre Differenzen aus Konsolidierungsmaßnahmen',
    'deferred_tax',
    '§ 306 HGB',
    'Auf temporäre Differenzen aus Konsolidierungsmaßnahmen sind latente Steuern anzusetzen.',
    'mandatory',
    true,
    '{"type": "deferred_tax", "sources": ["intercompany_profit", "debt_consolidation", "capital_consolidation"], "method": "liability"}',
    '{"defaultTaxRate": 30, "nettingAllowed": true}',
    50,
    true
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    rule_config = EXCLUDED.rule_config,
    parameters = EXCLUDED.parameters;

-- Minderheitenanteile Rule
INSERT INTO consolidation_rules (code, name, description, rule_type, hgb_reference, hgb_description, flexibility, is_hgb_mandatory, rule_config, parameters, execution_order, is_active)
VALUES 
(
    'RULE-MIN-001',
    'Minderheitenanteile - Berechnung',
    'Berechnung und Ausweis der Anteile anderer Gesellschafter',
    'minority_interest',
    '§ 307 HGB',
    'Das auf andere Gesellschafter entfallende anteilige Eigenkapital ist gesondert auszuweisen.',
    'mandatory',
    true,
    '{"type": "minority_interest", "calculation": "proportional", "includes": ["equity", "result"]}',
    '{"lossAbsorption": "parent_first"}',
    60,
    true
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    rule_config = EXCLUDED.rule_config,
    parameters = EXCLUDED.parameters;

-- Währungsumrechnung Rule
INSERT INTO consolidation_rules (code, name, description, rule_type, hgb_reference, hgb_description, flexibility, is_hgb_mandatory, rule_config, parameters, execution_order, is_active)
VALUES 
(
    'RULE-FX-001',
    'Währungsumrechnung',
    'Umrechnung der Abschlüsse ausländischer Tochterunternehmen',
    'currency_translation',
    '§ 308a HGB',
    'Anwendung der modifizierten Stichtagskursmethode.',
    'mandatory',
    true,
    '{"type": "currency_translation", "method": "modified_closing_rate", "balanceSheetRate": "closing", "incomeStatementRate": "average", "equityRate": "historical"}',
    '{"translationDifferenceToEquity": true}',
    5,
    true
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    rule_config = EXCLUDED.rule_config,
    parameters = EXCLUDED.parameters;

-- At-Equity Rule
INSERT INTO consolidation_rules (code, name, description, rule_type, hgb_reference, hgb_description, flexibility, is_hgb_mandatory, rule_config, parameters, execution_order, is_active)
VALUES 
(
    'RULE-EQM-001',
    'At-Equity-Bewertung',
    'Equity-Bewertung assoziierter Unternehmen',
    'equity_method',
    '§ 312 HGB',
    'Anteile an assoziierten Unternehmen sind nach der Equity-Methode zu bewerten.',
    'mandatory',
    true,
    '{"type": "equity_method", "method": "book_value", "includes": ["share_of_profit", "dividends", "goodwill_amortization"]}',
    '{"goodwillAmortizationYears": 10}',
    70,
    true
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    rule_config = EXCLUDED.rule_config,
    parameters = EXCLUDED.parameters;

-- =============================================
-- 3. HGB WAHLRECHTE (Accounting Options)
-- =============================================

-- Geschäftswert-Abschreibung
INSERT INTO hgb_wahlrechte (code, name, description, hgb_reference, hgb_section, option_type, available_options, default_option, once_chosen_binding, change_requires_disclosure, ifrs_equivalent, differences_to_ifrs)
VALUES 
(
    'WR-GW-001',
    'Nutzungsdauer des Geschäftswerts',
    'Festlegung der planmäßigen Nutzungsdauer für den Geschäfts- oder Firmenwert',
    '§ 309 Abs. 1 HGB',
    'Der Geschäfts- oder Firmenwert ist in jedem folgenden Geschäftsjahr zu mindestens einem Viertel abzuschreiben.',
    'measurement',
    '[{"value": "4_years", "label": "4 Jahre (Minimum)", "description": "Mindestabschreibung nach HGB"}, {"value": "5_years", "label": "5 Jahre"}, {"value": "10_years", "label": "10 Jahre (Maximum)", "description": "Höchstzulässige Nutzungsdauer"}, {"value": "individual", "label": "Individuelle Schätzung", "description": "Begründete individuelle Nutzungsdauer"}]',
    '5_years',
    true,
    true,
    'IAS 36, IFRS 3',
    'Nach IFRS erfolgt keine planmäßige Abschreibung, sondern ein jährlicher Impairment-Test.'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    available_options = EXCLUDED.available_options;

-- Latente Steuern Saldierung
INSERT INTO hgb_wahlrechte (code, name, description, hgb_reference, hgb_section, option_type, available_options, default_option, once_chosen_binding, change_requires_disclosure, ifrs_equivalent, differences_to_ifrs)
VALUES 
(
    'WR-DT-001',
    'Saldierung latenter Steuern',
    'Wahlrecht zur Saldierung aktiver und passiver latenter Steuern',
    '§ 306 Satz 2 HGB',
    'Ein Überschuss aktiver latenter Steuern über passive kann angesetzt werden.',
    'presentation',
    '[{"value": "netting", "label": "Saldierter Ausweis", "description": "Saldierung aktiver und passiver latenter Steuern"}, {"value": "gross", "label": "Bruttoausweis", "description": "Getrennter Ausweis aktiver und passiver latenter Steuern"}]',
    'netting',
    false,
    true,
    'IAS 12',
    'IFRS verlangt Saldierung bei gleicher Steuerbehörde und Recht auf Aufrechnung.'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    available_options = EXCLUDED.available_options;

-- Quotenkonsolidierung
INSERT INTO hgb_wahlrechte (code, name, description, hgb_reference, hgb_section, option_type, available_options, default_option, once_chosen_binding, change_requires_disclosure, ifrs_equivalent, differences_to_ifrs)
VALUES 
(
    'WR-QK-001',
    'Quotenkonsolidierung vs. At-Equity',
    'Wahlrecht bei der Einbeziehung von Gemeinschaftsunternehmen',
    '§ 310 HGB',
    'Ein Unternehmen, das ein anderes Unternehmen gemeinsam mit einem oder mehreren anderen Unternehmen führt, kann dieses anteilmäßig konsolidieren.',
    'recognition',
    '[{"value": "proportional", "label": "Quotenkonsolidierung", "description": "Anteilmäßige Einbeziehung aller Posten"}, {"value": "equity", "label": "At-Equity-Bewertung", "description": "Bewertung als assoziiertes Unternehmen"}]',
    'equity',
    true,
    true,
    'IFRS 11',
    'IFRS 11 erlaubt keine Quotenkonsolidierung mehr; nur At-Equity ist zulässig.'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    available_options = EXCLUDED.available_options;

-- Konsolidierungskreis-Wesentlichkeit
INSERT INTO hgb_wahlrechte (code, name, description, hgb_reference, hgb_section, option_type, available_options, default_option, once_chosen_binding, change_requires_disclosure, ifrs_equivalent, differences_to_ifrs)
VALUES 
(
    'WR-KK-001',
    'Einbeziehung unwesentlicher Tochterunternehmen',
    'Wahlrecht zum Verzicht auf Einbeziehung unwesentlicher Tochterunternehmen',
    '§ 296 Abs. 2 HGB',
    'Ein Tochterunternehmen braucht in den Konzernabschluss nicht einbezogen zu werden, wenn es für die Vermittlung eines den tatsächlichen Verhältnissen entsprechenden Bildes von untergeordneter Bedeutung ist.',
    'recognition',
    '[{"value": "include_all", "label": "Alle einbeziehen", "description": "Einbeziehung aller Tochterunternehmen"}, {"value": "materiality_test", "label": "Wesentlichkeitsprüfung", "description": "Ausschluss unwesentlicher Gesellschaften mit Begründung"}]',
    'materiality_test',
    false,
    true,
    'IFRS 10',
    'IFRS 10 kennt keine explizite Wesentlichkeitsgrenze für die Konsolidierung.'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    available_options = EXCLUDED.available_options;

-- =============================================
-- 4. GAAP-HGB MAPPINGS (IFRS → HGB)
-- =============================================

-- Goodwill Mapping (IFRS → HGB)
INSERT INTO gaap_hgb_mappings (code, name, description, source_gaap, source_gaap_reference, source_gaap_description, hgb_reference, hgb_description, direction, adjustment_type, adjustment_config, affects_balance_sheet, affects_income_statement, affects_deferred_tax, is_active, is_material)
VALUES 
(
    'MAP-GW-001',
    'Goodwill: IFRS → HGB',
    'Anpassung der Goodwill-Behandlung von IFRS (Impairment-only) auf HGB (planmäßige Abschreibung)',
    'ifrs',
    'IFRS 3, IAS 36',
    'Unter IFRS wird der Geschäftswert nicht planmäßig abgeschrieben, sondern einem jährlichen Impairment-Test unterzogen.',
    '§ 309 Abs. 1 HGB',
    'Der Geschäfts- oder Firmenwert ist planmäßig über die voraussichtliche Nutzungsdauer abzuschreiben.',
    'source_to_hgb',
    'measurement',
    '{"type": "amortization_adjustment", "method": "straight_line", "parameters": {"defaultUsefulLife": 10}}',
    true,
    true,
    true,
    true,
    true
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    adjustment_config = EXCLUDED.adjustment_config;

-- Leasing Mapping (IFRS → HGB)
INSERT INTO gaap_hgb_mappings (code, name, description, source_gaap, source_gaap_reference, source_gaap_description, hgb_reference, hgb_description, direction, adjustment_type, adjustment_config, affects_balance_sheet, affects_income_statement, affects_deferred_tax, is_active, is_material)
VALUES 
(
    'MAP-LS-001',
    'Leasing: IFRS 16 → HGB',
    'Anpassung der Leasingbilanzierung von IFRS 16 auf HGB',
    'ifrs',
    'IFRS 16',
    'Unter IFRS 16 werden fast alle Leasingverhältnisse in der Bilanz des Leasingnehmers als Nutzungsrecht und Leasingverbindlichkeit erfasst.',
    '§ 246 Abs. 1 HGB',
    'Nach HGB werden Operating-Leasingverhältnisse weiterhin off-balance bilanziert.',
    'source_to_hgb',
    'recognition',
    '{"type": "derecognition", "method": "reverse_ifrs16", "parameters": {"derecognizeROU": true, "derecognizeLeaseLiability": true}}',
    true,
    true,
    true,
    true,
    true
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    adjustment_config = EXCLUDED.adjustment_config;

-- Pensionsrückstellungen Mapping (IFRS → HGB)
INSERT INTO gaap_hgb_mappings (code, name, description, source_gaap, source_gaap_reference, source_gaap_description, hgb_reference, hgb_description, direction, adjustment_type, adjustment_config, affects_balance_sheet, affects_income_statement, affects_equity, affects_deferred_tax, is_active, is_material)
VALUES 
(
    'MAP-PEN-001',
    'Pensionen: IFRS → HGB',
    'Anpassung der Pensionsbewertung von IAS 19 auf HGB',
    'ifrs',
    'IAS 19',
    'IFRS verwendet den Projected Unit Credit Method und erfasst versicherungsmathematische Gewinne/Verluste im OCI.',
    '§ 253 Abs. 1 HGB',
    'HGB erlaubt Abzinsung mit dem 10-Jahres-Durchschnittszins (§ 253 Abs. 2 HGB).',
    'source_to_hgb',
    'measurement',
    '{"type": "discount_rate_adjustment", "method": "recalculate", "parameters": {"useHgbDiscountRate": true, "spreadingPeriod": 15}}',
    true,
    true,
    true,
    true,
    true,
    true
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    adjustment_config = EXCLUDED.adjustment_config;

-- =============================================
-- SEED COMPLETE
-- =============================================
