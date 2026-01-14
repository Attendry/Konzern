import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { managementReportService, ManagementReport } from '../services/managementReportService';
import { financialStatementService } from '../services/financialStatementService';
import { FinancialStatement } from '../types';
import { useToastContext } from '../contexts/ToastContext';
import '../App.css';

function ManagementReportPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { success, error: showError } = useToastContext();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<ManagementReport | null>(null);
  const [statements, setStatements] = useState<FinancialStatement[]>([]);
  const [selectedStatementId, setSelectedStatementId] = useState('');
  const [activeSection, setActiveSection] = useState<string>('business_overview');
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const statementsData = await financialStatementService.getAll();
      setStatements(statementsData);

      if (id) {
        const reportData = await managementReportService.getById(id);
        setReport(reportData);
        setSelectedStatementId(reportData.financialStatementId);
        
        // Initialize edited content
        const content: Record<string, string> = {};
        Object.entries(reportData.sections).forEach(([key, section]) => {
          content[key] = section.content;
        });
        setEditedContent(content);
      }
    } catch (err: any) {
      showError(`Fehler beim Laden: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReport = async () => {
    if (!selectedStatementId) {
      showError('Bitte wählen Sie einen Jahresabschluss');
      return;
    }

    const statement = statements.find(s => s.id === selectedStatementId);
    if (!statement) return;

    try {
      const newReport = await managementReportService.create({
        financialStatementId: selectedStatementId,
        fiscalYear: statement.fiscalYear,
      });
      navigate(`/konzernlagebericht/${newReport.id}`);
      success('Konzernlagebericht erstellt');
    } catch (err: any) {
      showError(`Fehler beim Erstellen: ${err.message}`);
    }
  };

  const handleSaveSection = async (sectionKey: string) => {
    if (!report) return;
    setSaving(true);

    try {
      const updatedReport = await managementReportService.updateSection(
        report.id,
        sectionKey,
        editedContent[sectionKey] || '',
      );
      setReport(updatedReport);
      success('Abschnitt gespeichert');
    } catch (err: any) {
      showError(`Fehler beim Speichern: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateSuggestions = async () => {
    if (!report) return;

    try {
      const suggestions = await managementReportService.generateSuggestions(report.id);
      
      // Update edited content with suggestions
      const newContent = { ...editedContent };
      Object.entries(suggestions).forEach(([key, suggestion]) => {
        if (!newContent[key]) {
          newContent[key] = suggestion;
        }
      });
      setEditedContent(newContent);
      
      success('Textvorschläge generiert');
    } catch (err: any) {
      showError(`Fehler bei Generierung: ${err.message}`);
    }
  };

  const handleRegenerateKeyFigures = async () => {
    if (!report) return;

    try {
      await managementReportService.generateKeyFigures(report.id, report.financialStatementId);
      const updatedReport = await managementReportService.getById(report.id);
      setReport(updatedReport);
      success('Kennzahlen aktualisiert');
    } catch (err: any) {
      showError(`Fehler bei Aktualisierung: ${err.message}`);
    }
  };

  const handleSubmitForReview = async () => {
    if (!report) return;
    try {
      const updated = await managementReportService.submitForReview(report.id);
      setReport(updated);
      success('Zur Prüfung eingereicht');
    } catch (err: any) {
      showError(`Fehler: ${err.message}`);
    }
  };

  const handleApprove = async () => {
    if (!report) return;
    try {
      const updated = await managementReportService.approve(report.id);
      setReport(updated);
      success('Konzernlagebericht freigegeben');
    } catch (err: any) {
      showError(`Fehler: ${err.message}`);
    }
  };

  const handlePublish = async () => {
    if (!report) return;
    try {
      const updated = await managementReportService.publish(report.id);
      setReport(updated);
      success('Konzernlagebericht veröffentlicht');
    } catch (err: any) {
      showError(`Fehler: ${err.message}`);
    }
  };

  const getStatusBadge = (status: ManagementReport['status']) => {
    const labels: Record<typeof status, string> = {
      draft: 'Entwurf',
      in_review: 'In Prüfung',
      approved: 'Freigegeben',
      published: 'Veröffentlicht',
      archived: 'Archiviert',
    };
    const colors: Record<typeof status, string> = {
      draft: 'badge-neutral',
      in_review: 'badge-warning',
      approved: 'badge-success',
      published: 'badge-info',
      archived: 'badge-neutral',
    };
    return <span className={`badge ${colors[status]}`}>{labels[status]}</span>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <span>Lade Konzernlagebericht...</span>
      </div>
    );
  }

  // No report yet - show creation form
  if (!report) {
    return (
      <div>
        <h1>Konzernlagebericht (§ 315 HGB)</h1>
        <div className="card">
          <div className="card-header">
            <h2>Neuen Konzernlagebericht erstellen</h2>
          </div>
          <p style={{ marginBottom: 'var(--spacing-4)', color: 'var(--color-text-secondary)' }}>
            Wählen Sie einen Jahresabschluss, um einen neuen Konzernlagebericht zu erstellen.
          </p>
          <div className="form-group">
            <label>Jahresabschluss *</label>
            <select
              value={selectedStatementId}
              onChange={(e) => setSelectedStatementId(e.target.value)}
            >
              <option value="">-- Auswählen --</option>
              {statements.map(statement => (
                <option key={statement.id} value={statement.id}>
                  {statement.company?.name || 'Unbekannt'} - {statement.fiscalYear}
                </option>
              ))}
            </select>
          </div>
          <button
            className="button button-primary"
            onClick={handleCreateReport}
            disabled={!selectedStatementId}
          >
            Konzernlagebericht erstellen
          </button>
        </div>
      </div>
    );
  }

  const sections = Object.entries(report.sections)
    .map(([key, section]) => ({ key, ...section }))
    .sort((a, b) => a.order - b.order);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-6)', flexWrap: 'wrap', gap: 'var(--spacing-4)' }}>
        <div>
          <h1>{report.reportTitle}</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Geschäftsjahr {report.fiscalYear} • {getStatusBadge(report.status)} • {report.hgbReference}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-3)' }}>
          <button className="button button-secondary" onClick={handleGenerateSuggestions}>
            Textvorschläge generieren
          </button>
          {report.status === 'draft' && (
            <button className="button button-primary" onClick={handleSubmitForReview}>
              Zur Prüfung einreichen
            </button>
          )}
          {report.status === 'in_review' && (
            <button className="button button-primary" onClick={handleApprove}>
              Freigeben
            </button>
          )}
          {report.status === 'approved' && (
            <button className="button button-primary" onClick={handlePublish}>
              Veröffentlichen
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: 'var(--spacing-6)' }}>
        {/* Section Navigation */}
        <div className="card" style={{ position: 'sticky', top: 'var(--spacing-4)', height: 'fit-content' }}>
          <div className="card-header">
            <h3>Gliederung</h3>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
            {sections.map(section => (
              <button
                key={section.key}
                className={`nav-item ${activeSection === section.key ? 'active' : ''}`}
                onClick={() => setActiveSection(section.key)}
                style={{ textAlign: 'left', padding: 'var(--spacing-3)' }}
              >
                {section.order}. {section.title}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div>
          {/* Key Figures Card */}
          <div className="card" style={{ marginBottom: 'var(--spacing-6)' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Kennzahlen</h3>
              <button className="button button-secondary button-sm" onClick={handleRegenerateKeyFigures}>
                Aktualisieren
              </button>
            </div>
            {report.keyFigures && Object.keys(report.keyFigures).length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)' }}>
                {report.keyFigures.balanceSheet && (
                  <div className="metric-card">
                    <div className="metric-label">Bilanzsumme</div>
                    <div className="metric-value">{formatCurrency(report.keyFigures.balanceSheet.totalAssets)}</div>
                  </div>
                )}
                {report.keyFigures.incomeStatement && (
                  <>
                    <div className="metric-card">
                      <div className="metric-label">Umsatzerlöse</div>
                      <div className="metric-value">{formatCurrency(report.keyFigures.incomeStatement.totalRevenue)}</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Jahresergebnis</div>
                      <div className="metric-value" style={{ color: report.keyFigures.incomeStatement.netIncome >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                        {formatCurrency(report.keyFigures.incomeStatement.netIncome)}
                      </div>
                    </div>
                  </>
                )}
                {report.keyFigures.ratios && (
                  <>
                    <div className="metric-card">
                      <div className="metric-label">Eigenkapitalquote</div>
                      <div className="metric-value">{report.keyFigures.ratios.equityRatio}%</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Umsatzrendite</div>
                      <div className="metric-value">{report.keyFigures.ratios.profitMargin}%</div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p style={{ color: 'var(--color-text-secondary)' }}>Keine Kennzahlen verfügbar. Klicken Sie auf "Aktualisieren".</p>
            )}
          </div>

          {/* Active Section Editor */}
          {sections.map(section => (
            <div
              key={section.key}
              className="card"
              style={{ display: activeSection === section.key ? 'block' : 'none' }}
            >
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>{section.order}. {section.title}</h3>
                <button
                  className="button button-primary"
                  onClick={() => handleSaveSection(section.key)}
                  disabled={saving || report.status === 'published'}
                >
                  {saving ? 'Speichere...' : 'Speichern'}
                </button>
              </div>
              
              {report.generatedContent[section.key] && !editedContent[section.key] && (
                <div className="alert alert-info" style={{ marginBottom: 'var(--spacing-4)' }}>
                  <strong>Vorschlag:</strong> {report.generatedContent[section.key]}
                  <button
                    className="button button-secondary button-sm"
                    style={{ marginLeft: 'var(--spacing-3)' }}
                    onClick={() => setEditedContent(prev => ({
                      ...prev,
                      [section.key]: report.generatedContent[section.key],
                    }))}
                  >
                    Übernehmen
                  </button>
                </div>
              )}

              <div className="form-group">
                <textarea
                  value={editedContent[section.key] || ''}
                  onChange={(e) => setEditedContent(prev => ({
                    ...prev,
                    [section.key]: e.target.value,
                  }))}
                  placeholder={`Inhalt für "${section.title}" eingeben...`}
                  rows={15}
                  disabled={report.status === 'published'}
                  style={{ fontFamily: 'inherit', lineHeight: '1.6' }}
                />
              </div>

              {section.lastUpdatedAt && (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  Zuletzt aktualisiert: {new Date(section.lastUpdatedAt).toLocaleString('de-DE')}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ManagementReportPage;
