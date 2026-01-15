import { useState, useRef, useCallback } from 'react';
import { useToastContext } from '../contexts/ToastContext';
import * as XLSX from 'xlsx';
import api from '../services/api';
import '../App.css';

interface ImportResult {
  imported: number;
  errors: string[];
  warnings?: string[];
}

interface ColumnMapping {
  excelColumn: string;
  systemField: string;
}

interface ParsedRow {
  [key: string]: string | number | null;
}

interface PreviewData {
  headers: string[];
  rows: ParsedRow[];
  totalRows: number;
}

interface ValidationResult {
  valid: number;
  warnings: number;
  errors: number;
  messages: { row: number; type: 'warning' | 'error'; message: string }[];
}

interface ExcelMappingWizardProps {
  financialStatementId: string;
  companyName: string;
  fiscalYear: number;
  onImportComplete: (result: { imported: number; errors: string[]; warnings: string[] }) => void;
  onCancel: () => void;
}

const SYSTEM_FIELDS = [
  { id: 'accountNumber', label: 'Kontonummer', required: true },
  { id: 'accountName', label: 'Kontobezeichnung', required: false },
  { id: 'debit', label: 'Soll', required: false },
  { id: 'credit', label: 'Haben', required: false },
  { id: 'balance', label: 'Saldo', required: false },
  { id: 'accountType', label: 'Kontotyp', required: false },
  { id: 'isIntercompany', label: 'IC-Konto', required: false },
  { id: 'partnerCompanyId', label: 'Partner-Unternehmen', required: false },
  { id: 'notes', label: 'Bemerkungen', required: false },
];

type WizardStep = 'upload' | 'sheet-select' | 'mapping' | 'preview' | 'importing';

