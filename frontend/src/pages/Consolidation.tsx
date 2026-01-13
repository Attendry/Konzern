import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { consolidationService } from '../services/consolidationService';
import { financialStatementService } from '../services/financialStatementService';
import { companyService } from '../services/companyService';
import { reportService } from '../services/reportService';
import { 
  FinancialStatement, 
  ConsolidationEntry, 
  Account, 
  Company,
  EntryStatus,
  EntrySource,
  CreateConsolidationEntryRequest,
  UpdateConsolidationEntryRequest,
} from '../types';
import ConsolidationImpactDashboard from '../components/ConsolidationImpactDashboard';
import IncomeStatementVisualization from '../components/IncomeStatementVisualization';
import { ManualEntryForm } from '../components/ManualEntryForm';
import { ICReconciliation } from '../components/ICReconciliation';
import { FirstConsolidationWizard } from '../components/FirstConsolidationWizard';
import { MinorityInterestDashboard } from '../components/MinorityInterestDashboard';
import { useToastContext } from '../contexts/ToastContext';
import '../App.css';

type EntryTab = 'all' | 'manual' | 'pending';

function Consolidation() {
  const navigate = useNavigate();
  const { success, error: showError } = useToastContext();
  const [statements, setStatements] = useState<FinancialStatement[]>([]);
  const [selectedStatementId, setSelectedStatementId] = useState<string>('');
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [entries, setEntries] = useState<ConsolidationEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStatements, setLoadingStatements] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Manual entry state
  const [showManualEntryForm, setShowManualEntryForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ConsolidationEntry | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeTab, setActiveTab] = useState<EntryTab>('all');
  const [statusFilter, setStatusFilter] = useState<EntryStatus | ''>('');
  const [sourceFilter, setSourceFilter] = useState<EntrySource | ''>('');
  
  // Phase 2: First Consolidation & Minority Interests
  const [showFirstConsolidationWizard, setShowFirstConsolidationWizard] = useState(false);
  const [showMinorityDashboard, setShowMinorityDashboard] = useState(false);

  useEffect(() => {
    loadStatements();
    loadCompanies();
  }, []);

  useEffect(() => {
    if (selectedStatementId) {
      loadEntries();
      loadAccounts();
    }
  }, [selectedStatementId, statusFilter, sourceFilter]);

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

  const loadCompanies = async () => {
    try {
      const data = await companyService.getAll();
      setCompanies(data);
    } catch (error) {
      console.error('Fehler beim Laden der Unternehmen:', error);
    }
  };

  const loadAccounts = async () => {
    try {
      // Load accounts for the selected financial statement
      const balances = await financialStatementService.getBalances(selectedStatementId);
      const uniqueAccounts = balances
        .filter((b: any) => b.account)
        .map((b: any) => b.account)
        .filter((account: Account, index: number, self: Account[]) => 
          index === self.findIndex(a => a.id === account.id)
        );
      setAccounts(uniqueAccounts);
    } catch (error) {
      console.error('Fehler beim Laden der Konten:', error);
    }
  };

  const loadEntries = async () => {
    if (!selectedStatementId) return;
    setLoading(true);
    try {
      const filters: any = {};
      if (statusFilter) filters.status = statusFilter;
      if (sourceFilter) filters.source = sourceFilter;
      
      const data = await consolidationService.getEntries(selectedStatementId, filters);
      setEntries(data);
    } catch (error) {
      console.error('Fehler beim Laden der Konsolidierungsbuchungen:', error);
    } finally {
      setLoading(false);
    }
  };

  // Manual entry handlers
  const handleCreateEntry = async (entryData: CreateConsolidationEntryRequest | UpdateConsolidationEntryRequest) => {
    try {
      if (editingEntry) {
        await consolidationService.updateEntry(editingEntry.id, entryData as UpdateConsolidationEntryRequest);
        success('Buchung erfolgreich aktualisiert');
      } else {
        await consolidationService.createEntry(entryData as CreateConsolidationEntryRequest);
        success('Buchung erfolgreich erstellt');
      }
      setShowManualEntryForm(false);
      setEditingEntry(null);
      loadEntries();
    } catch (error: any) {
      showError(`Fehler: ${error.response?.data?.message || error.message}`);
      throw error;
    }
  };

  const handleEditEntry = (entry: ConsolidationEntry) => {
    if (entry.status !== 'draft') {
      showError('Nur Buchungen im Status "Entwurf" können bearbeitet werden');
      return;
    }
    setEditingEntry(entry);
    setShowManualEntryForm(true);
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Möchten Sie diese Buchung wirklich löschen?')) return;
    
    try {
      await consolidationService.deleteEntry(entryId);
      success('Buchung erfolgreich gelöscht');
      loadEntries();
    } catch (error: any) {
      showError(`Fehler: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleSubmitForApproval = async (entryId: string) => {
    try {
      await consolidationService.submitForApproval(entryId);
      success('Buchung zur Freigabe eingereicht');
      loadEntries();
    } catch (error: any) {
      showError(`Fehler: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleApproveEntry = async (entryId: string) => {
    // In production, this would use the actual logged-in user ID
    const approverUserId = 'current-user-id'; // TODO: Get from auth context
    try {
      await consolidationService.approveEntry(entryId, approverUserId);
      success('Buchung freigegeben');
      loadEntries();
    } catch (error: any) {
      showError(`Fehler: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleRejectEntry = async (entryId: string) => {
    const reason = prompt('Bitte geben Sie einen Ablehnungsgrund ein:');
    if (!reason) return;
    
    const rejecterUserId = 'current-user-id'; // TODO: Get from auth context
    try {
      await consolidationService.rejectEntry(entryId, rejecterUserId, reason);
      success('Buchung abgelehnt');
      loadEntries();
    } catch (error: any) {
      showError(`Fehler: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleReverseEntry = async (entryId: string) => {
    const reason = prompt('Bitte geben Sie einen Stornogrund ein:');
    if (!reason) return;
    
    const userId = 'current-user-id'; // TODO: Get from auth context
    try {
      await consolidationService.reverseEntry(entryId, userId, reason);
      success('Buchung storniert');
      loadEntries();
    } catch (error: any) {
      showError(`Fehler: ${error.response?.data?.message || error.message}`);
    }
  };

  // Filter entries by tab
  const getFilteredEntries = () => {
    switch (activeTab) {
      case 'manual':
        return entries.filter(e => e.source === 'manual');
      case 'pending':
        return entries.filter(e => e.status === 'pending');
      default:
        return entries;
    }
  };

  const filteredEntries = getFilteredEntries();
  const manualCount = entries.filter(e => e.source === 'manual').length;
  const pendingCount = entries.filter(e => e.status === 'pending').length;

  // Status badge helper
  const getStatusBadge = (status: EntryStatus) => {
    const labels: Record<EntryStatus, string> = {
      draft: 'Entwurf',
      pending: 'Zur Prüfung',
      approved: 'Freigegeben',
      rejected: 'Abgelehnt',
      reversed: 'Storniert',
    };
    return <span className={`entry-status ${status}`}>{labels[status]}</span>;
  };

  // Source badge helper
  const getSourceBadge = (source: EntrySource) => {
    const labels: Record<EntrySource, string> = {
      automatic: 'Automatisch',
      manual: 'Manuell',
      import: 'Import',
    };
    return <span className={`entry-source ${source}`}>{labels[source]}</span>;
  };

  // Export handlers
  const handleExport = async (format: 'excel' | 'pdf') => {
    if (!selectedStatementId) {
      showError('Bitte wählen Sie zuerst einen Jahresabschluss aus');
      return;
    }
    
    setExporting(format);
    try {
      let blob: Blob;
      let filename: string;
      const statement = statements.find(s => s.id === selectedStatementId);
      const fiscalYear = statement?.fiscalYear || 'export';
      
      if (format === 'excel') {
        blob = await reportService.exportToExcel(selectedStatementId);
        filename = `Konzernabschluss_${fiscalYear}.xlsx`;
      } else {
        blob = await reportService.exportToPdf(selectedStatementId);
        filename = `Konzernabschluss_${fiscalYear}.pdf`;
      }
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      success(`${format.toUpperCase()} Export erfolgreich heruntergeladen`);
    } catch (error: any) {
      console.error(`Export error (${format}):`, error);
      showError(`Export fehlgeschlagen: ${error.response?.data?.message || error.message || 'Unbekannter Fehler'}`);
    } finally {
      setExporting(null);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-6)', flexWrap: 'wrap', gap: 'var(--spacing-4)' }}>
        <h1>Konsolidierung</h1>
        <div style={{ display: 'flex', gap: 'var(--spacing-3)', flexWrap: 'wrap' }}>
          <button
            className="button button-primary"
            onClick={() => navigate('/konsolidierung-assistent')}
          >
            🧙 Assistent
          </button>
          <button
            className="button button-secondary"
            onClick={() => setShowFirstConsolidationWizard(true)}
          >
            Erstkonsolidierung
          </button>
          <button
            className="button button-secondary"
            onClick={() => setShowMinorityDashboard(!showMinorityDashboard)}
          >
            {showMinorityDashboard ? 'Minderheiten ausblenden' : 'Minderheitenanteile'}
          </button>
          {selectedStatementId && (
            <>
              <button
                className="button button-secondary"
                onClick={() => handleExport('excel')}
                disabled={exporting !== null}
              >
                {exporting === 'excel' ? '⏳ Exportiere...' : '📊 Excel Export'}
              </button>
              <button
                className="button button-secondary"
                onClick={() => handleExport('pdf')}
                disabled={exporting !== null}
              >
                {exporting === 'pdf' ? '⏳ Exportiere...' : '📄 PDF Export'}
              </button>
              <button
                className="button button-primary"
                onClick={() => navigate(`/konzernabschluss/${selectedStatementId}`)}
              >
                📈 Konzernabschluss ansehen
              </button>
              <Link
                to={`/consolidated-notes/${selectedStatementId}`}
                className="button button-secondary"
                style={{ textDecoration: 'none' }}
              >
                Konzernanhang
              </Link>
            </>
          )}
        </div>
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

      {/* IC Reconciliation Section */}
      {selectedStatementId && (
        <ICReconciliation 
          financialStatementId={selectedStatementId} 
          onEntryCreated={loadEntries}
        />
      )}

      {selectedStatementId && (
        <div className="card">
          <div className="entry-list-header">
            <h2>Konsolidierungsbuchungen ({entries.length})</h2>
            <button
              className="button button-primary"
              onClick={() => {
                setEditingEntry(null);
                setShowManualEntryForm(true);
              }}
            >
              + Manuelle Buchung
            </button>
          </div>

          {/* Tabs */}
          <div className="entry-tabs">
            <button
              className={`entry-tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              Alle
              <span className="badge-count">{entries.length}</span>
            </button>
            <button
              className={`entry-tab ${activeTab === 'manual' ? 'active' : ''}`}
              onClick={() => setActiveTab('manual')}
            >
              Manuell
              <span className="badge-count">{manualCount}</span>
            </button>
            <button
              className={`entry-tab ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              Zur Freigabe
              <span className="badge-count">{pendingCount}</span>
            </button>
          </div>

          {/* Filters */}
          <div className="entry-list-filters" style={{ marginBottom: 'var(--spacing-4)' }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as EntryStatus | '')}
            >
              <option value="">Alle Status</option>
              <option value="draft">Entwurf</option>
              <option value="pending">Zur Prüfung</option>
              <option value="approved">Freigegeben</option>
              <option value="rejected">Abgelehnt</option>
              <option value="reversed">Storniert</option>
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as EntrySource | '')}
            >
              <option value="">Alle Quellen</option>
              <option value="automatic">Automatisch</option>
              <option value="manual">Manuell</option>
              <option value="import">Import</option>
            </select>
          </div>

          {loading ? (
            <div className="loading">
              <div className="loading-spinner"></div>
              <span>Lade Buchungen...</span>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Keine Konsolidierungsbuchungen vorhanden</div>
              <div className="empty-state-description">
                {activeTab === 'manual' 
                  ? 'Erstellen Sie eine manuelle Buchung mit dem Button oben.'
                  : activeTab === 'pending'
                  ? 'Keine Buchungen zur Freigabe vorhanden.'
                  : 'Führen Sie eine Konsolidierung durch oder erstellen Sie eine manuelle Buchung.'}
              </div>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Buchungssatz</th>
                  <th>Typ</th>
                  <th>Betrag</th>
                  <th>Status</th>
                  <th>Quelle</th>
                  <th>Beschreibung</th>
                  <th>Datum</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <div className="booking-display">
                        {entry.debitAccount ? (
                          <>
                            <div className="booking-line debit">
                              <span className="account-number">{entry.debitAccount.accountNumber}</span>
                              <span className="account-name">{entry.debitAccount.name}</span>
                            </div>
                            <div className="booking-line credit">
                              <span className="account-number">{entry.creditAccount?.accountNumber}</span>
                              <span className="account-name">{entry.creditAccount?.name}</span>
                            </div>
                          </>
                        ) : (
                          <span>{entry.account?.accountNumber || entry.accountId?.slice(0, 8)}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-info">{entry.adjustmentType.replace('_', ' ')}</span>
                      {entry.hgbReference && (
                        <span className="hgb-reference" style={{ marginLeft: 'var(--spacing-2)' }}>
                          {entry.hgbReference}
                        </span>
                      )}
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
                    <td>{getStatusBadge(entry.status)}</td>
                    <td>{getSourceBadge(entry.source)}</td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {entry.description || '-'}
                    </td>
                    <td>{new Date(entry.createdAt).toLocaleDateString('de-DE')}</td>
                    <td>
                      <div className="entry-actions">
                        {entry.status === 'draft' && (
                          <>
                            <button
                              className="button button-secondary"
                              onClick={() => handleEditEntry(entry)}
                              title="Bearbeiten"
                            >
                              ✏️
                            </button>
                            <button
                              className="button button-secondary"
                              onClick={() => handleSubmitForApproval(entry.id)}
                              title="Zur Freigabe einreichen"
                            >
                              📤
                            </button>
                            <button
                              className="button button-secondary"
                              onClick={() => handleDeleteEntry(entry.id)}
                              title="Löschen"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                        {entry.status === 'pending' && (
                          <>
                            <button
                              className="button button-primary"
                              onClick={() => handleApproveEntry(entry.id)}
                              title="Freigeben"
                            >
                              ✅
                            </button>
                            <button
                              className="button button-secondary"
                              onClick={() => handleRejectEntry(entry.id)}
                              title="Ablehnen"
                            >
                              ❌
                            </button>
                          </>
                        )}
                        {entry.status === 'approved' && entry.source === 'manual' && (
                          <button
                            className="button button-secondary"
                            onClick={() => handleReverseEntry(entry.id)}
                            title="Stornieren"
                          >
                            ↩️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Minority Interest Dashboard */}
      {showMinorityDashboard && selectedStatementId && (
        <div className="card" style={{ marginTop: 'var(--spacing-6)' }}>
          <MinorityInterestDashboard
            financialStatementId={selectedStatementId}
            onRefresh={loadEntries}
          />
        </div>
      )}

      {/* Manual Entry Form Modal */}
      <ManualEntryForm
        isOpen={showManualEntryForm}
        onClose={() => {
          setShowManualEntryForm(false);
          setEditingEntry(null);
        }}
        onSubmit={handleCreateEntry}
        financialStatementId={selectedStatementId}
        accounts={accounts}
        companies={companies}
        editEntry={editingEntry}
      />

      {/* First Consolidation Wizard */}
      <FirstConsolidationWizard
        isOpen={showFirstConsolidationWizard}
        onClose={() => setShowFirstConsolidationWizard(false)}
        onComplete={() => {
          setShowFirstConsolidationWizard(false);
          loadEntries();
          loadCompanies();
        }}
      />
    </div>
  );
}

export default Consolidation;
