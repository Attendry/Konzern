import { useState, useRef } from 'react';
import { useToastContext } from '../contexts/ToastContext';
import { companyService } from '../services/companyService';
import { financialStatementService } from '../services/financialStatementService';
import { importService } from '../services/importService';
import { Company, FinancialStatement } from '../types';
import * as XLSX from 'xlsx';
import '../App.css';

interface SheetMapping {
  sheetName: string;
  companyId: string;
  companyName: string;
  financialStatementId: string;
  rowCount: number;
  status: 'pending' | 'importing' | 'success' | 'error';
  result?: { imported: number; errors: string[] };
}

interface BatchImportWizardProps {
  fiscalYear: number;
  onComplete: () => void;
  onCancel: () => void;
}

type WizardStep = 'upload' | 'mapping' | 'importing' | 'complete';

export function BatchImportWizard({ fiscalYear, onComplete, onCancel }: BatchImportWizardProps) {
  const { success, error: showError } = useToastContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<WizardStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetMappings, setSheetMappings] = useState<SheetMapping[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [statements, setStatements] = useState<FinancialStatement[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const loadCompaniesAndStatements = async () => {
    try {
      const [companiesData, statementsData] = await Promise.all([
        companyService.getAll(),
        financialStatementService.getAll(),
      ]);
      setCompanies(companiesData);
      setStatements(statementsData.filter(s => s.fiscalYear === fiscalYear));
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = async (selectedFile: File) => {
    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      showError('Bitte wählen Sie eine Excel-Datei (.xlsx oder .xls)');
      return;
    }

    setFile(selectedFile);
    setLoading(true);

    try {
      await loadCompaniesAndStatements();
      
      const arrayBuffer = await selectedFile.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      setWorkbook(wb);

      // Create sheet mappings with auto-detection
      const mappings: SheetMapping[] = wb.SheetNames.map((sheetName: string) => {
        const sheet = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const rowCount = Math.max(0, data.length - 1); // Exclude header row

        // Try to auto-match company by sheet name
        const matchedCompany = companies.find(c => 
          c.name.toLowerCase().includes(sheetName.toLowerCase()) ||
          sheetName.toLowerCase().includes(c.name.toLowerCase())
        );

        // Find or create statement for matched company
        let statementId = '';
        if (matchedCompany) {
          const existingStatement = statements.find(s => 
            s.companyId === matchedCompany.id && s.fiscalYear === fiscalYear
          );
          statementId = existingStatement?.id || '';
        }

        return {
          sheetName,
          companyId: matchedCompany?.id || '',
          companyName: matchedCompany?.name || '',
          financialStatementId: statementId,
          rowCount,
          status: 'pending' as const,
        };
      });

      setSheetMappings(mappings);
      setStep('mapping');
    } catch (err) {
      console.error('Error reading file:', err);
      showError('Fehler beim Lesen der Datei');
    } finally {
      setLoading(false);
    }
  };

  const updateSheetMapping = (index: number, companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    const statement = statements.find(s => s.companyId === companyId && s.fiscalYear === fiscalYear);

    setSheetMappings(prev => prev.map((m, i) => 
      i === index 
        ? { 
            ...m, 
            companyId, 
            companyName: company?.name || '',
            financialStatementId: statement?.id || '',
          } 
        : m
    ));
  };

  const createMissingStatement = async (index: number) => {
    const mapping = sheetMappings[index];
    if (!mapping.companyId) {
      showError('Bitte wählen Sie zuerst ein Unternehmen aus');
      return;
    }

    try {
      const newStatement = await financialStatementService.create({
        companyId: mapping.companyId,
        fiscalYear,
        periodStart: new Date(fiscalYear, 0, 1).toISOString().split('T')[0],
        periodEnd: new Date(fiscalYear, 11, 31).toISOString().split('T')[0],
      });

      setStatements(prev => [...prev, newStatement]);
      setSheetMappings(prev => prev.map((m, i) => 
        i === index ? { ...m, financialStatementId: newStatement.id } : m
      ));
      success('Jahresabschluss erstellt');
    } catch (error: any) {
      showError(`Fehler: ${error.message}`);
    }
  };

  const handleStartImport = async () => {
    const validMappings = sheetMappings.filter(m => m.financialStatementId && m.companyId);
    
    if (validMappings.length === 0) {
      showError('Mindestens ein Blatt muss einem Unternehmen zugeordnet sein');
      return;
    }

    setStep('importing');

    for (let i = 0; i < sheetMappings.length; i++) {
      const mapping = sheetMappings[i];
      
      if (!mapping.financialStatementId || !mapping.companyId) {
        setSheetMappings(prev => prev.map((m, idx) => 
          idx === i ? { ...m, status: 'error', result: { imported: 0, errors: ['Nicht konfiguriert'] } } : m
        ));
        continue;
      }

      // Update status to importing
      setSheetMappings(prev => prev.map((m, idx) => 
        idx === i ? { ...m, status: 'importing' } : m
      ));

      try {
        // Extract sheet data and send to backend
        if (!workbook) throw new Error('Workbook not loaded');
        
        const sheet = workbook.Sheets[mapping.sheetName];
        const newWorkbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(newWorkbook, sheet, mapping.sheetName);
        const buffer = XLSX.write(newWorkbook, { type: 'array', bookType: 'xlsx' });
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const sheetFile = new File([blob], `${mapping.sheetName}.xlsx`, { type: blob.type });

        const result = await importService.importExcel(sheetFile, mapping.financialStatementId);
        
        setSheetMappings(prev => prev.map((m, idx) => 
          idx === i ? { ...m, status: 'success', result } : m
        ));
      } catch (error: any) {
        setSheetMappings(prev => prev.map((m, idx) => 
          idx === i ? { ...m, status: 'error', result: { imported: 0, errors: [error.message] } } : m
        ));
      }
    }

    setStep('complete');
  };

  const getTotalStats = () => {
    let totalImported = 0;
    let totalErrors = 0;
    let successCount = 0;
    let errorCount = 0;

    sheetMappings.forEach(m => {
      if (m.result) {
        totalImported += m.result.imported;
        totalErrors += m.result.errors.length;
      }
      if (m.status === 'success') successCount++;
      if (m.status === 'error') errorCount++;
    });

    return { totalImported, totalErrors, successCount, errorCount };
  };

  const stats = getTotalStats();
  const validMappingsCount = sheetMappings.filter(m => m.financialStatementId && m.companyId).length;

  return (
    <div className="import-wizard">
      {/* Steps */}
      <div className="wizard-steps">
        <div className={`wizard-step ${step === 'upload' ? 'active' : file ? 'completed' : ''}`}>
          <div className="step-circle">{file ? '✓' : '1'}</div>
          <span className="step-label">Datei wählen</span>
        </div>
        <div className={`wizard-step ${step === 'mapping' ? 'active' : step === 'importing' || step === 'complete' ? 'completed' : ''}`}>
          <div className="step-circle">{step === 'importing' || step === 'complete' ? '✓' : '2'}</div>
          <span className="step-label">Zuordnung</span>
        </div>
        <div className={`wizard-step ${step === 'importing' || step === 'complete' ? 'active' : ''}`}>
          <div className="step-circle">{step === 'complete' ? '✓' : '3'}</div>
          <span className="step-label">Import</span>
        </div>
      </div>

      {/* Content */}
      <div className="wizard-content">
        {/* Step 1: Upload */}
        {step === 'upload' && (
          <>
            <h2>Multi-Unternehmen Excel hochladen</h2>
            <p className="step-description">
              Laden Sie eine Excel-Datei mit mehreren Blättern hoch. 
              Jedes Blatt sollte die Bilanzdaten eines Unternehmens enthalten.
            </p>

            <div
              className={`file-dropzone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ marginBottom: 'var(--spacing-4)' }}></div>
                  <p>Verarbeite Datei...</p>
                </>
              ) : (
                <>
                  <div className="dropzone-icon">+</div>
                  <p>Excel-Datei mit mehreren Blättern hierher ziehen</p>
                  <p className="file-types">Jedes Blatt = ein Unternehmen</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>
          </>
        )}

        {/* Step 2: Mapping */}
        {step === 'mapping' && (
          <>
            <h2>Blätter den Unternehmen zuordnen</h2>
            <p className="step-description">
              {sheetMappings.length} Blätter gefunden. Ordnen Sie jedes Blatt einem Unternehmen zu.
            </p>

            <div style={{ marginTop: 'var(--spacing-6)' }}>
              {sheetMappings.map((mapping, index) => (
                <div 
                  key={mapping.sheetName} 
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 2fr 1fr auto',
                    gap: 'var(--spacing-4)',
                    alignItems: 'center',
                    padding: 'var(--spacing-4)',
                    background: 'var(--color-bg-secondary)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--spacing-3)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 'var(--font-weight-medium)' }}>{mapping.sheetName}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                      {mapping.rowCount} Zeilen
                    </div>
                  </div>
                  
                  <select
                    value={mapping.companyId}
                    onChange={(e) => updateSheetMapping(index, e.target.value)}
                  >
                    <option value="">-- Unternehmen wählen --</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  <div>
                    {mapping.financialStatementId ? (
                      <span className="badge badge-success">✓ Jahresabschluss vorhanden</span>
                    ) : mapping.companyId ? (
                      <button
                        className="button button-secondary button-sm"
                        onClick={() => createMissingStatement(index)}
                      >
                        + Erstellen
                      </button>
                    ) : (
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                        -
                      </span>
                    )}
                  </div>

                  <div style={{ 
                    width: '24px', 
                    height: '24px', 
                    borderRadius: '50%', 
                    background: mapping.financialStatementId ? 'var(--color-success)' : 'var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: 'var(--font-size-xs)',
                  }}>
                    {mapping.financialStatementId ? '✓' : ''}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 'var(--spacing-6)', padding: 'var(--spacing-4)', background: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
              <strong>{validMappingsCount}</strong> von <strong>{sheetMappings.length}</strong> Blättern bereit zum Import
            </div>
          </>
        )}

        {/* Step 3: Importing / Complete */}
        {(step === 'importing' || step === 'complete') && (
          <>
            <h2>{step === 'importing' ? 'Importiere Daten...' : 'Import abgeschlossen'}</h2>
            
            {step === 'complete' && (
              <div className="preview-summary" style={{ marginBottom: 'var(--spacing-6)' }}>
                <div className="summary-item success">
                  <span className="count">{stats.totalImported}</span>
                  <span>Datensätze importiert</span>
                </div>
                <div className="summary-item success">
                  <span className="count">{stats.successCount}</span>
                  <span>Erfolgreich</span>
                </div>
                <div className="summary-item error">
                  <span className="count">{stats.errorCount}</span>
                  <span>Fehlgeschlagen</span>
                </div>
              </div>
            )}

            <div style={{ marginTop: 'var(--spacing-4)' }}>
              {sheetMappings.map((mapping) => (
                <div 
                  key={mapping.sheetName}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-4)',
                    padding: 'var(--spacing-3)',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <div style={{ width: '24px' }}>
                    {mapping.status === 'importing' && <div className="spinner" style={{ width: '16px', height: '16px' }}></div>}
                    {mapping.status === 'success' && <span style={{ color: 'var(--color-success)' }}>✓</span>}
                    {mapping.status === 'error' && <span style={{ color: 'var(--color-error)' }}>✗</span>}
                    {mapping.status === 'pending' && <span style={{ color: 'var(--color-text-secondary)' }}>○</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <strong>{mapping.sheetName}</strong>
                    {mapping.companyName && <span style={{ color: 'var(--color-text-secondary)' }}> → {mapping.companyName}</span>}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-sm)' }}>
                    {mapping.result && (
                      mapping.status === 'success' 
                        ? <span style={{ color: 'var(--color-success)' }}>{mapping.result.imported} importiert</span>
                        : <span style={{ color: 'var(--color-error)' }}>{mapping.result.errors[0]}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="wizard-actions">
        <button className="button button-tertiary" onClick={onCancel}>
          {step === 'complete' ? 'Schließen' : 'Abbrechen'}
        </button>
        
        <div className="button-group">
          {step === 'mapping' && (
            <>
              <button className="button button-secondary" onClick={() => { setStep('upload'); setFile(null); }}>
                ← Zurück
              </button>
              <button
                className="button button-primary"
                onClick={handleStartImport}
                disabled={validMappingsCount === 0}
              >
                {validMappingsCount} Blätter importieren →
              </button>
            </>
          )}
          
          {step === 'complete' && (
            <button className="button button-primary" onClick={onComplete}>
              Fertig
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default BatchImportWizard;
