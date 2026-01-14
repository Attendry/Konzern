import { useState, useEffect } from 'react';
import { 
  consolidationService, 
  ICReconciliation as ICReconType,
  ICReconciliationSummary,
  ICReconciliationStatus,
  ICDifferenceReason,
} from '../services/consolidationService';
import { useToastContext } from '../contexts/ToastContext';
import '../App.css';

interface ICReconciliationProps {
  financialStatementId: string;
  onEntryCreated?: () => void;
}

const STATUS_LABELS: Record<ICReconciliationStatus, string> = {
  open: 'Offen',
  explained: 'Erklärt',
  cleared: 'Ausgeglichen',
  accepted: 'Akzeptiert',
};

const REASON_LABELS: Record<ICDifferenceReason, string> = {
  timing: 'Zeitliche Differenz (Transaktion in Transit)',
  currency: 'Währungskursdifferenz',
  booking_error: 'Buchungsfehler',
  missing_entry: 'Fehlende Buchung',
  different_valuation: 'Unterschiedliche Bewertung',
  intercompany_profit: 'Zwischengewinn',
  other: 'Sonstige',
};

export function ICReconciliation({ financialStatementId, onEntryCreated }: ICReconciliationProps) {
  const { success, error: showError } = useToastContext();
  const [reconciliations, setReconciliations] = useState<ICReconType[]>([]);
  const [summary, setSummary] = useState<ICReconciliationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedRecon, setSelectedRecon] = useState<ICReconType | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveData, setResolveData] = useState({
    status: '' as ICReconciliationStatus | '',
    differenceReason: '' as ICDifferenceReason | '',
    explanation: '',
  });

  useEffect(() => {
    if (financialStatementId) {
      loadData();
    }
  }, [financialStatementId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reconData, summaryData] = await Promise.all([
        consolidationService.getICReconciliations(financialStatementId),
        consolidationService.getICReconciliationSummary(financialStatementId),
      ]);
      setReconciliations(reconData);
      setSummary(summaryData);
    } catch (error: any) {
      console.error('Fehler beim Laden der IC-Abstimmungen:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReconciliations = async () => {
    setCreating(true);
    try {
      const result = await consolidationService.createICReconciliations(financialStatementId);
      success(`${result.created} IC-Abstimmungen erstellt, ${result.differences} Differenzen gefunden`);
      loadData();
    } catch (error: any) {
      showError(`Fehler: ${error.response?.data?.message || error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleResolve = (recon: ICReconType) => {
    setSelectedRecon(recon);
    setResolveData({
      status: '',
      differenceReason: recon.differenceReason || '',
      explanation: recon.explanation || '',
    });
    setShowResolveModal(true);
  };

  const handleSaveResolution = async () => {
    if (!selectedRecon) return;
    
    try {
      await consolidationService.updateICReconciliation(selectedRecon.id, {
        status: resolveData.status || undefined,
        differenceReason: resolveData.differenceReason || undefined,
        explanation: resolveData.explanation || undefined,
        resolvedByUserId: 'current-user-id', // TODO: Get from auth context
      });
      success('Abstimmung aktualisiert');
      setShowResolveModal(false);
      setSelectedRecon(null);
      loadData();
    } catch (error: any) {
      showError(`Fehler: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleGenerateClearingEntry = async (recon: ICReconType) => {
    if (!confirm('Möchten Sie eine Ausgleichsbuchung für diese Differenz erstellen?')) return;
    
    try {
      await consolidationService.generateClearingEntry(
        recon.id,
        'current-user-id', // TODO: Get from auth context
      );
      success('Ausgleichsbuchung erstellt');
      loadData();
      onEntryCreated?.();
    } catch (error: any) {
      showError(`Fehler: ${error.response?.data?.message || error.message}`);
    }
  };

  const getStatusBadge = (status: ICReconciliationStatus) => {
    const colors: Record<ICReconciliationStatus, string> = {
      open: 'var(--color-warning)',
      explained: 'var(--color-info)',
      cleared: 'var(--color-success)',
      accepted: 'var(--color-accent-purple)',
    };
    return (
      <span 
        className="badge" 
        style={{ 
          backgroundColor: `${colors[status]}20`, 
          color: colors[status],
          padding: 'var(--spacing-1) var(--spacing-2)',
          borderRadius: 'var(--radius-full)',
          fontSize: 'var(--font-size-xs)',
        }}
      >
        {STATUS_LABELS[status]}
      </span>
    );
  };

  return (
    <div className="ic-reconciliation">
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>IC-Abstimmung (Intercompany Reconciliation)</h2>
          <button
            className="button button-primary"
            onClick={handleCreateReconciliations}
            disabled={creating}
          >
            {creating ? 'Erstelle...' : 'IC-Transaktionen abgleichen'}
          </button>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="ic-summary" style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
            gap: 'var(--spacing-4)',
            marginBottom: 'var(--spacing-6)',
          }}>
            <div className="summary-card" style={{ 
              padding: 'var(--spacing-4)', 
              background: 'var(--color-bg-tertiary)', 
              borderRadius: 'var(--radius-lg)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
                {summary.total}
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                Gesamt
              </div>
            </div>
            <div className="summary-card" style={{ 
              padding: 'var(--spacing-4)', 
              background: 'rgba(247, 201, 72, 0.1)', 
              borderRadius: 'var(--radius-lg)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-warning)' }}>
                {summary.open}
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                Offen
              </div>
            </div>
            <div className="summary-card" style={{ 
              padding: 'var(--spacing-4)', 
              background: 'rgba(15, 123, 15, 0.1)', 
              borderRadius: 'var(--radius-lg)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
                {summary.cleared}
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                Ausgeglichen
              </div>
            </div>
            <div className="summary-card" style={{ 
              padding: 'var(--spacing-4)', 
              background: 'rgba(225, 98, 89, 0.1)', 
              borderRadius: 'var(--radius-lg)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-error)' }}>
                {summary.openDifferenceAmount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                Offene Differenz
              </div>
            </div>
          </div>
        )}

        {/* Reconciliation Table */}
        {loading ? (
          <div className="loading">
            <div className="loading-spinner"></div>
            <span>Lade IC-Abstimmungen...</span>
          </div>
        ) : reconciliations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">Keine IC-Abstimmungen vorhanden</div>
            <div className="empty-state-description">
              Klicken Sie auf "IC-Transaktionen abgleichen", um Intercompany-Positionen zu prüfen.
            </div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Gesellschaft A</th>
                <th>Gesellschaft B</th>
                <th>Konto A</th>
                <th>Konto B</th>
                <th style={{ textAlign: 'right' }}>Betrag A</th>
                <th style={{ textAlign: 'right' }}>Betrag B</th>
                <th style={{ textAlign: 'right' }}>Differenz</th>
                <th>Status</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {reconciliations.map((recon) => (
                <tr key={recon.id}>
                  <td>{recon.companyA?.name || recon.companyAId?.slice(0, 8)}</td>
                  <td>{recon.companyB?.name || recon.companyBId?.slice(0, 8)}</td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-family-mono)' }}>
                      {recon.accountA?.accountNumber}
                    </span>
                    <br />
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                      {recon.accountA?.name}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-family-mono)' }}>
                      {recon.accountB?.accountNumber}
                    </span>
                    <br />
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                      {recon.accountB?.name}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-family-mono)' }}>
                    {Number(recon.amountCompanyA).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-family-mono)' }}>
                    {Number(recon.amountCompanyB).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </td>
                  <td style={{ 
                    textAlign: 'right', 
                    fontFamily: 'var(--font-family-mono)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: Math.abs(Number(recon.differenceAmount)) > 0.01 ? 'var(--color-error)' : 'var(--color-success)',
                  }}>
                    {Number(recon.differenceAmount).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </td>
                  <td>{getStatusBadge(recon.status)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                      {recon.status === 'open' && (
                        <>
                          <button
                            className="button button-secondary"
                            onClick={() => handleResolve(recon)}
                            title="Differenz erklären"
                            style={{ padding: 'var(--spacing-1) var(--spacing-2)', fontSize: 'var(--font-size-xs)' }}
                          >
                            Bearbeiten
                          </button>
                          <button
                            className="button button-primary"
                            onClick={() => handleGenerateClearingEntry(recon)}
                            title="Ausgleichsbuchung erstellen"
                            style={{ padding: 'var(--spacing-1) var(--spacing-2)', fontSize: 'var(--font-size-xs)' }}
                          >
                            Ausgleichen
                          </button>
                        </>
                      )}
                      {recon.status === 'explained' && (
                        <button
                          className="button button-secondary"
                          onClick={() => handleResolve(recon)}
                          title="Bearbeiten"
                          style={{ padding: 'var(--spacing-1) var(--spacing-2)', fontSize: 'var(--font-size-xs)' }}
                        >
                          Bearbeiten
                        </button>
                      )}
                      {recon.clearingEntryId && (
                        <span 
                          title="Ausgleichsbuchung vorhanden"
                          style={{ color: 'var(--color-success)' }}
                        >
                          [OK]
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Resolve Modal */}
      {showResolveModal && selectedRecon && (
        <div className="modal-overlay" onClick={() => setShowResolveModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>IC-Differenz bearbeiten</h3>
              <button className="modal-close" onClick={() => setShowResolveModal(false)}>×</button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <label>Differenzbetrag</label>
                <div style={{ 
                  fontSize: 'var(--font-size-xl)', 
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'var(--color-error)',
                }}>
                  {Number(selectedRecon.differenceAmount).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="status">Status</label>
                <select
                  id="status"
                  value={resolveData.status}
                  onChange={(e) => setResolveData({ ...resolveData, status: e.target.value as ICReconciliationStatus })}
                >
                  <option value="">-- Auswählen --</option>
                  <option value="explained">Erklärt</option>
                  <option value="accepted">Akzeptiert (unwesentlich)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="reason">Grund der Differenz</label>
                <select
                  id="reason"
                  value={resolveData.differenceReason}
                  onChange={(e) => setResolveData({ ...resolveData, differenceReason: e.target.value as ICDifferenceReason })}
                >
                  <option value="">-- Auswählen --</option>
                  {Object.entries(REASON_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="explanation">Erklärung</label>
                <textarea
                  id="explanation"
                  value={resolveData.explanation}
                  onChange={(e) => setResolveData({ ...resolveData, explanation: e.target.value })}
                  rows={3}
                  placeholder="Beschreiben Sie die Ursache der Differenz..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="button button-secondary"
                onClick={() => setShowResolveModal(false)}
              >
                Abbrechen
              </button>
              <button
                className="button button-primary"
                onClick={handleSaveResolution}
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
