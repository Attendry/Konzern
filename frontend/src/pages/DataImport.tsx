import { useState, useEffect } from 'react';
import { importService } from '../services/importService';
import { financialStatementService } from '../services/financialStatementService';
import { companyService } from '../services/companyService';
import { FinancialStatement } from '../types';
import '../App.css';

function DataImport() {
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
      alert('Bitte wählen Sie ein Unternehmen aus');
      return;
    }

    setCreating(true);
    try {
      const created = await financialStatementService.create(newStatement);
      setStatements([...statements, created]);
      setFinancialStatementId(created.id);
      setShowCreateForm(false);
      setError(null);
      alert('Jahresabschluss erfolgreich erstellt');
    } catch (error: any) {
      console.error('Fehler beim Erstellen des Jahresabschlusses:', error);
      alert(`Fehler beim Erstellen: ${error.message || 'Unbekannter Fehler'}`);
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
      alert('Bitte wählen Sie eine Datei und einen Jahresabschluss aus');
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
        alert(`Erfolgreich ${importResult.imported} Datensätze importiert`);
      }
    } catch (error: any) {
      console.error('Fehler beim Import:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Unbekannter Fehler';
      alert(`Fehler beim Import: ${errorMessage}`);
      setError(`Import fehlgeschlagen: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await importService.downloadTemplate();
      alert('Vorlage erfolgreich heruntergeladen');
    } catch (error: any) {
      console.error('Fehler beim Herunterladen der Vorlage:', error);
      alert(`Fehler beim Herunterladen der Vorlage: ${error.message || 'Unbekannter Fehler'}`);
    }
  };

  return (
    <div>
      <h1>Datenimport</h1>

      <div className="card">
        <h2>Datei importieren</h2>
        
        {error && (
          <div style={{ 
            padding: '1rem', 
            marginBottom: '1rem', 
            backgroundColor: '#fee', 
            border: '1px solid #fcc',
            borderRadius: '4px',
            color: '#c33'
          }}>
            <strong>Hinweis:</strong> {error}
            {statements.length === 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <button 
                  className="button" 
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                >
                  {showCreateForm ? 'Abbrechen' : 'Jahresabschluss erstellen'}
                </button>
              </div>
            )}
          </div>
        )}

        {showCreateForm && (
          <div className="card" style={{ marginBottom: '1rem', backgroundColor: '#f9f9f9' }}>
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
              className="button"
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
                <p style={{ marginTop: '0.5rem', color: '#e74c3c', fontSize: '0.9rem' }}>
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
            <p style={{ marginTop: '0.5rem', color: '#666' }}>
              Ausgewählt: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            className="button"
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

      {result && (
        <div className="card">
          <h2>Import-Ergebnis</h2>
          <p>
            <strong>Importiert:</strong> {result.imported} Datensätze
          </p>
          {result.warnings && result.warnings.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <strong>Warnungen ({result.warnings.length}):</strong>
              <ul style={{ marginTop: '0.5rem', color: '#f39c12' }}>
                {result.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          {result.errors.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <strong>Fehler ({result.errors.length}):</strong>
              <ul style={{ marginTop: '0.5rem', color: '#e74c3c' }}>
                {result.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DataImport;
