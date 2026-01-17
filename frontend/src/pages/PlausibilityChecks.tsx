import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  controlsService,
  PlausibilityCheck,
  PlausibilityCheckSummary,
  PlausibilityCheckRun,
  VarianceAnalysis,
  VarianceSummary,
  ExceptionReport,
  ExceptionSummary,
  RuleCategoryMeta,
} from '../services/controlsService';
import { useAIChat } from '../contexts/AIChatContext';
import { ErrorState } from '../components/ErrorState';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { BackButton } from '../components/BackButton';
import './PlausibilityChecks.css';

type TabType = 'checks' | 'variances' | 'exceptions' | 'materiality';

const PlausibilityChecks = () => {
  const { financialStatementId } = useParams<{ financialStatementId: string }>();
  const navigate = useNavigate();
  const { setFinancialStatementId } = useAIChat();
  const [activeTab, setActiveTab] = useState<TabType>('checks');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set AI chatbot context when viewing plausibility checks
  useEffect(() => {
    if (financialStatementId) {
      setFinancialStatementId(financialStatementId);
    }
    return () => setFinancialStatementId(null); // Cleanup on unmount
  }, [financialStatementId, setFinancialStatementId]);

  // Check State
  const [checks, setChecks] = useState<PlausibilityCheck[]>([]);
  const [checkSummary, setCheckSummary] = useState<PlausibilityCheckSummary | null>(null);
  const [_checkRuns, setCheckRuns] = useState<PlausibilityCheckRun[]>([]);
  const [runningChecks, setRunningChecks] = useState(false);

  // Variance State
  const [variances, setVariances] = useState<VarianceAnalysis[]>([]);
  const [varianceSummary, setVarianceSummary] = useState<VarianceSummary | null>(null);
  const [varianceFilter, setVarianceFilter] = useState<'all' | 'material' | 'unexplained'>('all');

  // Exception State
  const [exceptions, setExceptions] = useState<ExceptionReport[]>([]);
  const [exceptionSummary, setExceptionSummary] = useState<ExceptionSummary | null>(null);
  const [exceptionFilter, setExceptionFilter] = useState<'all' | 'open' | 'resolved'>('all');

  // Metadata
  const [categories, setCategories] = useState<RuleCategoryMeta[]>([]);

  // Modal State
  const [selectedCheck, setSelectedCheck] = useState<PlausibilityCheck | null>(null);
  const [selectedVariance, setSelectedVariance] = useState<VarianceAnalysis | null>(null);
  const [selectedException, setSelectedException] = useState<ExceptionReport | null>(null);

  useEffect(() => {
    loadCategories();
    if (financialStatementId) {
      loadData();
    }
  }, [financialStatementId]);

  const loadCategories = async () => {
    try {
      const cats = await controlsService.getRuleCategories();
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const loadData = async () => {
    if (!financialStatementId) return;
    setLoading(true);
    setError(null);

    try {
      await Promise.all([
        loadChecks(),
        loadVariances(),
        loadExceptions(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadChecks = async () => {
    if (!financialStatementId) return;
    const [checksData, summaryData, runsData] = await Promise.all([
      controlsService.getCheckResults(financialStatementId),
      controlsService.getCheckSummary(financialStatementId),
      controlsService.getCheckRuns(financialStatementId),
    ]);
    setChecks(checksData);
    setCheckSummary(summaryData);
    setCheckRuns(runsData);
  };

  const loadVariances = async () => {
    if (!financialStatementId) return;
    const [variancesData, summaryData] = await Promise.all([
      controlsService.getVarianceAnalyses(
        financialStatementId,
        varianceFilter === 'material',
        varianceFilter === 'unexplained',
      ),
      controlsService.getVarianceSummary(financialStatementId),
    ]);
    setVariances(variancesData);
    setVarianceSummary(summaryData);
  };

  const loadExceptions = async () => {
    if (!financialStatementId) return;
    const [exceptionsData, summaryData] = await Promise.all([
      exceptionFilter === 'open'
        ? controlsService.getOpenExceptions(financialStatementId)
        : controlsService.getExceptions(
            financialStatementId,
            exceptionFilter === 'resolved' ? 'resolved' : undefined,
          ),
      controlsService.getExceptionSummary(financialStatementId),
    ]);
    setExceptions(exceptionsData);
    setExceptionSummary(summaryData);
  };

  const handleRunChecks = async () => {
    if (!financialStatementId) return;
    setRunningChecks(true);
    setError(null);

    try {
      await controlsService.runChecks(financialStatementId);
      await loadChecks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run checks');
    } finally {
      setRunningChecks(false);
    }
  };

  const handleAcknowledgeCheck = async (checkId: string, comment: string) => {
    try {
      await controlsService.acknowledgeCheck(checkId, 'system', comment);
      await loadChecks();
      setSelectedCheck(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to acknowledge check');
    }
  };

  const handleWaiveCheck = async (checkId: string, reason: string) => {
    try {
      await controlsService.waiveCheck(checkId, 'system', reason);
      await loadChecks();
      setSelectedCheck(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to waive check');
    }
  };

  const handleGenerateExceptionsFromChecks = async () => {
    if (!financialStatementId) return;
    try {
      await controlsService.generateExceptionsFromChecks(financialStatementId);
      await loadExceptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate exceptions');
    }
  };

  const handleGenerateExceptionsFromVariances = async () => {
    if (!financialStatementId) return;
    try {
      await controlsService.generateExceptionsFromVariances(financialStatementId);
      await loadExceptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate exceptions');
    }
  };

  const getCategoryLabel = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat?.label || category;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return '[OK]';
      case 'failed':
        return '[Fehler]';
      case 'warning':
        return '⚠';
      case 'skipped':
        return '○';
      case 'acknowledged':
        return '[Anzeigen]';
      case 'waived':
        return '[OK OK]';
      default:
        return '?';
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'passed':
        return 'status-passed';
      case 'failed':
        return 'status-failed';
      case 'warning':
        return 'status-warning';
      case 'skipped':
        return 'status-skipped';
      case 'acknowledged':
        return 'status-acknowledged';
      case 'waived':
        return 'status-waived';
      default:
        return '';
    }
  };

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'priority-critical';
      case 'high':
        return 'priority-high';
      case 'medium':
        return 'priority-medium';
      case 'low':
        return 'priority-low';
      default:
        return '';
    }
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const formatPercentage = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return `${value.toFixed(2)}%`;
  };

  if (!financialStatementId) {
    return (
      <div className="plausibility-page">
        <div className="page-header">
          <h1>Plausibilitätsprüfungen</h1>
        </div>
        <div className="empty-state">
          <p>Bitte wählen Sie zunächst einen Konzernabschluss aus.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="plausibility-page">
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <BackButton />
      </div>
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/' },
          { label: 'Kontrollen', to: '/controls' },
          { label: 'Plausibilitätsprüfungen' }
        ]}
      />
      <div className="page-header">
        <h1>Plausibilitätsprüfungen & Kontrollen</h1>
        <p className="page-subtitle">
          HGB-konforme Prüfungen, Varianzanalysen und Ausnahmeberichte
        </p>
      </div>

      {error && (
        <ErrorState
          error={error}
          onRetry={loadData}
          context={{
            page: 'PlausibilityChecks',
            financialStatementId: financialStatementId || undefined,
          }}
          severity="warning"
          alternativeActions={[
            {
              label: 'Zum Dashboard',
              onClick: () => navigate('/')
            }
          ]}
        />
      )}

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'checks' ? 'active' : ''}`}
          onClick={() => setActiveTab('checks')}
        >
          <span className="tab-icon">[OK]</span>
          Plausibilitätsprüfungen
          {checkSummary && (checkSummary.failed > 0 || checkSummary.warnings > 0) && (
            <span className="tab-badge warning">
              {checkSummary.failed + checkSummary.warnings}
            </span>
          )}
        </button>
        <button
          className={`tab-button ${activeTab === 'variances' ? 'active' : ''}`}
          onClick={() => setActiveTab('variances')}
        >
          <span className="tab-icon">[Chart]</span>
          Varianzanalyse
          {varianceSummary && varianceSummary.unexplainedCount > 0 && (
            <span className="tab-badge info">
              {varianceSummary.unexplainedCount}
            </span>
          )}
        </button>
        <button
          className={`tab-button ${activeTab === 'exceptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('exceptions')}
        >
          <span className="tab-icon">[Warnung]</span>
          Ausnahmeberichte
          {exceptionSummary && exceptionSummary.openCount > 0 && (
            <span className="tab-badge error">
              {exceptionSummary.openCount}
            </span>
          )}
        </button>
        <button
          className={`tab-button ${activeTab === 'materiality' ? 'active' : ''}`}
          onClick={() => setActiveTab('materiality')}
        >
          <span className="tab-icon">📏</span>
          Wesentlichkeit
        </button>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Daten werden geladen...</p>
        </div>
      ) : (
        <div className="tab-content">
          {/* Plausibility Checks Tab */}
          {activeTab === 'checks' && (
            <div className="checks-tab">
              {/* Summary Cards */}
              {checkSummary && (
                <div className="summary-cards">
                  <div className="summary-card total">
                    <div className="card-value">{checkSummary.totalChecks}</div>
                    <div className="card-label">Gesamt</div>
                  </div>
                  <div className="summary-card passed">
                    <div className="card-value">{checkSummary.passed}</div>
                    <div className="card-label">Bestanden</div>
                  </div>
                  <div className="summary-card failed">
                    <div className="card-value">{checkSummary.failed}</div>
                    <div className="card-label">Fehler</div>
                  </div>
                  <div className="summary-card warning">
                    <div className="card-value">{checkSummary.warnings}</div>
                    <div className="card-label">Warnungen</div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="section-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleRunChecks}
                  disabled={runningChecks}
                >
                  {runningChecks ? (
                    <>
                      <span className="spinner-small"></span>
                      Prüfungen laufen...
                    </>
                  ) : (
                    <>▶ Alle Prüfungen ausführen</>
                  )}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleGenerateExceptionsFromChecks}
                >
                  🔄 Ausnahmen generieren
                </button>
              </div>

              {/* Check Results Table */}
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Regel</th>
                      <th>Kategorie</th>
                      <th>HGB-Referenz</th>
                      <th>Ergebnis</th>
                      <th>Differenz</th>
                      <th>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checks.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="empty-row">
                          Keine Prüfungsergebnisse vorhanden. Führen Sie die Prüfungen aus.
                        </td>
                      </tr>
                    ) : (
                      checks.map(check => (
                        <tr key={check.id} className={getStatusClass(check.status)}>
                          <td>
                            <span className={`status-badge ${getStatusClass(check.status)}`}>
                              {getStatusIcon(check.status)} {check.status}
                            </span>
                          </td>
                          <td>
                            <div className="rule-name">{check.rule?.name || 'Unbekannte Regel'}</div>
                            <div className="rule-code">{check.rule?.code}</div>
                          </td>
                          <td>{getCategoryLabel(check.rule?.category || '')}</td>
                          <td>{check.rule?.hgbReference || '-'}</td>
                          <td>
                            <div className="check-message">{check.message || '-'}</div>
                            {check.details && (
                              <div className="check-details">{check.details}</div>
                            )}
                          </td>
                          <td>
                            {check.differenceValue !== null && (
                              <div>
                                <div>{formatCurrency(check.differenceValue)}</div>
                                {check.differencePercentage !== null && (
                                  <div className="percentage">
                                    ({formatPercentage(check.differencePercentage)})
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td>
                            {['failed', 'warning'].includes(check.status) && (
                              <button
                                className="btn btn-small"
                                onClick={() => setSelectedCheck(check)}
                              >
                                Details
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Variance Analysis Tab */}
          {activeTab === 'variances' && (
            <div className="variances-tab">
              {/* Summary Cards */}
              {varianceSummary && (
                <div className="summary-cards">
                  <div className="summary-card total">
                    <div className="card-value">{varianceSummary.totalItems}</div>
                    <div className="card-label">Gesamt</div>
                  </div>
                  <div className="summary-card failed">
                    <div className="card-value">{varianceSummary.materialCount}</div>
                    <div className="card-label">Wesentlich</div>
                  </div>
                  <div className="summary-card warning">
                    <div className="card-value">{varianceSummary.unexplainedCount}</div>
                    <div className="card-label">Ohne Erklärung</div>
                  </div>
                  <div className="summary-card passed">
                    <div className="card-value">{varianceSummary.explainedCount}</div>
                    <div className="card-label">Erklärt</div>
                  </div>
                </div>
              )}

              {/* Filters */}
              <div className="section-filters">
                <div className="filter-group">
                  <label>Filter:</label>
                  <select
                    value={varianceFilter}
                    onChange={e => {
                      setVarianceFilter(e.target.value as any);
                      loadVariances();
                    }}
                  >
                    <option value="all">Alle Varianzen</option>
                    <option value="material">Nur wesentliche</option>
                    <option value="unexplained">Ohne Erklärung</option>
                  </select>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={handleGenerateExceptionsFromVariances}
                >
                  🔄 Ausnahmen generieren
                </button>
              </div>

              {/* Variance Table */}
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Signifikanz</th>
                      <th>Konto</th>
                      <th>Aktuell</th>
                      <th>Vorjahr</th>
                      <th>Abweichung</th>
                      <th>%</th>
                      <th>Erklärung</th>
                      <th>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variances.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="empty-row">
                          Keine Varianzanalysen vorhanden.
                        </td>
                      </tr>
                    ) : (
                      variances.map(variance => (
                        <tr key={variance.id}>
                          <td>
                            <span className={`significance-badge ${variance.significance}`}>
                              {variance.significance === 'material' && '🔴'}
                              {variance.significance === 'significant' && '🟠'}
                              {variance.significance === 'minor' && '🟡'}
                              {variance.significance === 'immaterial' && '🟢'}
                              {variance.significance}
                            </span>
                          </td>
                          <td>
                            <div className="account-name">{variance.accountName || variance.accountNumber}</div>
                            {variance.accountNumber && variance.accountName && (
                              <div className="account-number">{variance.accountNumber}</div>
                            )}
                          </td>
                          <td className="amount-cell">{formatCurrency(variance.currentPeriodValue)}</td>
                          <td className="amount-cell">{formatCurrency(variance.priorPeriodValue)}</td>
                          <td className={`amount-cell ${variance.absoluteVariance >= 0 ? 'positive' : 'negative'}`}>
                            {formatCurrency(variance.absoluteVariance)}
                          </td>
                          <td className={`percentage-cell ${variance.percentageVariance >= 0 ? 'positive' : 'negative'}`}>
                            {formatPercentage(variance.percentageVariance)}
                          </td>
                          <td>
                            {variance.explanation ? (
                              <div className="explanation-preview">
                                <span className="explained-icon">[OK]</span>
                                {variance.explanation.substring(0, 50)}...
                              </div>
                            ) : (
                              <span className="unexplained-label">Offen</span>
                            )}
                          </td>
                          <td>
                            <button
                              className="btn btn-small"
                              onClick={() => setSelectedVariance(variance)}
                            >
                              {variance.explanation ? 'Anzeigen' : 'Erklären'}
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

          {/* Exceptions Tab */}
          {activeTab === 'exceptions' && (
            <div className="exceptions-tab">
              {/* Summary Cards */}
              {exceptionSummary && (
                <div className="summary-cards">
                  <div className="summary-card total">
                    <div className="card-value">{exceptionSummary.totalExceptions}</div>
                    <div className="card-label">Gesamt</div>
                  </div>
                  <div className="summary-card failed">
                    <div className="card-value">{exceptionSummary.openCount}</div>
                    <div className="card-label">Offen</div>
                  </div>
                  <div className="summary-card warning">
                    <div className="card-value">{exceptionSummary.overdueCount}</div>
                    <div className="card-label">Überfällig</div>
                  </div>
                  <div className="summary-card passed">
                    <div className="card-value">{exceptionSummary.resolvedCount}</div>
                    <div className="card-label">Gelöst</div>
                  </div>
                </div>
              )}

              {/* Filters */}
              <div className="section-filters">
                <div className="filter-group">
                  <label>Status:</label>
                  <select
                    value={exceptionFilter}
                    onChange={e => {
                      setExceptionFilter(e.target.value as any);
                      loadExceptions();
                    }}
                  >
                    <option value="all">Alle</option>
                    <option value="open">Offen</option>
                    <option value="resolved">Gelöst</option>
                  </select>
                </div>
              </div>

              {/* Exceptions Table */}
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Priorität</th>
                      <th>Status</th>
                      <th>Code</th>
                      <th>Titel</th>
                      <th>Kategorie</th>
                      <th>Auswirkung</th>
                      <th>Fällig</th>
                      <th>Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exceptions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="empty-row">
                          Keine Ausnahmeberichte vorhanden.
                        </td>
                      </tr>
                    ) : (
                      exceptions.map(exception => (
                        <tr key={exception.id}>
                          <td>
                            <span className={`priority-badge ${getPriorityClass(exception.priority)}`}>
                              {exception.priority}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge status-${exception.status}`}>
                              {exception.status}
                            </span>
                          </td>
                          <td className="code-cell">{exception.exceptionCode}</td>
                          <td>
                            <div className="exception-title">{exception.title}</div>
                            {exception.description && (
                              <div className="exception-desc">
                                {exception.description.substring(0, 60)}...
                              </div>
                            )}
                          </td>
                          <td>{exception.category ? getCategoryLabel(exception.category) : '-'}</td>
                          <td>
                            {exception.impactAmount ? formatCurrency(exception.impactAmount) : '-'}
                          </td>
                          <td>
                            {exception.dueDate ? (
                              <span className={
                                new Date(exception.dueDate) < new Date() ? 'overdue' : ''
                              }>
                                {new Date(exception.dueDate).toLocaleDateString('de-DE')}
                              </span>
                            ) : '-'}
                          </td>
                          <td>
                            <button
                              className="btn btn-small"
                              onClick={() => setSelectedException(exception)}
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

          {/* Materiality Tab */}
          {activeTab === 'materiality' && (
            <div className="materiality-tab">
              <div className="materiality-placeholder">
                <h3>Wesentlichkeitsgrenzen</h3>
                <p>
                  Hier können Sie die Wesentlichkeitsgrenzen für die Konsolidierung festlegen.
                  Diese werden für Varianzanalysen und Plausibilitätsprüfungen verwendet.
                </p>
                <div className="materiality-info">
                  <div className="info-item">
                    <span className="info-label">Planungswesentlichkeit:</span>
                    <span className="info-value">1% der Bilanzsumme</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Durchführungswesentlichkeit:</span>
                    <span className="info-value">0.75% der Bilanzsumme</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Bagatellgrenze:</span>
                    <span className="info-value">0.05% der Bilanzsumme</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Check Detail Modal */}
      {selectedCheck && (
        <div className="modal-overlay" onClick={() => setSelectedCheck(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Prüfungsdetails</h2>
              <button className="close-button" onClick={() => setSelectedCheck(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-group">
                <label>Regel:</label>
                <span>{selectedCheck.rule?.name} ({selectedCheck.rule?.code})</span>
              </div>
              <div className="detail-group">
                <label>Status:</label>
                <span className={`status-badge ${getStatusClass(selectedCheck.status)}`}>
                  {getStatusIcon(selectedCheck.status)} {selectedCheck.status}
                </span>
              </div>
              <div className="detail-group">
                <label>HGB-Referenz:</label>
                <span>{selectedCheck.rule?.hgbReference || '-'}</span>
              </div>
              <div className="detail-group">
                <label>Beschreibung:</label>
                <span>{selectedCheck.rule?.hgbDescription || selectedCheck.rule?.description || '-'}</span>
              </div>
              <div className="detail-group">
                <label>Ergebnis:</label>
                <span>{selectedCheck.message}</span>
              </div>
              {selectedCheck.details && (
                <div className="detail-group">
                  <label>Details:</label>
                  <span>{selectedCheck.details}</span>
                </div>
              )}
              {selectedCheck.differenceValue !== null && (
                <div className="detail-group">
                  <label>Differenz:</label>
                  <span>
                    {formatCurrency(selectedCheck.differenceValue)}
                    {selectedCheck.differencePercentage !== null && (
                      <> ({formatPercentage(selectedCheck.differencePercentage)})</>
                    )}
                  </span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {['failed', 'warning'].includes(selectedCheck.status) && (
                <>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      const comment = prompt('Bitte geben Sie einen Kommentar ein:');
                      if (comment) handleAcknowledgeCheck(selectedCheck.id, comment);
                    }}
                  >
                    Zur Kenntnis nehmen
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      const reason = prompt('Bitte geben Sie einen Grund für die Ausnahme ein:');
                      if (reason) handleWaiveCheck(selectedCheck.id, reason);
                    }}
                  >
                    Ausnahme genehmigen
                  </button>
                </>
              )}
              <button className="btn btn-outline" onClick={() => setSelectedCheck(null)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Variance Detail Modal */}
      {selectedVariance && (
        <div className="modal-overlay" onClick={() => setSelectedVariance(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Varianzdetails</h2>
              <button className="close-button" onClick={() => setSelectedVariance(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-group">
                <label>Konto:</label>
                <span>{selectedVariance.accountName || selectedVariance.accountNumber}</span>
              </div>
              <div className="detail-group">
                <label>Signifikanz:</label>
                <span className={`significance-badge ${selectedVariance.significance}`}>
                  {selectedVariance.significance}
                </span>
              </div>
              <div className="variance-comparison">
                <div className="comparison-item">
                  <label>Aktueller Wert ({selectedVariance.currentPeriodYear}):</label>
                  <span>{formatCurrency(selectedVariance.currentPeriodValue)}</span>
                </div>
                <div className="comparison-item">
                  <label>Vorjahr ({selectedVariance.priorPeriodYear}):</label>
                  <span>{formatCurrency(selectedVariance.priorPeriodValue)}</span>
                </div>
                <div className="comparison-item highlight">
                  <label>Abweichung:</label>
                  <span>
                    {formatCurrency(selectedVariance.absoluteVariance)}
                    ({formatPercentage(selectedVariance.percentageVariance)})
                  </span>
                </div>
              </div>
              {selectedVariance.explanation && (
                <div className="detail-group">
                  <label>Erklärung:</label>
                  <div className="explanation-text">{selectedVariance.explanation}</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setSelectedVariance(null)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exception Detail Modal */}
      {selectedException && (
        <div className="modal-overlay" onClick={() => setSelectedException(null)}>
          <div className="modal-content large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Ausnahme: {selectedException.exceptionCode}</h2>
              <button className="close-button" onClick={() => setSelectedException(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-group">
                <label>Titel:</label>
                <span>{selectedException.title}</span>
              </div>
              <div className="detail-row">
                <div className="detail-group">
                  <label>Priorität:</label>
                  <span className={`priority-badge ${getPriorityClass(selectedException.priority)}`}>
                    {selectedException.priority}
                  </span>
                </div>
                <div className="detail-group">
                  <label>Status:</label>
                  <span className={`status-badge status-${selectedException.status}`}>
                    {selectedException.status}
                  </span>
                </div>
              </div>
              {selectedException.description && (
                <div className="detail-group">
                  <label>Beschreibung:</label>
                  <div className="description-text">{selectedException.description}</div>
                </div>
              )}
              {selectedException.impactAmount && (
                <div className="detail-group">
                  <label>Auswirkung:</label>
                  <span>{formatCurrency(selectedException.impactAmount)}</span>
                </div>
              )}
              {selectedException.resolution && (
                <div className="detail-group">
                  <label>Lösung:</label>
                  <div className="resolution-text">{selectedException.resolution}</div>
                </div>
              )}
              {selectedException.actionLog && selectedException.actionLog.length > 0 && (
                <div className="action-log">
                  <h4>Aktivitätsprotokoll</h4>
                  <ul>
                    {selectedException.actionLog.map((log, index) => (
                      <li key={index}>
                        <span className="log-time">
                          {new Date(log.timestamp).toLocaleString('de-DE')}
                        </span>
                        <span className="log-action">{log.action}</span>
                        {log.details && <span className="log-details">{log.details}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setSelectedException(null)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlausibilityChecks;
