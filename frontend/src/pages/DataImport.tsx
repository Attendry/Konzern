import { useState, useEffect } from 'react';
import { importService } from '../services/importService';
import { financialStatementService } from '../services/financialStatementService';
import { companyService } from '../services/companyService';
import { FinancialStatement } from '../types';
import { useToastContext } from '../contexts/ToastContext';
import { ExcelMappingWizard } from '../components/ExcelMappingWizard';
import { BatchImportWizard } from '../components/BatchImportWizard';
import '../App.css';

type ImportMode = 'quick' | 'wizard' | 'batch';

function DataImport() {
  const { success, error: showError } = useToastContext();
  const [importMode, setImportMode] = useState<ImportMode>('quick');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'excel' | 'csv'>('excel');
  const [financialStatementId, setFinancialStatementId] = useState<string>('');
  const [statements, setStatements] = useState<FinancialStatement[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStatements, setLoadingStatements] = useState(true);
  const [result, setResult] = useState<{ imported: number; errors: string[]; warnings?: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newStatement, setNewStatement] = useState({
    companyId: '',
    fiscalYear: new Date().getFullYear(),
    periodStart: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    periodEnd: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0],
  });
  const [companies, setCompanies] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    loadStatements();
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const data = await companyService.getAll();
      setCompanies(data);
    } catch (error) {
      console.error('Fehler beim Laden der Unternehmen:', error);
    }
  };

  const loadStatements = async () => {
    setLoadingStatements(true);
    setError(null);
    try {
      const data = await financialStatementService.getAll();
      setStatements(data);
      if (data.length === 0) {
        setError('Keine Jahresabschlüsse gefunden. Bitte erstellen Sie zuerst einen Jahresabschluss.');
      }
    } catch (error: any) {
      console.error('Fehler beim Laden der Jahresabschlüsse:', error);
      setError(`Fehler beim Laden der Jahresabschlüsse: ${error.message || 'Unbekannter Fehler'}. Bitte prüfen Sie, ob das Backend läuft.`);
    } finally {
      setLoadingStatements(false);
    }
  };

  const handleCreateStatement = async () => {
    if (!newStatement.companyId) {
      showError('Bitte wählen Sie ein Unternehmen aus');
      return;
    }

    setCreating(true);
    try {
      const created = await financialStatementService.create(newStatement);
      setStatements([...statements, created]);
      setFinancialStatementId(created.id);
      setShowCreateForm(false);
      setError(null);
      success('Jahresabschluss erfolgreich erstellt');
    } catch (error: any) {
      console.error('Fehler beim Erstellen des Jahresabschlusses:', error);
      showError(`Fehler beim Erstellen: ${error.message || 'Unbekannter Fehler'}`);
    } finally {
      setCreating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Auto-detect file type
      if (file.name.endsWith('.csv')) {
        setFileType('csv');
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        setFileType('excel');
      }
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !financialStatementId) {
      showError('Bitte wählen Sie eine Datei und einen Jahresabschluss aus');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      let importResult;
      if (fileType === 'excel') {
        importResult = await importService.importExcel(selectedFile, financialStatementId);
      } else {
        importResult = await importService.importCsv(selectedFile, financialStatementId);
      }
      setResult(importResult);
      if (importResult.errors.length === 0) {
        success(`Erfolgreich ${importResult.imported} Datensätze importiert`);
      } else {
        showError(`Import mit ${importResult.errors.length} Fehler${importResult.errors.length > 1 ? 'n' : ''} abgeschlossen`);
      }
    } catch (error: any) {
      console.error('Fehler beim Import:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Unbekannter Fehler';
      showError(`Fehler beim Import: ${errorMessage}`);
      setError(`Import fehlgeschlagen: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await importService.downloadTemplate();
      success('Vorlage erfolgreich heruntergeladen');
    } catch (error: any) {
      console.error('Fehler beim Herunterladen der Vorlage:', error);
      showError(`Fehler beim Herunterladen der Vorlage: ${error.message || 'Unbekannter Fehler'}`);
    }
  };

  const handleWizardComplete = (wizardResult: { imported: number; errors: string[]; warnings: string[] }) => {
    setResult(wizardResult);
    setShowWizard(false);
    success(`Import erfolgreich: ${wizardResult.imported} Datensätze importiert`);
  };

  const selectedStatement = statements.find(s => s.id === financialStatementId);

  return (
    <div>
      <h1>Datenimport</h1>

      {/* Import Mode Toggle */}
      <div className="card" style={{ marginBottom: 'var(--spacing-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--spacing-4)', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'var(--font-weight-medium)' }}>Import-Modus:</span>
          <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
            <button
              className={`button ${importMode === 'quick' ? 'button-primary' : 'button-secondary'}`}
              onClick={() => { setImportMode('quick'); setShowWizard(false); }}
            >
              ⚡ Schnell-Import
            </button>
            <button
              className={`button ${importMode === 'wizard' ? 'button-primary' : 'button-secondary'}`}
              onClick={() => setImportMode('wizard')}
            >
              🧙 Import-Assistent
            </button>
            <button
              className={`button ${importMode === 'batch' ? 'button-primary' : 'button-secondary'}`}
              onClick={() => setImportMode('batch')}
            >
              📚 Multi-Unternehmen
            </button>
          </div>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            {importMode === 'quick' 
              ? 'Standard-Spaltenformat (Kontonummer, Soll, Haben)' 
              : importMode === 'wizard'
              ? 'Flexible Spaltenzuordnung für beliebige Excel-Formate'
              : 'Eine Excel-Datei mit mehreren Blättern (je Unternehmen)'}
          </span>
        </div>
      </div>

      {/* Batch Import Mode */}
      {importMode === 'batch' && (
        <div className="card">
          <div className="card-header">
            <h2>📚 Multi-Unternehmen Import</h2>
          </div>
          <BatchImportWizard
            fiscalYear={new Date().getFullYear()}
            onComplete={() => {
              setImportMode('quick');
              loadStatements();
            }}
            onCancel={() => setImportMode('quick')}
          />
        </div>
      )}

      {/* Wizard Mode */}
      {importMode === 'wizard' && showWizard && selectedStatement && (
        <div className="card">
          <ExcelMappingWizard
            financialStatementId={financialStatementId}
            companyName={selectedStatement.company?.name || 'Unbekannt'}
            fiscalYear={selectedStatement.fiscalYear}
            onImportComplete={handleWizardComplete}
            onCancel={() => setShowWizard(false)}
          />
        </div>
      )}

      {/* Wizard Mode - Statement Selection */}
      {importMode === 'wizard' && !showWizard && (
        <div className="card">
          <div className="card-header">
            <h2>🧙 Import-Assistent</h2>
          </div>
          <p style={{ marginBottom: 'var(--spacing-4)', color: 'var(--color-text-secondary)' }}>
            Der Import-Assistent ermöglicht das Importieren von Excel-Dateien mit beliebiger Spaltenstruktur.
            Sie können die Spalten flexibel den Systemfeldern zuordnen.
          </p>
          
          <div className="form-group">
            <label>Jahresabschluss auswählen *</label>
            {loadingStatements ? (
              <p>Lade Jahresabschlüsse...</p>
            ) : (
              <select
                value={financialStatementId}
                onChange={(e) => setFinancialStatementId(e.target.value)}
                required
              >
                <option value="">-- Bitte wählen --</option>
                {statements.map((statement) => (
                  <option key={statement.id} value={statement.id}>
                    {statement.company?.name || 'Unbekannt'} - {statement.fiscalYear}
                  </option>
                ))}
              </select>
            )}
          </div>
          
          <button
            className="button button-primary"
            onClick={() => setShowWizard(true)}
            disabled={!financialStatementId}
          >
            Import-Assistent starten →
          </button>
        </div>
      )}

      {/* Quick Import Mode */}
      {importMode === 'quick' && (
      <div className="card">
        <div className="card-header">
          <h2>⚡ Schnell-Import</h2>
        </div>
        
        {error && (
          <div className="error-message">
            <strong>Hinweis:</strong> {error}
            {statements.length === 0 && (
              <div style={{ marginTop: 'var(--spacing-3)' }}>
                <button 
                  className="button button-primary button-sm" 
                  onClick={() => setShowCreateForm(!showCreateForm)}
                >
                  {showCreateForm ? 'Abbrechen' : 'Jahresabschluss erstellen'}
                </button>
              </div>
            )}
          </div>
        )}

        {showCreateForm && (
          <div className="card" style={{ marginBottom: 'var(--spacing-4)', backgroundColor: 'var(--color-bg-tertiary)' }}>
            <h3>Neuen Jahresabschluss erstellen</h3>
            <div className="form-group">
              <label>Unternehmen *</label>
              <select
                value={newStatement.companyId}
                onChange={(e) => setNewStatement({ ...newStatement, companyId: e.target.value })}
                required
              >
                <option value="">-- Bitte wählen --</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Geschäftsjahr *</label>
              <input
                type="number"
                value={newStatement.fiscalYear}
                onChange={(e) => setNewStatement({ ...newStatement, fiscalYear: parseInt(e.target.value) })}
                required
              />
            </div>
            <div className="form-group">
              <label>Periodenstart *</label>
              <input
                type="date"
                value={newStatement.periodStart}
                onChange={(e) => setNewStatement({ ...newStatement, periodStart: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Periodenende *</label>
              <input
                type="date"
                value={newStatement.periodEnd}
                onChange={(e) => setNewStatement({ ...newStatement, periodEnd: e.target.value })}
                required
              />
            </div>
            <button
              className="button button-primary"
              onClick={handleCreateStatement}
              disabled={creating || !newStatement.companyId}
            >
              {creating ? 'Erstelle...' : 'Jahresabschluss erstellen'}
            </button>
          </div>
        )}

        <div className="form-group">
          <label>Jahresabschluss auswählen *</label>
          {loadingStatements ? (
            <p>Lade Jahresabschlüsse...</p>
          ) : (
            <>
              <select
                value={financialStatementId}
                onChange={(e) => setFinancialStatementId(e.target.value)}
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
                  Keine Jahresabschlüsse verfügbar. Bitte erstellen Sie zuerst einen Jahresabschluss.
                </p>
              )}
            </>
          )}
        </div>

        <div className="form-group">
          <label>Dateityp</label>
          <select
            value={fileType}
            onChange={(e) => setFileType(e.target.value as 'excel' | 'csv')}
          >
            <option value="excel">Excel (.xlsx, .xls)</option>
            <option value="csv">CSV (.csv)</option>
          </select>
        </div>

        <div className="form-group">
          <label>Datei auswählen *</label>
          <input
            type="file"
            accept={fileType === 'excel' ? '.xlsx,.xls' : '.csv'}
            onChange={handleFileChange}
            required
          />
          {selectedFile && (
            <p style={{ marginTop: 'var(--spacing-2)', color: 'var(--color-text-secondary)' }}>
              Ausgewählt: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 'var(--spacing-4)' }}>
          <button
            className="button button-primary"
            onClick={handleImport}
            disabled={loading || !selectedFile || !financialStatementId}
          >
            {loading ? 'Importiere...' : 'Importieren'}
          </button>
          <button className="button button-secondary" onClick={handleDownloadTemplate}>
            Vorlage herunterladen
          </button>
        </div>
      </div>
      )}

      {result && (
        <div className="card">
          <div className="card-header">
            <h2>Import-Ergebnis</h2>
          </div>
          <div className="success-message" style={{ marginBottom: 'var(--spacing-4)' }}>
            <strong>Importiert:</strong> {result.imported} Datensätze
          </div>
          {result.warnings && result.warnings.length > 0 && (
            <div style={{ marginTop: 'var(--spacing-4)', padding: 'var(--spacing-4)', backgroundColor: 'rgba(247, 201, 72, 0.1)', border: '1px solid var(--color-warning)', borderRadius: 'var(--radius-md)' }}>
              <strong>Warnungen ({result.warnings.length}):</strong>
              <ul style={{ marginTop: 'var(--spacing-2)', color: '#b8941f', paddingLeft: 'var(--spacing-5)' }}>
                {result.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          {result.errors.length > 0 && (
            <div style={{ marginTop: 'var(--spacing-4)' }}>
              <div className="error-message">
                <strong>Fehler ({result.errors.length}):</strong>
                <ul style={{ marginTop: 'var(--spacing-2)', paddingLeft: 'var(--spacing-5)' }}>
                  {result.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DataImport;
