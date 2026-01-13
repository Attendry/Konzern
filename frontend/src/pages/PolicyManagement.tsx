import { useEffect, useState } from 'react';
import {
  policyService,
  AccountingPolicy,
  ConsolidationRule,
  GaapHgbMapping,
  HgbWahlrecht,
  PolicySummary,
  RuleSummary,
  MappingSummary,
  WahlrechtSummary,
  CategoryMeta,
} from '../services/policyService';
import './PolicyManagement.css';

type TabType = 'policies' | 'rules' | 'mappings' | 'wahlrechte';

const PolicyManagement = () => {
  const [activeTab, setActiveTab] = useState<TabType>('policies');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Policies State
  const [policies, setPolicies] = useState<AccountingPolicy[]>([]);
  const [policySummary, setPolicySummary] = useState<PolicySummary | null>(null);
  const [policyCategories, setPolicyCategories] = useState<CategoryMeta[]>([]);

  // Rules State
  const [rules, setRules] = useState<ConsolidationRule[]>([]);
  const [ruleSummary, setRuleSummary] = useState<RuleSummary | null>(null);
  const [ruleTypes, setRuleTypes] = useState<CategoryMeta[]>([]);

  // Mappings State
  const [mappings, setMappings] = useState<GaapHgbMapping[]>([]);
  const [mappingSummary, setMappingSummary] = useState<MappingSummary | null>(null);
  const [_gaapStandards, setGaapStandards] = useState<CategoryMeta[]>([]);

  // Wahlrechte State
  const [wahlrechte, setWahlrechte] = useState<HgbWahlrecht[]>([]);
  const [wahlrechtSummary, setWahlrechtSummary] = useState<WahlrechtSummary | null>(null);

  // Modal State
  const [selectedPolicy, setSelectedPolicy] = useState<AccountingPolicy | null>(null);
  const [selectedRule, setSelectedRule] = useState<ConsolidationRule | null>(null);
  const [selectedMapping, setSelectedMapping] = useState<GaapHgbMapping | null>(null);
  const [selectedWahlrecht, setSelectedWahlrecht] = useState<HgbWahlrecht | null>(null);

  useEffect(() => {
    loadMetadata();
    loadData();
  }, []);

  const loadMetadata = async () => {
    try {
      const [cats, types, standards] = await Promise.all([
        policyService.getPolicyCategories(),
        policyService.getRuleTypes(),
        policyService.getGaapStandards(),
      ]);
      setPolicyCategories(cats);
      setRuleTypes(types);
      setGaapStandards(standards);
    } catch (err) {
      console.error('Failed to load metadata:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      await Promise.all([
        loadPolicies(),
        loadRules(),
        loadMappings(),
        loadWahlrechte(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadPolicies = async () => {
    const [policiesData, summaryData] = await Promise.all([
      policyService.getPolicies(),
      policyService.getPolicySummary(),
    ]);
    setPolicies(policiesData);
    setPolicySummary(summaryData);
  };

  const loadRules = async () => {
    const [rulesData, summaryData] = await Promise.all([
      policyService.getRules(),
      policyService.getRuleSummary(),
    ]);
    setRules(rulesData);
    setRuleSummary(summaryData);
  };

  const loadMappings = async () => {
    const [mappingsData, summaryData] = await Promise.all([
      policyService.getMappings(),
      policyService.getMappingSummary(),
    ]);
    setMappings(mappingsData);
    setMappingSummary(summaryData);
  };

  const loadWahlrechte = async () => {
    const [wahlrechteData, summaryData] = await Promise.all([
      policyService.getWahlrechte(),
      policyService.getWahlrechtSummary(),
    ]);
    setWahlrechte(wahlrechteData);
    setWahlrechtSummary(summaryData);
  };

  const getCategoryLabel = (value: string, categories: CategoryMeta[]) => {
    const cat = categories.find(c => c.value === value);
    return cat?.label || value;
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'status-active';
      case 'draft':
        return 'status-draft';
      case 'superseded':
        return 'status-superseded';
      case 'deprecated':
        return 'status-deprecated';
      default:
        return '';
    }
  };

  const getFlexibilityBadgeClass = (flexibility: string) => {
    switch (flexibility) {
      case 'mandatory':
        return 'flexibility-mandatory';
      case 'recommended':
        return 'flexibility-recommended';
      case 'optional':
        return 'flexibility-optional';
      case 'prohibited':
        return 'flexibility-prohibited';
      default:
        return '';
    }
  };

  const getFlexibilityLabel = (flexibility: string) => {
    switch (flexibility) {
      case 'mandatory':
        return 'Pflicht';
      case 'recommended':
        return 'Empfohlen';
      case 'optional':
        return 'Wahlrecht';
      case 'prohibited':
        return 'Verboten';
      default:
        return flexibility;
    }
  };

  return (
    <div className="policy-page">
      <div className="page-header">
        <h1>Bilanzierungsrichtlinien & Konsolidierungsregeln</h1>
        <p className="page-subtitle">
          HGB-konforme Policies, Regeln, GAAP-Anpassungen und Wahlrechte
        </p>
      </div>

      {error && (
        <div className="error-banner">
          <span>⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'policies' ? 'active' : ''}`}
          onClick={() => setActiveTab('policies')}
        >
          <span className="tab-icon">📋</span>
          Bilanzierungsrichtlinien
          {policySummary && (
            <span className="tab-badge">{policySummary.activePolicies}</span>
          )}
        </button>
        <button
          className={`tab-button ${activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          <span className="tab-icon">⚙️</span>
          Konsolidierungsregeln
          {ruleSummary && (
            <span className="tab-badge">{ruleSummary.activeRules}</span>
          )}
        </button>
        <button
          className={`tab-button ${activeTab === 'mappings' ? 'active' : ''}`}
          onClick={() => setActiveTab('mappings')}
        >
          <span className="tab-icon">🔄</span>
          GAAP-Anpassungen
          {mappingSummary && (
            <span className="tab-badge">{mappingSummary.activeMappings}</span>
          )}
        </button>
        <button
          className={`tab-button ${activeTab === 'wahlrechte' ? 'active' : ''}`}
          onClick={() => setActiveTab('wahlrechte')}
        >
          <span className="tab-icon">☑️</span>
          HGB-Wahlrechte
          {wahlrechtSummary && (
            <span className="tab-badge">{wahlrechtSummary.totalWahlrechte}</span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Daten werden geladen...</p>
        </div>
      ) : (
        <div className="tab-content">
          {/* Policies Tab */}
          {activeTab === 'policies' && (
            <div className="policies-tab">
              {/* Summary Cards */}
              {policySummary && (
                <div className="summary-cards">
                  <div className="summary-card total">
                    <div className="card-value">{policySummary.totalPolicies}</div>
                    <div className="card-label">Gesamt</div>
                  </div>
                  <div className="summary-card passed">
                    <div className="card-value">{policySummary.activePolicies}</div>
                    <div className="card-label">Aktiv</div>
                  </div>
                  <div className="summary-card warning">
                    <div className="card-value">{policySummary.draftPolicies}</div>
                    <div className="card-label">Entwurf</div>
                  </div>
                  <div className="summary-card failed">
                    <div className="card-value">{policySummary.hgbMandatory}</div>
                    <div className="card-label">HGB-Pflicht</div>
                  </div>
                </div>
              )}

              {/* Policies Table */}
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Kategorie</th>
                      <th>HGB-Referenz</th>
                      <th>Version</th>
                      <th>Gültig ab</th>
                      <th>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {policies.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="empty-row">
                          Keine Bilanzierungsrichtlinien vorhanden.
                        </td>
                      </tr>
                    ) : (
                      policies.map(policy => (
                        <tr key={policy.id}>
                          <td>
                            <span className={`status-badge ${getStatusBadgeClass(policy.status)}`}>
                              {policy.status}
                            </span>
                          </td>
                          <td className="code-cell">
                            {policy.code}
                            {policy.isHgbMandatory && (
                              <span className="mandatory-badge" title="HGB-Pflicht">🔒</span>
                            )}
                          </td>
                          <td>
                            <div className="policy-name">{policy.name}</div>
                            {policy.description && (
                              <div className="policy-desc">{policy.description.substring(0, 60)}...</div>
                            )}
                          </td>
                          <td>{getCategoryLabel(policy.category, policyCategories)}</td>
                          <td>{policy.hgbReference || '-'}</td>
                          <td>v{policy.version}</td>
                          <td>{new Date(policy.effectiveDate).toLocaleDateString('de-DE')}</td>
                          <td>
                            <button
                              className="btn btn-small"
                              onClick={() => setSelectedPolicy(policy)}
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Rules Tab */}
          {activeTab === 'rules' && (
            <div className="rules-tab">
              {/* Summary Cards */}
              {ruleSummary && (
                <div className="summary-cards">
                  <div className="summary-card total">
                    <div className="card-value">{ruleSummary.totalRules}</div>
                    <div className="card-label">Gesamt</div>
                  </div>
                  <div className="summary-card passed">
                    <div className="card-value">{ruleSummary.activeRules}</div>
                    <div className="card-label">Aktiv</div>
                  </div>
                  <div className="summary-card failed">
                    <div className="card-value">{ruleSummary.mandatoryRules}</div>
                    <div className="card-label">Pflicht</div>
                  </div>
                </div>
              )}

              {/* Rules Table */}
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Flexibilität</th>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Typ</th>
                      <th>HGB-Referenz</th>
                      <th>Reihenfolge</th>
                      <th>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="empty-row">
                          Keine Konsolidierungsregeln vorhanden.
                        </td>
                      </tr>
                    ) : (
                      rules.map(rule => (
                        <tr key={rule.id} className={!rule.isActive ? 'inactive-row' : ''}>
                          <td>
                            <span className={`flexibility-badge ${getFlexibilityBadgeClass(rule.flexibility)}`}>
                              {getFlexibilityLabel(rule.flexibility)}
                            </span>
                          </td>
                          <td className="code-cell">
                            {rule.code}
                            {rule.isHgbMandatory && (
                              <span className="mandatory-badge" title="HGB-Pflicht">🔒</span>
                            )}
                          </td>
                          <td>
                            <div className="rule-name">{rule.name}</div>
                            {rule.description && (
                              <div className="rule-desc">{rule.description.substring(0, 60)}...</div>
                            )}
                          </td>
                          <td>{getCategoryLabel(rule.ruleType, ruleTypes)}</td>
                          <td>{rule.hgbReference || '-'}</td>
                          <td>{rule.executionOrder}</td>
                          <td>
                            <button
                              className="btn btn-small"
                              onClick={() => setSelectedRule(rule)}
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Mappings Tab */}
          {activeTab === 'mappings' && (
            <div className="mappings-tab">
              {/* Summary Cards */}
              {mappingSummary && (
                <div className="summary-cards">
                  <div className="summary-card total">
                    <div className="card-value">{mappingSummary.totalMappings}</div>
                    <div className="card-label">Gesamt</div>
                  </div>
                  <div className="summary-card passed">
                    <div className="card-value">{mappingSummary.activeMappings}</div>
                    <div className="card-label">Aktiv</div>
                  </div>
                  <div className="summary-card warning">
                    <div className="card-value">{mappingSummary.materialMappings}</div>
                    <div className="card-label">Wesentlich</div>
                  </div>
                </div>
              )}

              {/* Mappings Table */}
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Quell-GAAP</th>
                      <th>→ HGB</th>
                      <th>Anpassungsart</th>
                      <th>Auswirkungen</th>
                      <th>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="empty-row">
                          Keine GAAP-Anpassungen vorhanden.
                        </td>
                      </tr>
                    ) : (
                      mappings.map(mapping => (
                        <tr key={mapping.id} className={!mapping.isActive ? 'inactive-row' : ''}>
                          <td className="code-cell">
                            {mapping.code}
                            {mapping.isMaterial && (
                              <span className="material-badge" title="Wesentlich">⚠️</span>
                            )}
                          </td>
                          <td>
                            <div className="mapping-name">{mapping.name}</div>
                          </td>
                          <td>
                            <span className="gaap-badge">{mapping.sourceGaap.toUpperCase()}</span>
                            <div className="gaap-ref">{mapping.sourceGaapReference}</div>
                          </td>
                          <td>
                            <div className="hgb-ref">{mapping.hgbReference}</div>
                          </td>
                          <td>{mapping.adjustmentType}</td>
                          <td>
                            <div className="affects-badges">
                              {mapping.affectsBalanceSheet && <span className="affect-badge bs" title="Bilanz">B</span>}
                              {mapping.affectsIncomeStatement && <span className="affect-badge is" title="GuV">G</span>}
                              {mapping.affectsEquity && <span className="affect-badge eq" title="Eigenkapital">E</span>}
                              {mapping.affectsDeferredTax && <span className="affect-badge dt" title="Latente Steuern">S</span>}
                            </div>
                          </td>
                          <td>
                            <button
                              className="btn btn-small"
                              onClick={() => setSelectedMapping(mapping)}
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Wahlrechte Tab */}
          {activeTab === 'wahlrechte' && (
            <div className="wahlrechte-tab">
              {/* Summary Cards */}
              {wahlrechtSummary && (
                <div className="summary-cards">
                  <div className="summary-card total">
                    <div className="card-value">{wahlrechtSummary.totalWahlrechte}</div>
                    <div className="card-label">Wahlrechte</div>
                  </div>
                  <div className="summary-card passed">
                    <div className="card-value">{wahlrechtSummary.selectionsCount}</div>
                    <div className="card-label">Ausgewählt</div>
                  </div>
                  <div className="summary-card warning">
                    <div className="card-value">{wahlrechtSummary.bindingSelectionsCount}</div>
                    <div className="card-label">Bindend</div>
                  </div>
                </div>
              )}

              {/* Wahlrechte Table */}
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>HGB-Referenz</th>
                      <th>Optionsart</th>
                      <th>Optionen</th>
                      <th>Bindend</th>
                      <th>IFRS-Äquivalent</th>
                      <th>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wahlrechte.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="empty-row">
                          Keine HGB-Wahlrechte vorhanden.
                        </td>
                      </tr>
                    ) : (
                      wahlrechte.map(wahlrecht => (
                        <tr key={wahlrecht.id}>
                          <td className="code-cell">{wahlrecht.code}</td>
                          <td>
                            <div className="wahlrecht-name">{wahlrecht.name}</div>
                            {wahlrecht.description && (
                              <div className="wahlrecht-desc">{wahlrecht.description.substring(0, 50)}...</div>
                            )}
                          </td>
                          <td>{wahlrecht.hgbReference}</td>
                          <td>{wahlrecht.optionType}</td>
                          <td>
                            <div className="options-count">
                              {wahlrecht.availableOptions.length} Optionen
                            </div>
                          </td>
                          <td>
                            {wahlrecht.onceChosenBinding ? (
                              <span className="binding-badge yes">Ja</span>
                            ) : (
                              <span className="binding-badge no">Nein</span>
                            )}
                          </td>
                          <td>{wahlrecht.ifrsEquivalent || '-'}</td>
                          <td>
                            <button
                              className="btn btn-small"
                              onClick={() => setSelectedWahlrecht(wahlrecht)}
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Policy Detail Modal */}
      {selectedPolicy && (
        <div className="modal-overlay" onClick={() => setSelectedPolicy(null)}>
          <div className="modal-content large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedPolicy.name}</h2>
              <button className="close-button" onClick={() => setSelectedPolicy(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <div className="detail-group">
                  <label>Code:</label>
                  <span>{selectedPolicy.code}</span>
                </div>
                <div className="detail-group">
                  <label>Status:</label>
                  <span className={`status-badge ${getStatusBadgeClass(selectedPolicy.status)}`}>
                    {selectedPolicy.status}
                  </span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-group">
                  <label>Kategorie:</label>
                  <span>{getCategoryLabel(selectedPolicy.category, policyCategories)}</span>
                </div>
                <div className="detail-group">
                  <label>HGB-Referenz:</label>
                  <span>{selectedPolicy.hgbReference || '-'}</span>
                </div>
              </div>
              <div className="detail-group">
                <label>HGB-Pflicht:</label>
                <span>{selectedPolicy.isHgbMandatory ? '🔒 Ja - keine Abweichung möglich' : 'Nein'}</span>
              </div>
              {selectedPolicy.hgbSection && (
                <div className="detail-group">
                  <label>HGB-Wortlaut:</label>
                  <div className="hgb-section-text">{selectedPolicy.hgbSection}</div>
                </div>
              )}
              <div className="detail-group">
                <label>Richtlinientext:</label>
                <div className="policy-text">{selectedPolicy.policyText}</div>
              </div>
              <div className="detail-row">
                <div className="detail-group">
                  <label>Version:</label>
                  <span>v{selectedPolicy.version}</span>
                </div>
                <div className="detail-group">
                  <label>Gültig ab:</label>
                  <span>{new Date(selectedPolicy.effectiveDate).toLocaleDateString('de-DE')}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setSelectedPolicy(null)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rule Detail Modal */}
      {selectedRule && (
        <div className="modal-overlay" onClick={() => setSelectedRule(null)}>
          <div className="modal-content large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedRule.name}</h2>
              <button className="close-button" onClick={() => setSelectedRule(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <div className="detail-group">
                  <label>Code:</label>
                  <span>{selectedRule.code}</span>
                </div>
                <div className="detail-group">
                  <label>Flexibilität:</label>
                  <span className={`flexibility-badge ${getFlexibilityBadgeClass(selectedRule.flexibility)}`}>
                    {getFlexibilityLabel(selectedRule.flexibility)}
                  </span>
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-group">
                  <label>Regeltyp:</label>
                  <span>{getCategoryLabel(selectedRule.ruleType, ruleTypes)}</span>
                </div>
                <div className="detail-group">
                  <label>HGB-Referenz:</label>
                  <span>{selectedRule.hgbReference || '-'}</span>
                </div>
              </div>
              {selectedRule.description && (
                <div className="detail-group">
                  <label>Beschreibung:</label>
                  <div className="rule-description">{selectedRule.description}</div>
                </div>
              )}
              {selectedRule.hgbDescription && (
                <div className="detail-group">
                  <label>HGB-Vorschrift:</label>
                  <div className="hgb-section-text">{selectedRule.hgbDescription}</div>
                </div>
              )}
              <div className="detail-group">
                <label>Regelkonfiguration:</label>
                <pre className="config-json">
                  {JSON.stringify(selectedRule.ruleConfig, null, 2)}
                </pre>
              </div>
              {Object.keys(selectedRule.parameters || {}).length > 0 && (
                <div className="detail-group">
                  <label>Parameter:</label>
                  <pre className="config-json">
                    {JSON.stringify(selectedRule.parameters, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setSelectedRule(null)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mapping Detail Modal */}
      {selectedMapping && (
        <div className="modal-overlay" onClick={() => setSelectedMapping(null)}>
          <div className="modal-content large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedMapping.name}</h2>
              <button className="close-button" onClick={() => setSelectedMapping(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <div className="detail-group">
                  <label>Code:</label>
                  <span>{selectedMapping.code}</span>
                </div>
                <div className="detail-group">
                  <label>Richtung:</label>
                  <span>{selectedMapping.sourceGaap.toUpperCase()} → HGB</span>
                </div>
              </div>
              <div className="mapping-comparison">
                <div className="comparison-side source">
                  <h4>Quell-GAAP ({selectedMapping.sourceGaap.toUpperCase()})</h4>
                  <p><strong>Referenz:</strong> {selectedMapping.sourceGaapReference || '-'}</p>
                  <p>{selectedMapping.sourceGaapDescription || '-'}</p>
                </div>
                <div className="comparison-arrow">→</div>
                <div className="comparison-side target">
                  <h4>Ziel (HGB)</h4>
                  <p><strong>Referenz:</strong> {selectedMapping.hgbReference || '-'}</p>
                  <p>{selectedMapping.hgbDescription || '-'}</p>
                </div>
              </div>
              <div className="detail-group">
                <label>Anpassungsart:</label>
                <span>{selectedMapping.adjustmentType}</span>
              </div>
              <div className="detail-group">
                <label>Auswirkungen:</label>
                <div className="affects-list">
                  {selectedMapping.affectsBalanceSheet && <span>✓ Bilanz</span>}
                  {selectedMapping.affectsIncomeStatement && <span>✓ GuV</span>}
                  {selectedMapping.affectsEquity && <span>✓ Eigenkapital</span>}
                  {selectedMapping.affectsDeferredTax && <span>✓ Latente Steuern</span>}
                </div>
              </div>
              <div className="detail-group">
                <label>Anpassungskonfiguration:</label>
                <pre className="config-json">
                  {JSON.stringify(selectedMapping.adjustmentConfig, null, 2)}
                </pre>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setSelectedMapping(null)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wahlrecht Detail Modal */}
      {selectedWahlrecht && (
        <div className="modal-overlay" onClick={() => setSelectedWahlrecht(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedWahlrecht.name}</h2>
              <button className="close-button" onClick={() => setSelectedWahlrecht(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <div className="detail-group">
                  <label>Code:</label>
                  <span>{selectedWahlrecht.code}</span>
                </div>
                <div className="detail-group">
                  <label>HGB-Referenz:</label>
                  <span>{selectedWahlrecht.hgbReference}</span>
                </div>
              </div>
              {selectedWahlrecht.hgbSection && (
                <div className="detail-group">
                  <label>HGB-Wortlaut:</label>
                  <div className="hgb-section-text">{selectedWahlrecht.hgbSection}</div>
                </div>
              )}
              <div className="detail-group">
                <label>Verfügbare Optionen:</label>
                <div className="options-list">
                  {selectedWahlrecht.availableOptions.map((option, index) => (
                    <div key={index} className={`option-item ${option.value === selectedWahlrecht.defaultOption ? 'default' : ''}`}>
                      <div className="option-header">
                        <span className="option-label">{option.label}</span>
                        {option.value === selectedWahlrecht.defaultOption && (
                          <span className="default-badge">Standard</span>
                        )}
                      </div>
                      {option.description && (
                        <div className="option-description">{option.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="detail-row">
                <div className="detail-group">
                  <label>Stetigkeitsgebunden:</label>
                  <span>{selectedWahlrecht.onceChosenBinding ? 'Ja - einmal gewählt, bindend' : 'Nein - Änderung möglich'}</span>
                </div>
                <div className="detail-group">
                  <label>Änderung erfordert Angabe:</label>
                  <span>{selectedWahlrecht.changeRequiresDisclosure ? 'Ja' : 'Nein'}</span>
                </div>
              </div>
              {selectedWahlrecht.ifrsEquivalent && (
                <div className="detail-group">
                  <label>IFRS-Äquivalent:</label>
                  <span>{selectedWahlrecht.ifrsEquivalent}</span>
                </div>
              )}
              {selectedWahlrecht.differencesToIfrs && (
                <div className="detail-group">
                  <label>Unterschiede zu IFRS:</label>
                  <div className="ifrs-differences">{selectedWahlrecht.differencesToIfrs}</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setSelectedWahlrecht(null)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PolicyManagement;
