import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { consolidationService } from '../services/consolidationService';
import { financialStatementService } from '../services/financialStatementService';
import { FinancialStatement, ConsolidationEntry } from '../types';
import ConsolidationImpactDashboard from '../components/ConsolidationImpactDashboard';
import IncomeStatementVisualization from '../components/IncomeStatementVisualization';
import { useToastContext } from '../contexts/ToastContext';
import '../App.css';

function Consolidation() {
  const { success, error: showError } = useToastContext();
  const [statements, setStatements] = useState<FinancialStatement[]>([]);
  const [selectedStatementId, setSelectedStatementId] = useState<string>('');
  const [entries, setEntries] = useState<ConsolidationEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStatements, setLoadingStatements] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatements();
  }, []);

  useEffect(() => {
    if (selectedStatementId) {
      loadEntries();
    }
  }, [selectedStatementId]);

  const loadStatements = async () => {
    setLoadingStatements(true);
    setError(null);
    try {
      const data = await financialStatementService.getAll();
      setStatements(data);
      if (data.length === 0) {
        setError('Keine Jahresabschlüsse gefunden. Bitte erstellen Sie zuerst einen Jahresabschluss oder importieren Sie Daten.');
      }
    } catch (error: any) {
      console.error('Fehler beim Laden der Jahresabschlüsse:', error);
      setError(`Fehler beim Laden der Jahresabschlüsse: ${error.message || 'Unbekannter Fehler'}. Bitte prüfen Sie, ob das Backend läuft.`);
    } finally {
      setLoadingStatements(false);
    }
  };

  const loadEntries = async () => {
    if (!selectedStatementId) return;
    setLoading(true);
    try {
      const data = await consolidationService.getEntries(selectedStatementId);
      setEntries(data);
    } catch (error) {
      console.error('Fehler beim Laden der Konsolidierungsbuchungen:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = async () => {
    if (!selectedStatementId) {
      showError('Bitte wählen Sie einen Jahresabschluss aus');
      return;
    }

    setCalculating(true);
    try {
      const result = await consolidationService.calculate(selectedStatementId);
      setEntries(result.entries);
      setSummary(result.summary);
      success(`Konsolidierung erfolgreich durchgeführt. ${result.summary.totalEntries} Buchungen erstellt.`);
    } catch (error: any) {
      console.error('Fehler bei der Konsolidierung:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Unbekannter Fehler';
      showError(`Fehler bei der Konsolidierung: ${errorMessage}`);
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-6)' }}>
        <h1>Konsolidierung</h1>
        {selectedStatementId && (
          <Link
            to={`/consolidated-notes/${selectedStatementId}`}
            className="button button-primary"
            style={{ textDecoration: 'none' }}
          >
            Konzernanhang anzeigen
          </Link>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Jahresabschluss auswählen</h2>
        </div>
        
        {error && (
          <div className="error-message">
            <strong>Hinweis:</strong> {error}
          </div>
        )}

        <div className="form-group">
          <label>Jahresabschluss *</label>
          {loadingStatements ? (
            <p>Lade Jahresabschlüsse...</p>
          ) : (
            <>
              <select
                value={selectedStatementId}
                onChange={(e) => setSelectedStatementId(e.target.value)}
                required
                disabled={statements.length === 0}
              >
                <option value="">-- Bitte wählen --</option>
                {statements.map((statement) => (
                  <option key={statement.id} value={statement.id}>
                    {statement.company?.name || 'Unbekannt'} - {statement.fiscalYear}
                  </option>
                ))}
              </select>
              {statements.length === 0 && (
                <p style={{ marginTop: 'var(--spacing-2)', color: 'var(--color-error)', fontSize: 'var(--font-size-sm)' }}>
                  Keine Jahresabschlüsse verfügbar. Bitte erstellen Sie zuerst einen Jahresabschluss oder importieren Sie Daten.
                </p>
              )}
            </>
          )}
        </div>

        <button
          className="button button-primary"
          onClick={handleCalculate}
          disabled={calculating || !selectedStatementId}
        >
          {calculating ? 'Konsolidiere...' : 'Konsolidierung durchführen'}
        </button>
      </div>

      {summary && entries.length > 0 && (
        <ConsolidationImpactDashboard entries={entries} summary={summary} />
      )}

      {selectedStatementId && summary && (
        <IncomeStatementVisualization financialStatementId={selectedStatementId} />
      )}

      {selectedStatementId && (
        <div className="card">
          <div className="card-header">
            <h2>Konsolidierungsbuchungen ({entries.length})</h2>
          </div>
          {loading ? (
            <div className="loading">
              <div className="loading-spinner"></div>
              <span>Lade Buchungen...</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Keine Konsolidierungsbuchungen vorhanden</div>
              <div className="empty-state-description">
                Führen Sie eine Konsolidierung durch, um Buchungen zu erstellen.
              </div>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Konto</th>
                  <th>Typ</th>
                  <th>Betrag</th>
                  <th>Beschreibung</th>
                  <th>Datum</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.account?.accountNumber || entry.accountId}</td>
                    <td>
                      <span className="badge badge-info">{entry.adjustmentType}</span>
                    </td>
                    <td style={{ 
                      color: entry.amount < 0 ? 'var(--color-error)' : 'var(--color-success)',
                      fontWeight: 'var(--font-weight-medium)'
                    }}>
                      {entry.amount.toLocaleString('de-DE', {
                        style: 'currency',
                        currency: 'EUR'
                      })}
                    </td>
                    <td>{entry.description || '-'}</td>
                    <td>{new Date(entry.createdAt).toLocaleDateString('de-DE')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default Consolidation;