export function ExcelMappingWizard({
  financialStatementId,
  companyName,
  fiscalYear,
  onImportComplete,
  onCancel,
}: ExcelMappingWizardProps) {
  const { success, error: showError } = useToastContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<WizardStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Auto-mapping suggestions based on common column names
  const suggestMapping = (header: string): string => {
    const lowerHeader = header.toLowerCase().trim();
    
    if (/konto.*nr|kontonummer|account.*number|kto.*nr/i.test(lowerHeader)) return 'accountNumber';
    if (/konto.*bez|kontoname|account.*name|bezeichnung/i.test(lowerHeader)) return 'accountName';
    if (/soll|debit/i.test(lowerHeader)) return 'debit';
    if (/haben|credit/i.test(lowerHeader)) return 'credit';
    if (/saldo|balance|betrag/i.test(lowerHeader)) return 'balance';
    if (/kontotyp|account.*type|typ/i.test(lowerHeader)) return 'accountType';
    if (/ic|intercompany|konzern/i.test(lowerHeader)) return 'isIntercompany';
    if (/partner|gegen.*unternehmen/i.test(lowerHeader)) return 'partnerCompanyId';
    if (/bemerkung|note|kommentar/i.test(lowerHeader)) return 'notes';
    
    return '';
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = async (selectedFile: File) => {
    if (!selectedFile) {
      showError('Keine Datei ausgewählt');
      return;
    }

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    
    if (!validTypes.includes(selectedFile.type) && 
        !selectedFile.name.endsWith('.xlsx') && 
        !selectedFile.name.endsWith('.xls')) {
      showError('Bitte wählen Sie eine Excel-Datei (.xlsx oder .xls)');
      return;
    }

    setFile(selectedFile);
    
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Datei ist leer');
      }

      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
        throw new Error('Excel-Datei enthält keine Arbeitsblätter');
      }

      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      
      if (wb.SheetNames.length === 1) {
        // Auto-select if only one sheet
        setSelectedSheet(wb.SheetNames[0]);
        processSheet(wb, wb.SheetNames[0]);
        setStep('mapping');
      } else {
        setStep('sheet-select');
      }
    } catch (err: any) {
      console.error('Error reading Excel file:', err);
      const errorMessage = err?.message || 'Fehler beim Lesen der Excel-Datei';
      showError(errorMessage);
      setFile(null);
      setWorkbook(null);
      setSheetNames([]);
    }
  };

  const processSheet = (wb: XLSX.WorkBook, sheetName: string) => {
    try {
      if (!wb || !wb.Sheets) {
        throw new Error('Workbook ist ungültig');
      }

      const sheet = wb.Sheets[sheetName];
      if (!sheet) {
        throw new Error(`Arbeitsblatt "${sheetName}" nicht gefunden`);
      }

      // When using header: 1, data comes back as array of arrays
      const rawData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
      
      if (!rawData || rawData.length < 2) {
        showError('Die Tabelle enthält keine Daten');
        return;
      }

      // First row as headers
      const headerRow = rawData[0] as any[];
      if (!headerRow || headerRow.length === 0) {
        showError('Die Tabelle enthält keine Spaltenüberschriften');
        return;
      }

      const headers = headerRow.map((h: any, i: number) => String(h || `Spalte ${i + 1}`));
      
      // Create initial mappings with suggestions
      const initialMappings: ColumnMapping[] = headers.map(header => ({
        excelColumn: header,
        systemField: suggestMapping(header),
      }));
      
      setMappings(initialMappings);
      
      // Parse data rows
      const dataRows = rawData.slice(1) as any[][];
      const rows: ParsedRow[] = dataRows.map((row: any[]) => {
        const rowObj: ParsedRow = {};
        headers.forEach((header, i) => {
          rowObj[header] = row[i] ?? null;
        });
        return rowObj;
      }).filter((row: ParsedRow) => Object.values(row).some(v => v !== null && v !== ''));

      setPreviewData({
        headers,
        rows: rows.slice(0, 100), // Preview first 100 rows
        totalRows: rows.length,
      });
    } catch (err: any) {
      console.error('Error processing sheet:', err);
      showError(err?.message || 'Fehler beim Verarbeiten des Arbeitsblatts');
    }
  };

  const handleSheetSelect = (sheetName: string) => {
    setSelectedSheet(sheetName);
    if (workbook) {
      processSheet(workbook, sheetName);
      setStep('mapping');
    }
  };

  const updateMapping = (excelColumn: string, systemField: string) => {
    setMappings(prev => 
      prev.map(m => 
        m.excelColumn === excelColumn ? { ...m, systemField } : m
      )
    );
  };

  const validateData = (): ValidationResult => {
    if (!previewData) return { valid: 0, warnings: 0, errors: 0, messages: [] };

    const accountNumberMapping = mappings.find(m => m.systemField === 'accountNumber');
    const messages: ValidationResult['messages'] = [];
    let valid = 0;
    let warnings = 0;
    let errors = 0;

    if (!accountNumberMapping) {
      return {
        valid: 0,
        warnings: 0,
        errors: previewData.rows.length,
        messages: [{ row: 0, type: 'error', message: 'Kontonummer-Spalte muss zugeordnet werden' }],
      };
    }

    previewData.rows.forEach((row, idx) => {
      const accountNumber = row[accountNumberMapping.excelColumn];
      
      if (!accountNumber) {
        errors++;
        messages.push({ row: idx + 2, type: 'error', message: 'Kontonummer fehlt' });
        return;
      }

      // Check for balance/debit/credit
      const hasDebit = mappings.some(m => m.systemField === 'debit' && row[m.excelColumn]);
      const hasCredit = mappings.some(m => m.systemField === 'credit' && row[m.excelColumn]);
      const hasBalance = mappings.some(m => m.systemField === 'balance' && row[m.excelColumn]);

      if (!hasDebit && !hasCredit && !hasBalance) {
        warnings++;
        messages.push({ row: idx + 2, type: 'warning', message: 'Keine Werte für Soll/Haben/Saldo' });
      } else {
        valid++;
      }
    });

    return { valid, warnings, errors, messages };
  };

  const handlePreview = () => {
    const result = validateData();
    setValidation(result);
    setStep('preview');
  };

  const handleImport = async () => {
    if (!file || !previewData) {
      showError('Datei oder Vorschaudaten fehlen');
      return;
    }

    if (!financialStatementId) {
      showError('Jahresabschluss-ID fehlt');
      return;
    }

    setImporting(true);
    setStep('importing');

    try {
      // Create the mapping configuration
      const mappingConfig: Record<string, string> = {};
      mappings.forEach(m => {
        if (m.systemField) {
          mappingConfig[m.excelColumn] = m.systemField;
        }
      });

      // Validate that required fields are mapped
      if (!mappingConfig || Object.keys(mappingConfig).length === 0) {
        throw new Error('Keine Spaltenzuordnung definiert');
      }

      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('financialStatementId', financialStatementId);
      formData.append('fileType', 'excel');
      if (selectedSheet) {
        formData.append('sheetName', selectedSheet);
      }
      formData.append('columnMapping', JSON.stringify(mappingConfig));

      // Call the import API using the api service
      let result: any;
      try {
        const response = await api.post<ImportResult>('/import/excel-mapped', formData);
        result = response.data;
      } catch (apiError: any) {
        const errorMessage = apiError.response?.data?.message || 
                           apiError.response?.data?.error || 
                           apiError.message || 
                           'Import fehlgeschlagen';
        throw new Error(errorMessage);
      }

      if (!result || typeof result.imported !== 'number') {
        throw new Error('Ungültiges Import-Ergebnis vom Server');
      }

      success(`Import erfolgreich: ${result.imported} Datensätze importiert`);
      onImportComplete({
        imported: result.imported || 0,
        errors: result.errors || [],
        warnings: result.warnings || [],
      });
    } catch (err: any) {
      console.error('Import error:', err);
      const errorMessage = err?.message || 'Unbekannter Fehler beim Import';
      showError(`Import fehlgeschlagen: ${errorMessage}`);
      // Reset to preview step so user can try again
      setStep('preview');
    } finally {
      setImporting(false);
    }
  };

  const getMappedValue = (row: ParsedRow, systemField: string): string => {
    const mapping = mappings.find(m => m.systemField === systemField);
    if (!mapping) return '-';
    const value = row[mapping.excelColumn];
    return value !== null && value !== undefined ? String(value) : '-';
  };

  const requiredFieldsMapped = SYSTEM_FIELDS
    .filter(f => f.required)
    .every(f => mappings.some(m => m.systemField === f.id));

  // Safety check - ensure component doesn't crash
  if (!financialStatementId) {
    return (
      <div className="import-wizard">
        <div className="error-message">
          <strong>Fehler:</strong> Jahresabschluss-ID fehlt
        </div>
        <button className="button button-tertiary" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    );
  }

  return (
    <div className="import-wizard">
      {/* Steps Indicator */}
      <div className="wizard-steps">
        <div className={`wizard-step ${step === 'upload' ? 'active' : file ? 'completed' : ''}`}>
          <div className="step-circle">{file ? '[OK]' : '1'}</div>
          <span className="step-label">Datei wählen</span>
        </div>
        <div className={`wizard-step ${step === 'sheet-select' ? 'active' : selectedSheet ? 'completed' : ''}`}>
          <div className="step-circle">{selectedSheet ? '[OK]' : '2'}</div>
          <span className="step-label">Blatt wählen</span>
        </div>
        <div className={`wizard-step ${step === 'mapping' ? 'active' : validation ? 'completed' : ''}`}>
          <div className="step-circle">{validation ? '[OK]' : '3'}</div>
          <span className="step-label">Spalten zuordnen</span>
        </div>
        <div className={`wizard-step ${step === 'preview' || step === 'importing' ? 'active' : ''}`}>
          <div className="step-circle">4</div>
          <span className="step-label">Vorschau & Import</span>
        </div>
      </div>

      {/* Content */}
      <div className="wizard-content">
        {/* Step 1: Upload */}
        {step === 'upload' && (
          <>
            <h2>Excel-Datei hochladen</h2>
            <p className="step-description">
              Laden Sie Ihre Excel-Bilanz für <strong>{companyName}</strong> ({fiscalYear}) hoch.
            </p>
            
            <div
              className={`file-dropzone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="dropzone-icon">+</div>
              <p>Datei hierher ziehen oder klicken zum Auswählen</p>
              <p className="file-types">Unterstützte Formate: .xlsx, .xls</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>

            {file && (
              <div style={{ marginTop: 'var(--spacing-4)', padding: 'var(--spacing-4)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                <strong>Ausgewählte Datei:</strong> {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </div>
            )}
          </>
        )}

        {/* Step 2: Sheet Selection */}
        {step === 'sheet-select' && (
          <>
            <h2>Tabellenblatt wählen</h2>
            <p className="step-description">
              Die Excel-Datei enthält mehrere Blätter. Bitte wählen Sie das Blatt mit den Bilanzdaten.
            </p>
            
            <div style={{ display: 'grid', gap: 'var(--spacing-3)', marginTop: 'var(--spacing-6)' }}>
              {sheetNames.map((name, idx) => (
                <button
                  key={name}
                  className={`button ${selectedSheet === name ? 'button-primary' : 'button-secondary'}`}
                  onClick={() => handleSheetSelect(name)}
                  style={{ justifyContent: 'flex-start', padding: 'var(--spacing-4)' }}
                >
                  <span style={{ marginRight: 'var(--spacing-3)' }}></span>
                  {name}
                  <span style={{ marginLeft: 'auto', opacity: 0.6 }}>Blatt {idx + 1}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 3: Column Mapping */}
        {step === 'mapping' && previewData && (
          <>
            <h2>Spalten zuordnen</h2>
            <p className="step-description">
              Ordnen Sie die Excel-Spalten den entsprechenden Systemfeldern zu. 
              Pflichtfelder sind mit * markiert.
            </p>
            
            <div className="column-mapping">
              <div className="mapping-grid">
                {mappings.map((mapping) => (
                  <div key={mapping.excelColumn} className="mapping-row">
                    <div className="excel-column">
                      <span></span>
                      {mapping.excelColumn}
                    </div>
                    <div className="arrow">→</div>
                    <select
                      value={mapping.systemField}
                      onChange={(e) => updateMapping(mapping.excelColumn, e.target.value)}
                    >
                      <option value="">-- Nicht importieren --</option>
                      {SYSTEM_FIELDS.map((field) => (
                        <option 
                          key={field.id} 
                          value={field.id}
                          disabled={mappings.some(m => m.systemField === field.id && m.excelColumn !== mapping.excelColumn)}
                        >
                          {field.label} {field.required ? '*' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview Sample */}
            <div className="preview-container" style={{ marginTop: 'var(--spacing-6)' }}>
              <h3>Vorschau der ersten 5 Zeilen</h3>
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {SYSTEM_FIELDS.filter(f => mappings.some(m => m.systemField === f.id)).map(field => (
                      <th key={field.id}>{field.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.rows.slice(0, 5).map((row, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      {SYSTEM_FIELDS.filter(f => mappings.some(m => m.systemField === f.id)).map(field => (
                        <td key={field.id}>{getMappedValue(row, field.id)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Step 4: Preview & Import */}
        {(step === 'preview' || step === 'importing') && validation && previewData && (
          <>
            <h2>Datenvorschau</h2>
            <p className="step-description">
              {previewData.totalRows} Zeilen erkannt. Überprüfen Sie die Zuordnung und starten Sie den Import.
            </p>
            
            {/* Validation Summary */}
            <div className="preview-summary">
              <div className="summary-item success">
                <span className="count">{validation.valid}</span>
                <span>Gültig</span>
              </div>
              <div className="summary-item warning">
                <span className="count">{validation.warnings}</span>
                <span>Warnungen</span>
              </div>
              <div className="summary-item error">
                <span className="count">{validation.errors}</span>
                <span>Fehler</span>
              </div>
            </div>

            {/* Validation Messages */}
            {validation.messages.length > 0 && (
              <div style={{ marginTop: 'var(--spacing-4)', maxHeight: '200px', overflow: 'auto' }}>
                {validation.messages.slice(0, 20).map((msg, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      padding: 'var(--spacing-2)',
                      background: msg.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(247, 201, 72, 0.1)',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: 'var(--spacing-1)',
                      fontSize: 'var(--font-size-sm)',
                    }}
                  >
                    {msg.type === 'error' ? '[Fehler]' : '[Warnung]'} Zeile {msg.row}: {msg.message}
                  </div>
                ))}
                {validation.messages.length > 20 && (
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                    ... und {validation.messages.length - 20} weitere Meldungen
                  </p>
                )}
              </div>
            )}

            {/* Data Preview Table */}
            <div className="preview-container" style={{ marginTop: 'var(--spacing-6)' }}>
              <h3>Datenvorschau (erste 10 Zeilen)</h3>
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {SYSTEM_FIELDS.filter(f => mappings.some(m => m.systemField === f.id)).map(field => (
                      <th key={field.id}>{field.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.rows.slice(0, 10).map((row, idx) => {
                    const hasError = validation.messages.some(m => m.row === idx + 2 && m.type === 'error');
                    const hasWarning = validation.messages.some(m => m.row === idx + 2 && m.type === 'warning');
                    return (
                      <tr key={idx} className={hasError ? 'row-error' : hasWarning ? 'row-warning' : ''}>
                        <td>{idx + 1}</td>
                        {SYSTEM_FIELDS.filter(f => mappings.some(m => m.systemField === f.id)).map(field => (
                          <td key={field.id}>{getMappedValue(row, field.id)}</td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {importing && (
              <div style={{ marginTop: 'var(--spacing-6)', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto var(--spacing-4)' }}></div>
                <p>Importiere Daten...</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="wizard-actions">
        <button className="button button-tertiary" onClick={onCancel}>
          Abbrechen
        </button>
        
        <div className="button-group">
          {step !== 'upload' && step !== 'importing' && (
            <button
              className="button button-secondary"
              onClick={() => {
                if (step === 'sheet-select') setStep('upload');
                else if (step === 'mapping') setStep(sheetNames.length > 1 ? 'sheet-select' : 'upload');
                else if (step === 'preview') setStep('mapping');
              }}
            >
              ← Zurück
            </button>
          )}
          
          {step === 'mapping' && (
            <button
              className="button button-primary"
              onClick={handlePreview}
              disabled={!requiredFieldsMapped}
            >
              Weiter zur Vorschau →
            </button>
          )}
          
          {step === 'preview' && (
            <button
              className="button button-primary"
              onClick={handleImport}
              disabled={importing || validation?.valid === 0}
            >
              {importing ? 'Importiere...' : `${validation?.valid || 0} Zeilen importieren`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ExcelMappingWizard;
