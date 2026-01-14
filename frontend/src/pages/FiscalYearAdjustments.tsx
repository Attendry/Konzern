import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fiscalYearAdjustmentService, FiscalYearAdjustment, ValidationResult } from '../services/fiscalYearAdjustmentService';
import { companyService } from '../services/companyService';
import { Company } from '../types';
import { useToastContext } from '../contexts/ToastContext';
import '../App.css';

function FiscalYearAdjustments() {
  const { financialStatementId } = useParams<{ financialStatementId?: string }>();
  const { success, error: showError } = useToastContext();

  const [loading, setLoading] = useState(true);
  const [adjustments, setAdjustments] = useState<FiscalYearAdjustment[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [groupReportingDate, setGroupReportingDate] = useState('');
  const [companiesWithDiffs, setCompaniesWithDiffs] = useState<{ company: any; validation: ValidationResult }[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create form state
  const [createForm, setCreateForm] = useState({
    companyId: '',
    subsidiaryFiscalYearEnd: '',
    groupReportingDate: '',
    adjustmentMethod: 'none' as FiscalYearAdjustment['adjustmentMethod'],
    justification: '',
  });
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  useEffect(() => {
    loadData();
  }, [financialStatementId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const companiesData = await companyService.getAll();
      setCompanies(companiesData);

      if (financialStatementId) {
        const adjustmentsData = await fiscalYearAdjustmentService.getByFinancialStatement(financialStatementId);
        setAdjustments(adjustmentsData);
      }

      // Set default group reporting date to current year end
      const today = new Date();
      const yearEnd = `${today.getFullYear()}-12-31`;
      setGroupReportingDate(yearEnd);
      setCreateForm(prev => ({ ...prev, groupReportingDate: yearEnd }));
    } catch (err: any) {
      showError(`Fehler beim Laden: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const checkCompaniesWithDifferences = async () => {
    if (!selectedCompanyId || !groupReportingDate) {
      showError('Bitte wählen Sie ein Mutterunternehmen und ein Berichtsdatum');
      return;
    }

    try {
      const results = await fiscalYearAdjustmentService.getCompaniesWithDifferences(
        selectedCompanyId,
        groupReportingDate,
      );
      setCompaniesWithDiffs(results);
      success(`${results.length} Tochtergesellschaften analysiert`);
    } catch (err: any) {
      showError(`Fehler bei der Analyse: ${err.message}`);
    }
  };

  const validateDates = async () => {
    if (!createForm.subsidiaryFiscalYearEnd || !createForm.groupReportingDate) return;

    try {
      const result = await fiscalYearAdjustmentService.validateDateDifference(
        createForm.subsidiaryFiscalYearEnd,
        createForm.groupReportingDate,
      );
      setValidation(result);

      // Suggest adjustment method
      if (!result.requiresAdjustment) {
        setCreateForm(prev => ({ ...prev, adjustmentMethod: 'none' }));
      } else if (result.hgbCompliant) {
        setCreateForm(prev => ({ ...prev, adjustmentMethod: 'pro_rata' }));
      } else {
        setCreateForm(prev => ({ ...prev, adjustmentMethod: 'interim_statement' }));
      }
    } catch (err: any) {
      showError(`Validierung fehlgeschlagen: ${err.message}`);
    }
  };

  useEffect(() => {
    if (createForm.subsidiaryFiscalYearEnd && createForm.groupReportingDate) {
      validateDates();
    }
  }, [createForm.subsidiaryFiscalYearEnd, createForm.groupReportingDate]);

  const handleCreate = async () => {
    try {
      const adjustment = await fiscalYearAdjustmentService.create({
        ...createForm,
        financialStatementId,
        groupFinancialStatementId: financialStatementId,
      });
      setAdjustments([adjustment, ...adjustments]);
      setShowCreateModal(false);
      setCreateForm({
        companyId: '',
        subsidiaryFiscalYearEnd: '',
        groupReportingDate: groupReportingDate,
        adjustmentMethod: 'none',
        justification: '',
      });
      setValidation(null);
      success('Stichtagsverschiebung erfolgreich erstellt');
    } catch (err: any) {
      showError(`Fehler beim Erstellen: ${err.message}`);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const updated = await fiscalYearAdjustmentService.approve(id);
      setAdjustments(adjustments.map(a => a.id === id ? updated : a));
      success('Stichtagsverschiebung freigegeben');
    } catch (err: any) {
      showError(`Fehler bei Freigabe: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Möchten Sie diese Stichtagsverschiebung wirklich löschen?')) return;

    try {
      await fiscalYearAdjustmentService.delete(id);
      setAdjustments(adjustments.filter(a => a.id !== id));
      success('Stichtagsverschiebung gelöscht');
    } catch (err: any) {
      showError(`Fehler beim Löschen: ${err.message}`);
    }
  };

  const getStatusBadge = (status: FiscalYearAdjustment['status']) => {
    const labels: Record<typeof status, string> = {
      pending: 'Ausstehend',
      in_progress: 'In Bearbeitung',
      completed: 'Abgeschlossen',
      approved: 'Freigegeben',
      rejected: 'Abgelehnt',
    };
    const colors: Record<typeof status, string> = {
      pending: 'badge-warning',
      in_progress: 'badge-info',
      completed: 'badge-success',
      approved: 'badge-success',
      rejected: 'badge-error',
    };
    return <span className={`badge ${colors[status]}`}>{labels[status]}</span>;
  };

  const getMethodLabel = (method: FiscalYearAdjustment['adjustmentMethod']) => {
    const labels: Record<typeof method, string> = {
      pro_rata: 'Pro-rata temporis',
      interim_statement: 'Zwischenabschluss',
      estimate: 'Schätzung',
      none: 'Keine Anpassung',
    };
    return labels[method];
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <span>Lade Daten...</span>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-6)' }}>
        <h1>Stichtagsverschiebungen (§ 299 HGB)</h1>
        <button
          className="button button-primary"
          onClick={() => setShowCreateModal(true)}
        >
          + Neue Stichtagsverschiebung
        </button>
      </div>

      {/* Analysis Card */}
      <div className="card">
        <div className="card-header">
          <h2>Tochtergesellschaften analysieren</h2>
        </div>
        <p style={{ marginBottom: 'var(--spacing-4)', color: 'var(--color-text-secondary)' }}>
          Analysieren Sie, welche Tochtergesellschaften abweichende Geschäftsjahresenden haben.
        </p>
        <div style={{ display: 'flex', gap: 'var(--spacing-4)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
            <label>Mutterunternehmen</label>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
            >
              <option value="">-- Auswählen --</option>
              {companies.filter(c => c.isUltimateParent || !c.parentCompanyId).map(company => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
            <label>Konzern-Berichtsstichtag</label>
            <input
              type="date"
              value={groupReportingDate}
              onChange={(e) => setGroupReportingDate(e.target.value)}
            />
          </div>
          <button
            className="button button-secondary"
            onClick={checkCompaniesWithDifferences}
            disabled={!selectedCompanyId || !groupReportingDate}
          >
            Analysieren
          </button>
        </div>

        {/* Results */}
        {companiesWithDiffs.length > 0 && (
          <div style={{ marginTop: 'var(--spacing-6)' }}>
            <h3>Ergebnisse</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Unternehmen</th>
                  <th>Geschäftsjahresende</th>
                  <th>Abweichung</th>
                  <th>HGB-konform</th>
                  <th>Empfehlung</th>
                  <th>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {companiesWithDiffs.map(({ company, validation }) => (
                  <tr key={company.id}>
                    <td>{company.name}</td>
                    <td>{new Date(company.subsidiaryFiscalYearEnd).toLocaleDateString('de-DE')}</td>
                    <td>{validation.differenceDays} Tage ({validation.differenceMonths} Monate)</td>
                    <td>
                      <span className={`badge ${validation.hgbCompliant ? 'badge-success' : 'badge-error'}`}>
                        {validation.hgbCompliant ? 'Ja' : 'Nein'}
                      </span>
                    </td>
                    <td style={{ maxWidth: '300px' }}>
                      {validation.recommendations[0] || '-'}
                    </td>
                    <td>
                      {validation.requiresAdjustment && (
                        <button
                          className="button button-secondary button-sm"
                          onClick={() => {
                            setCreateForm({
                              companyId: company.id,
                              subsidiaryFiscalYearEnd: company.subsidiaryFiscalYearEnd,
                              groupReportingDate,
                              adjustmentMethod: validation.hgbCompliant ? 'pro_rata' : 'interim_statement',
                              justification: '',
                            });
                            setShowCreateModal(true);
                          }}
                        >
                          Anpassung erstellen
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Existing Adjustments */}
      <div className="card">
        <div className="card-header">
          <h2>Bestehende Stichtagsverschiebungen ({adjustments.length})</h2>
        </div>
        {adjustments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">Keine Stichtagsverschiebungen vorhanden</div>
            <div className="empty-state-description">
              Analysieren Sie Ihre Tochtergesellschaften oder erstellen Sie manuell eine neue Stichtagsverschiebung.
            </div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Unternehmen</th>
                <th>Tochter-Stichtag</th>
                <th>Konzern-Stichtag</th>
                <th>Abweichung</th>
                <th>Methode</th>
                <th>Status</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.map(adjustment => (
                <tr key={adjustment.id}>
                  <td>{adjustment.companyName || adjustment.companyId.slice(0, 8)}</td>
                  <td>{new Date(adjustment.subsidiaryFiscalYearEnd).toLocaleDateString('de-DE')}</td>
                  <td>{new Date(adjustment.groupReportingDate).toLocaleDateString('de-DE')}</td>
                  <td>
                    {adjustment.differenceDays} Tage
                    <span className={`badge ${adjustment.isHgbCompliant ? 'badge-success' : 'badge-error'}`} style={{ marginLeft: 'var(--spacing-2)' }}>
                      {adjustment.isHgbCompliant ? 'HGB-konform' : '>3 Monate'}
                    </span>
                  </td>
                  <td>{getMethodLabel(adjustment.adjustmentMethod)}</td>
                  <td>{getStatusBadge(adjustment.status)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                      {adjustment.status === 'pending' && (
                        <button
                          className="button button-primary button-sm"
                          onClick={() => handleApprove(adjustment.id)}
                        >
                          Freigeben
                        </button>
                      )}
                      <button
                        className="button button-secondary button-sm"
                        onClick={() => handleDelete(adjustment.id)}
                      >
                        Löschen
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Neue Stichtagsverschiebung</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Unternehmen *</label>
                <select
                  value={createForm.companyId}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, companyId: e.target.value }))}
                  required
                >
                  <option value="">-- Auswählen --</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Geschäftsjahresende Tochter *</label>
                <input
                  type="date"
                  value={createForm.subsidiaryFiscalYearEnd}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, subsidiaryFiscalYearEnd: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Konzern-Berichtsstichtag *</label>
                <input
                  type="date"
                  value={createForm.groupReportingDate}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, groupReportingDate: e.target.value }))}
                  required
                />
              </div>

              {validation && (
                <div className={`alert ${validation.hgbCompliant ? 'alert-success' : 'alert-warning'}`}>
                  <strong>{validation.message}</strong>
                  {validation.recommendations.length > 0 && (
                    <ul style={{ marginTop: 'var(--spacing-2)', paddingLeft: 'var(--spacing-4)' }}>
                      {validation.recommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="form-group">
                <label>Anpassungsmethode *</label>
                <select
                  value={createForm.adjustmentMethod}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, adjustmentMethod: e.target.value as any }))}
                >
                  <option value="none">Keine Anpassung erforderlich</option>
                  <option value="pro_rata">Pro-rata temporis (zeitanteilig)</option>
                  <option value="interim_statement">Zwischenabschluss</option>
                  <option value="estimate">Schätzung</option>
                </select>
              </div>
              <div className="form-group">
                <label>Begründung</label>
                <textarea
                  value={createForm.justification}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, justification: e.target.value }))}
                  placeholder="Begründung für die gewählte Anpassungsmethode..."
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="button button-secondary" onClick={() => setShowCreateModal(false)}>
                Abbrechen
              </button>
              <button
                className="button button-primary"
                onClick={handleCreate}
                disabled={!createForm.companyId || !createForm.subsidiaryFiscalYearEnd || !createForm.groupReportingDate}
              >
                Erstellen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FiscalYearAdjustments;
