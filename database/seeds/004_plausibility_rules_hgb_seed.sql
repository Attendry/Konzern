-- =============================================
-- Seed: Default HGB Plausibility Rules
-- Pre-configured rules for German GAAP (HGB) consolidation
-- =============================================

-- =============================================
-- 1. BALANCE EQUATION CHECKS
-- =============================================

INSERT INTO plausibility_rules (code, name, description, category, severity, hgb_reference, hgb_description, rule_type, rule_expression, tolerance_amount, is_active, is_mandatory, is_hgb_required, execution_order)
VALUES 
(
    'BAL-001',
    'Bilanzgleichung',
    'Prüft, ob Aktiva = Passiva (Eigenkapital + Fremdkapital)',
    'balance_equation',
    'error',
    '§ 266 HGB',
    'Die Bilanzsumme der Aktivseite muss der Bilanzsumme der Passivseite entsprechen',
    'formula',
    '{"type": "formula", "formula": "TOTAL_ASSETS = TOTAL_LIABILITIES + TOTAL_EQUITY", "description": "Assets = Liabilities + Equity"}',
    0.01,
    true,
    true,
    true,
    10
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    hgb_reference = EXCLUDED.hgb_reference,
    hgb_description = EXCLUDED.hgb_description,
    rule_expression = EXCLUDED.rule_expression;

INSERT INTO plausibility_rules (code, name, description, category, severity, hgb_reference, hgb_description, rule_type, rule_expression, tolerance_amount, is_active, is_mandatory, is_hgb_required, execution_order)
VALUES 
(
    'BAL-002',
    'Aktiva nicht negativ',
    'Prüft, ob die Bilanzsumme der Aktiva nicht negativ ist',
    'balance_sheet_structure',
    'error',
    '§ 266 HGB',
    'Die Aktivseite kann nicht negativ sein',
    'threshold',
    '{"type": "threshold", "field": "TOTAL_ASSETS", "operator": ">=", "value": 0}',
    0,
    true,
    true,
    true,
    11
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    rule_expression = EXCLUDED.rule_expression;

-- =============================================
-- 2. CAPITAL CONSOLIDATION CHECKS (§ 301 HGB)
-- =============================================

INSERT INTO plausibility_rules (code, name, description, category, severity, hgb_reference, hgb_description, rule_type, rule_expression, threshold_absolute, is_active, is_mandatory, is_hgb_required, execution_order)
VALUES 
(
    'CAP-001',
    'Geschäftswert positiv',
    'Prüft, ob der Geschäfts- oder Firmenwert (Goodwill) nicht negativ ist. Ein negativer Unterschiedsbetrag muss als passiver Unterschiedsbetrag ausgewiesen werden.',
    'capital_consolidation',
    'warning',
    '§ 301 Abs. 3 HGB',
    'Ein passiver Unterschiedsbetrag aus der Kapitalkonsolidierung (negativer Goodwill) ist unter den Rückstellungen oder Sonderposten auszuweisen',
    'threshold',
    '{"type": "threshold", "field": "GOODWILL", "operator": ">=", "value": 0}',
    0,
    true,
    false,
    true,
    20
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    hgb_description = EXCLUDED.hgb_description,
    rule_expression = EXCLUDED.rule_expression;

INSERT INTO plausibility_rules (code, name, description, category, severity, hgb_reference, hgb_description, rule_type, rule_expression, is_active, is_mandatory, is_hgb_required, execution_order)
VALUES 
(
    'CAP-002',
    'Kapitalkonsolidierung vollständig',
    'Prüft, ob für alle vollkonsolidierten Tochterunternehmen eine Kapitalkonsolidierung durchgeführt wurde',
    'capital_consolidation',
    'error',
    '§ 301 HGB',
    'Die Kapitalkonsolidierung ist für alle vollkonsolidierten Tochterunternehmen erforderlich',
    'custom',
    '{"type": "custom", "customFunction": "checkCapitalConsolidationComplete"}',
    true,
    true,
    true,
    21
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    rule_expression = EXCLUDED.rule_expression;

INSERT INTO plausibility_rules (code, name, description, category, severity, hgb_reference, hgb_description, rule_type, rule_expression, is_active, is_mandatory, is_hgb_required, execution_order)
VALUES 
(
    'CAP-003',
    'Goodwill-Abschreibung',
    'Prüft, ob der Geschäfts- oder Firmenwert planmäßig über die voraussichtliche Nutzungsdauer abgeschrieben wird',
    'capital_consolidation',
    'warning',
    '§ 309 Abs. 1 HGB',
    'Der Geschäfts- oder Firmenwert ist in jedem folgenden Geschäftsjahr zu mindestens einem Viertel abzuschreiben oder planmäßig über die voraussichtliche Nutzungsdauer',
    'custom',
    '{"type": "custom", "customFunction": "checkGoodwillAmortization"}',
    true,
    false,
    true,
    22
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    hgb_description = EXCLUDED.hgb_description;

-- =============================================
-- 3. DEBT CONSOLIDATION CHECKS (§ 303 HGB)
-- =============================================

INSERT INTO plausibility_rules (code, name, description, category, severity, hgb_reference, hgb_description, rule_type, rule_expression, threshold_absolute, is_active, is_mandatory, is_hgb_required, execution_order)
VALUES 
(
    'DEB-001',
    'IC-Forderungen = IC-Verbindlichkeiten',
    'Prüft, ob die konzerninterne Forderungen den konzerninternen Verbindlichkeiten entsprechen',
    'debt_consolidation',
    'warning',
    '§ 303 HGB',
    'Forderungen und Verbindlichkeiten zwischen konsolidierten Unternehmen sind wegzulassen (Schuldenkonsolidierung)',
    'comparison',
    '{"type": "comparison", "leftOperand": "IC_RECEIVABLES", "operator": "=", "rightOperand": "IC_PAYABLES"}',
    0.01,
    true,
    true,
    true,
    30
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    hgb_description = EXCLUDED.hgb_description,
    rule_expression = EXCLUDED.rule_expression;

INSERT INTO plausibility_rules (code, name, description, category, severity, hgb_reference, hgb_description, rule_type, rule_expression, is_active, is_mandatory, is_hgb_required, execution_order)
VALUES 
(
    'DEB-002',
    'Keine nicht eliminierten IC-Salden',
    'Prüft, ob alle konzerninternen Salden vollständig eliminiert wurden',
    'debt_consolidation',
    'warning',
    '§ 303 HGB',
    'Nach der Schuldenkonsolidierung dürfen keine IC-Salden mehr bestehen',
    'threshold',
    '{"type": "threshold", "field": "UNRECONCILED_IC_BALANCE", "operator": "=", "value": 0}',
    true,
    true,
    true,
    31
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    rule_expression = EXCLUDED.rule_expression;

-- =============================================
-- 4. INTERCOMPANY PROFIT ELIMINATION (§ 304 HGB)
-- =============================================

INSERT INTO plausibility_rules (code, name, description, category, severity, hgb_reference, hgb_description, rule_type, rule_expression, is_active, is_mandatory, is_hgb_required, execution_order)
VALUES 
(
    'ICP-001',
    'Zwischenergebniseliminierung durchgeführt',
    'Prüft, ob Zwischenergebnisse aus konzerninternen Lieferungen und Leistungen eliminiert wurden',
    'intercompany_profit',
    'warning',
    '§ 304 HGB',
    'Vermögensgegenstände, die auf Lieferungen oder Leistungen zwischen konsolidierten Unternehmen beruhen, sind mit dem Betrag anzusetzen, zu dem sie ohne Eliminierung der Zwischenergebnisse angesetzt werden könnten',
    'custom',
    '{"type": "custom", "customFunction": "checkIntercompanyProfitElimination"}',
    true,
    false,
    true,
    40
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    hgb_description = EXCLUDED.hgb_description;

-- =============================================
-- 5. INCOME/EXPENSE CONSOLIDATION (§ 305 HGB)
-- =============================================

INSERT INTO plausibility_rules (code, name, description, category, severity, hgb_reference, hgb_description, rule_type, rule_expression, threshold_absolute, is_active, is_mandatory, is_hgb_required, execution_order)
VALUES 
(
    'IEC-001',
    'IC-Erträge = IC-Aufwendungen',
    'Prüft, ob die konzerninternen Erträge den konzerninternen Aufwendungen entsprechen',
    'income_expense_consolidation',
    'warning',
    '§ 305 HGB',
    'Innenumsätze sowie andere Erträge aus Lieferungen und Leistungen zwischen konsolidierten Unternehmen sind mit den entsprechenden Aufwendungen zu verrechnen',
    'comparison',
    '{"type": "comparison", "leftOperand": "IC_REVENUE", "operator": "=", "rightOperand": "IC_EXPENSES"}',
    0.01,
    true,
    true,
    true,
    50
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    hgb_description = EXCLUDED.hgb_description,
    rule_expression = EXCLUDED.rule_expression;

INSERT INTO plausibility_rules (code, name, description, category, severity, hgb_reference, hgb_description, rule_type, rule_expression, is_active, is_mandatory, is_hgb_required, execution_order)
VALUES 
(
    'IEC-002',
    'Aufwands-/Ertragskonsolidierung vollständig',
    'Prüft, ob alle konzerninternen Erträge und Aufwendungen eliminiert wurden',
    'income_expense_consolidation',
    'warning',
    '§ 305 HGB',
    'Sämtliche Innenumsätze und konzerninterne Erträge/Aufwendungen sind zu eliminieren',
    'custom',
    '{"type": "custom", "customFunction": "checkIncomeExpenseConsolidation"}',
    true,
    true,
    true,
    51
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    rule_expression = EXCLUDED.rule_expression;

-- =============================================
-- 6. DEFERRED TAX CHECKS (§ 306 HGB)
-- =============================================

INSERT INTO plausibility_rules (code, name, description, category, severity, hgb_reference, hgb_description, rule_type, rule_expression, is_active, is_mandatory, is_hgb_required, execution_order)
VALUES 
(
    'DTX-001',
    'Latente Steuern auf Konsolidierungsmaßnahmen',
    'Prüft, ob latente Steuern auf alle relevanten Konsolidierungsmaßnahmen gebildet wurden',
    'deferred_tax',
    'warning',
    '§ 306 HGB',
    'Auf Differenzen, die aus dem Wegfall von Zwischenergebnissen oder aus Konsolidierungsmaßnahmen resultieren, sind latente Steuern zu bilden',
    'custom',
    '{"type": "custom", "customFunction": "checkDeferredTaxOnConsolidation"}',
    true,
    false,
    true,
    60
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    hgb_description = EXCLUDED.hgb_description;

INSERT INTO plausibility_rules (code, name, description, category, severity, hgb_reference, hgb_description, rule_type, rule_expression, is_active, is_mandatory, is_hgb_required, execution_order)
VALUES 
(
    'DTX-002',
    'Steuersatz plausibel',
    'Prüft, ob der verwendete Steuersatz im plausiblen Bereich liegt (15-35%)',
    'deferred_tax',
    'warning',
    '§ 306 HGB',
    'Der anzuwendende Steuersatz sollte dem erwarteten Steuersatz entsprechen',
    'threshold',
    '{"type": "threshold", "field": "TAX_RATE", "operator": "between", "value": [15, 35]}',
    true,
    false,
    false,
    61
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- =============================================
-- 7. MINORITY INTEREST CHECKS (§ 307 HGB)
-- =============================================

INSERT INTO plausibility_rules (code, name, description, category, severity, hgb_reference, hgb_description, rule_type, rule_expression, is_active, is_mandatory, is_hgb_required, execution_order)
VALUES 
(
    'MIN-001',
    'Minderheitenanteile berechnet',
    'Prüft, ob Anteile anderer Gesellschafter (Minderheitenanteile) für alle nicht zu 100% gehaltenen Tochterunternehmen berechnet wurden',
    'minority_interest',
    'warning',
    '§ 307 HGB',
    'Das auf die anderen Gesellschafter entfallende anteilige Eigenkapital und Jahresergebnis ist als separater Posten auszuweisen',
    'custom',
    '{"type": "custom", "customFunction": "checkMinorityInterestCalculation"}',
    true,
    true,
    true,
    70
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    hgb_description = EXCLUDED.hgb_description;

INSERT INTO plausibility_rules (code, name, description, category, severity, hgb_reference, hgb_description, rule_type, rule_expression, tolerance_amount, is_active, is_mandatory, is_hgb_required, execution_order)
VALUES 
(
    'MIN-002',
    'Minderheitenanteile konsistent',
    'Prüft, ob die Minderheitenanteile in der Bilanz mit der Berechnung übereinstimmen',
    'minority_interest',
    'warning',
    '§ 307 HGB',
    'Die ausgewiesenen Minderheitenanteile müssen mit der Berechnung übereinstimmen',
    'comparison',
    '{"type": "comparison", "leftOperand": "MINORITY_INTEREST_BALANCE", "operator": "=", "rightOperand": "MINORITY_INTEREST_CALCULATED"}',
    0.01,
    true,
    true,
    true,
    71
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    rule_expression = EXCLUDED.rule_expression;

-- =============================================
-- 8. CURRENCY TRANSLATION CHECKS (§ 308a HGB)
-- =============================================

INSERT INTO plausibility_rules (code, name, description, category, severity, hgb_reference, hgb_description, rule_type, rule_expression, is_active, is_mandatory, is_hgb_required, execution_order)
VALUES 
(
    'FX-001',
    'Währungsumrechnung durchgeführt',
    'Prüft, ob für alle Tochterunternehmen mit fremder Währung eine Währungsumrechnung durchgeführt wurde',
    'currency_translation',
    'warning',
    '§ 308a HGB',
    'Vermögensgegenstände und Schulden sind zum Devisenkassamittelkurs am Abschlussstichtag umzurechnen, Aufwendungen und Erträge zum Durchschnittskurs',
    'custom',
    '{"type": "custom", "customFunction": "checkCurrencyTranslation"}',
    true,
    false,
    true,
    80
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    hgb_description = EXCLUDED.hgb_description;

INSERT INTO plausibility_rules (code, name, description, category, severity, hgb_reference, hgb_description, rule_type, rule_expression, is_active, is_mandatory, is_hgb_required, execution_order)
VALUES 
(
    'FX-002',
    'Währungsdifferenz ausgewiesen',
    'Prüft, ob die Währungsumrechnungsdifferenz erfolgsneutral im Eigenkapital erfasst wurde',
    'currency_translation',
    'info',
    '§ 308a HGB',
    'Eine sich ergebende Umrechnungsdifferenz ist innerhalb des Konzerneigenkapitals nach den Rücklagen unter dem Posten Eigenkapitaldifferenz aus Währungsumrechnung auszuweisen',
    'custom',
    '{"type": "custom", "customFunction": "checkCurrencyTranslationDifference"}',
    true,
    false,
    true,
    81
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    hgb_description = EXCLUDED.hgb_description;

-- =============================================
-- 9. EQUITY METHOD CHECKS (§ 312 HGB)
-- =============================================

INSERT INTO plausibility_rules (code, name, description, category, severity, hgb_reference, hgb_description, rule_type, rule_expression, is_active, is_mandatory, is_hgb_required, execution_order)
VALUES 
(
    'EQM-001',
    'At-Equity-Bewertung durchgeführt',
    'Prüft, ob alle assoziierten Unternehmen nach der Equity-Methode bewertet wurden',
    'equity_method',
    'warning',
    '§ 312 HGB',
    'Anteile an assoziierten Unternehmen sind in der Konzernbilanz nach der Equity-Methode zu bewerten',
    'custom',
    '{"type": "custom", "customFunction": "checkEquityMethodValuation"}',
    true,
    true,
    true,
    90
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    hgb_description = EXCLUDED.hgb_description;

-- =============================================
-- 10. PROPORTIONAL CONSOLIDATION CHECKS (§ 310 HGB)
-- =============================================

INSERT INTO plausibility_rules (code, name, description, category, severity, hgb_reference, hgb_description, rule_type, rule_expression, is_active, is_mandatory, is_hgb_required, execution_order)
VALUES 
(
    'PRO-001',
    'Quotenkonsolidierung korrekt',
    'Prüft, ob die Quotenkonsolidierung für Gemeinschaftsunternehmen mit dem korrekten Anteil durchgeführt wurde',
    'proportional_consolidation',
    'warning',
    '§ 310 HGB',
    'Gemeinschaftsunternehmen können anteilmäßig konsolidiert werden (Quotenkonsolidierung)',
    'custom',
    '{"type": "custom", "customFunction": "checkProportionalConsolidation"}',
    true,
    false,
    false,
    100
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    hgb_description = EXCLUDED.hgb_description;

-- =============================================
-- 11. INTERCOMPANY CONSISTENCY CHECKS
-- =============================================

INSERT INTO plausibility_rules (code, name, description, category, severity, hgb_reference, hgb_description, rule_type, rule_expression, threshold_percentage, is_active, is_mandatory, is_hgb_required, execution_order)
VALUES 
(
    'ICC-001',
    'IC-Abstimmung',
    'Prüft, ob alle IC-Transaktionen abgestimmt sind (Differenzen < 5%)',
    'intercompany_consistency',
    'warning',
    NULL,
    NULL,
    'threshold',
    '{"type": "threshold", "field": "IC_RECONCILIATION_DIFF_PERCENTAGE", "operator": "<", "value": 5}',
    5.0,
    true,
    true,
    false,
    110
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    rule_expression = EXCLUDED.rule_expression;

-- =============================================
-- 12. YEAR-OVER-YEAR CHECKS
-- =============================================

INSERT INTO plausibility_rules (code, name, description, category, severity, hgb_reference, hgb_description, rule_type, rule_expression, threshold_percentage, is_active, is_mandatory, is_hgb_required, execution_order)
VALUES 
(
    'YOY-001',
    'Wesentliche Bilanzpostenänderungen',
    'Warnung bei Bilanzpostenänderungen > 25% zum Vorjahr',
    'year_over_year',
    'info',
    NULL,
    NULL,
    'threshold',
    '{"type": "threshold", "field": "BALANCE_SHEET_VARIANCE_PERCENTAGE", "operator": "<=", "value": 25}',
    25.0,
    true,
    false,
    false,
    120
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    rule_expression = EXCLUDED.rule_expression;

INSERT INTO plausibility_rules (code, name, description, category, severity, hgb_reference, hgb_description, rule_type, rule_expression, threshold_percentage, is_active, is_mandatory, is_hgb_required, execution_order)
VALUES 
(
    'YOY-002',
    'Wesentliche GuV-Postenänderungen',
    'Warnung bei GuV-Postenänderungen > 25% zum Vorjahr',
    'year_over_year',
    'info',
    NULL,
    NULL,
    'threshold',
    '{"type": "threshold", "field": "INCOME_STATEMENT_VARIANCE_PERCENTAGE", "operator": "<=", "value": 25}',
    25.0,
    true,
    false,
    false,
    121
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    rule_expression = EXCLUDED.rule_expression;

-- =============================================
-- 13. DISCLOSURE COMPLETENESS CHECKS
-- =============================================

INSERT INTO plausibility_rules (code, name, description, category, severity, hgb_reference, hgb_description, rule_type, rule_expression, is_active, is_mandatory, is_hgb_required, execution_order)
VALUES 
(
    'DSC-001',
    'Konzernanhang vollständig',
    'Prüft, ob alle nach HGB erforderlichen Anhangangaben vorhanden sind',
    'disclosure_completeness',
    'warning',
    '§§ 313, 314 HGB',
    'Im Konzernanhang sind die vorgeschriebenen Angaben zu machen',
    'custom',
    '{"type": "custom", "customFunction": "checkDisclosureCompleteness"}',
    true,
    true,
    true,
    130
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    hgb_reference = EXCLUDED.hgb_reference,
    hgb_description = EXCLUDED.hgb_description;

INSERT INTO plausibility_rules (code, name, description, category, severity, hgb_reference, hgb_description, rule_type, rule_expression, is_active, is_mandatory, is_hgb_required, execution_order)
VALUES 
(
    'DSC-002',
    'Beteiligungsliste vollständig',
    'Prüft, ob die Aufstellung des Anteilsbesitzes vollständig ist',
    'disclosure_completeness',
    'warning',
    '§ 313 Abs. 2 HGB',
    'Im Konzernanhang sind Name und Sitz aller Unternehmen, der Anteil am Kapital und das Eigenkapital anzugeben',
    'custom',
    '{"type": "custom", "customFunction": "checkParticipationListComplete"}',
    true,
    true,
    true,
    131
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    hgb_reference = EXCLUDED.hgb_reference,
    hgb_description = EXCLUDED.hgb_description;

-- =============================================
-- SEED COMPLETE
-- =============================================
