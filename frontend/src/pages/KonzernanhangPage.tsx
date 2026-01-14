import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  konzernanhangService, 
  KonzernanhangDocument, 
  KonzernanhangSection, 
  ExportFormat,
  ExportMetadata,
} from '../services/konzernanhangService';
import { financialStatementService } from '../services/financialStatementService';
import { FinancialStatement } from '../types';
import { MetricCard } from '../components/MetricCard';
import { Modal } from '../components/Modal';
import '../App.css';

// Status labels and colors
const statusLabels: Record<string, string> = {
  draft: 'Entwurf',
  review_pending: 'Prüfung ausstehend',
  reviewed: 'Geprüft',
  finalized: 'Freigegeben',
  superseded: 'Ersetzt',
};

const statusColors: Record<string, string> = {
  draft: '#f97316',
  review_pending: '#eab308',
  reviewed: '#22c55e',
  finalized: '#3b82f6',
  superseded: '#6b7280',
};

// Disclosure type labels defined in konzernanhangService.ts

export default function KonzernanhangPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [financialStatements, setFinancialStatements] = useState<FinancialStatement[]>([]);
  const [selectedFsId, setSelectedFsId] = useState<string>(id || '');
  const [anhangDoc, setAnhangDoc] = useState<KonzernanhangDocument | null>(null);
  const [sections, setSections] = useState<KonzernanhangSection[]>([]);
  const [exportHistory, setExportHistory] = useState<ExportMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'sections' | 'exports'>('overview');
  const [selectedSection, setSelectedSection] = useState<KonzernanhangSection | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSection, setEditingSection] = useState<KonzernanhangSection | null>(null);
  const [editContent, setEditContent] = useState('');
  const [savingSection, setSavingSection] = useState(false);

  // Load financial statements
  useEffect(() => {
    const loadFs = async () => {
      try {
        const data = await financialStatementService.getAll();
        setFinancialStatements(data);
        if (!id && data.length > 0) {
          setSelectedFsId(data[0].id);
        }
      } catch (err) {
        console.error('Error loading financial statements:', err);
      }
    };
    loadFs();
  }, [id]);

  // Load document when FS changes
  useEffect(() => {
    if (!selectedFsId) {
      setLoading(false);
      return;
    }
    loadDocument();
  }, [selectedFsId]);

  const loadDocument = async () => {
    setLoading(true);
    setError(null);
    try {
      const doc = await konzernanhangService.getCurrentDocument(selectedFsId);
      setAnhangDoc(doc);
      
      if (doc) {
        const [sectionsData, exportsData] = await Promise.all([
          konzernanhangService.getSections(doc.id),
          konzernanhangService.getExportHistory(doc.id),
        ]);
        setSections(sectionsData);
        setExportHistory(exportsData);
      } else {
        setSections([]);
        setExportHistory([]);
      }
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedFsId) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await konzernanhangService.createAndGenerate(selectedFsId);
      setAnhangDoc(result.document);
      setSections(result.sections);
      setActiveTab('sections');
    } catch (err: any) {
      setError(err.message || 'Fehler beim Generieren');
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    if (!anhangDoc) return;
    setGenerating(true);
    setError(null);
    try {
      const newSections = await konzernanhangService.generateSections(anhangDoc.id);
      setSections(newSections);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Neu-Generieren');
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async (format: ExportFormat) => {
    if (!anhangDoc) return;
    setExporting(true);
    try {
      const blob = await konzernanhangService.exportDocument(anhangDoc.id, format);
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `konzernanhang_${anhangDoc.fiscalYear}_v${anhangDoc.version}.${format}`;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(a);
      
      // Refresh export history
      const history = await konzernanhangService.getExportHistory(anhangDoc.id);
      setExportHistory(history);
      setShowExportModal(false);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Export');
    } finally {
      setExporting(false);
    }
  };

  const handleReviewDocument = async () => {
    if (!anhangDoc) return;
    try {
      const updated = await konzernanhangService.reviewDocument(
        anhangDoc.id,
        'current-user-id', // In production, get from auth context
        'Aktueller Benutzer',
      );
      setAnhangDoc(updated);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Prüfen');
    }
  };

  const handleApproveDocument = async () => {
    if (!anhangDoc) return;
    try {
      const updated = await konzernanhangService.approveDocument(
        anhangDoc.id,
        'current-user-id',
        'Aktueller Benutzer',
      );
      setAnhangDoc(updated);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Freigeben');
    }
  };

  const handleReviewSection = async (sectionId: string) => {
    try {
      const updated = await konzernanhangService.reviewSection(
        sectionId,
        'current-user-id',
        'Aktueller Benutzer',
      );
      setSections(sections.map(s => s.id === sectionId ? updated : s));
    } catch (err: any) {
      setError(err.message || 'Fehler beim Prüfen');
    }
  };

  const handleEditSection = (section: KonzernanhangSection) => {
    setEditingSection(section);
    setEditContent(section.contentText || '');
    setShowEditModal(true);
  };

  const handleSaveSection = async () => {
    if (!editingSection) return;
    setSavingSection(true);
    try {
      const updated = await konzernanhangService.updateSection(editingSection.id, {
        contentText: editContent,
      });
      setSections(sections.map(s => s.id === editingSection.id ? updated : s));
      setShowEditModal(false);
      setEditingSection(null);
      setEditContent('');
    } catch (err: any) {
      setError(err.message || 'Fehler beim Speichern');
    } finally {
      setSavingSection(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-spinner" />
        <p>Lade Konzernanhang...</p>
      </div>
    );
  }

  return (
    <div className="konzernanhang-page">
      {/* Back Button */}
      <div style={{ marginBottom: '16px' }}>
        <button 
          className="btn btn-secondary" 
          onClick={() => navigate('/')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          ← Zurück zum Dashboard
        </button>
      </div>

      {/* Header */}
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Konzernanhang</h1>
          <p className="page-subtitle">
            Pflichtangaben nach HGB § 313-314
          </p>
        </div>
        <div className="page-header-actions">
          <select
            className="form-select"
            value={selectedFsId}
            onChange={(e) => setSelectedFsId(e.target.value)}
          >
            <option value="">Geschäftsjahr wählen...</option>
            {financialStatements.map(fs => (
              <option key={fs.id} value={fs.id}>
                {fs.fiscalYear} - {fs.company?.name || 'Konzern'}
              </option>
            ))}
          </select>
          
          {!anhangDoc && selectedFsId && (
            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? 'Generiere...' : 'Konzernanhang generieren'}
            </button>
          )}
          
          {anhangDoc && (
            <>
              <button
                className="btn btn-secondary"
                onClick={handleRegenerate}
                disabled={generating}
              >
                {generating ? 'Generiere...' : 'Neu generieren'}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setShowExportModal(true)}
              >
                Exportieren
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-error">
          {error}
          <button onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      {/* No document state */}
      {!anhangDoc && selectedFsId && !loading && (
        <div className="empty-state-card">
          <div className="empty-icon"></div>
          <h2>Kein Konzernanhang vorhanden</h2>
          <p>Für dieses Geschäftsjahr wurde noch kein Konzernanhang erstellt.</p>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? 'Generiere...' : 'Jetzt Konzernanhang generieren'}
          </button>
        </div>
      )}

      {/* Document exists */}
      {anhangDoc && (
        <>
          {/* Stats */}
          <div className="metrics-grid">
            <MetricCard
              title="Status"
              value={statusLabels[anhangDoc.status]}
              subtitle={`Version ${anhangDoc.version}`}
              trend="neutral"
            />
            <MetricCard
              title="Abschnitte"
              value={`${anhangDoc.completedSections}/${anhangDoc.totalSections}`}
              subtitle={`${Math.round((anhangDoc.completedSections / anhangDoc.totalSections) * 100) || 0}% abgeschlossen`}
              trend={anhangDoc.completedSections === anhangDoc.totalSections ? "up" : "neutral"}
            />
            <MetricCard
              title="Erstellt"
              value={formatDate(anhangDoc.generatedAt)}
              subtitle={anhangDoc.generatedByName || 'System'}
              trend="neutral"
            />
            <MetricCard
              title="Exporte"
              value={exportHistory.length.toString()}
              subtitle="Durchgeführte Exporte"
              trend="neutral"
            />
          </div>

          {/* Tabs */}
          <div className="tabs-container">
            <div className="tabs">
              <button
                className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                Übersicht
              </button>
              <button
                className={`tab ${activeTab === 'sections' ? 'active' : ''}`}
                onClick={() => setActiveTab('sections')}
              >
                Abschnitte ({sections.length})
              </button>
              <button
                className={`tab ${activeTab === 'exports' ? 'active' : ''}`}
                onClick={() => setActiveTab('exports')}
              >
                Exporte ({exportHistory.length})
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="overview-content">
                <div className="info-card">
                  <h3>Dokument-Details</h3>
                  <div className="info-grid">
                    <div className="info-row">
                      <span className="info-label">Titel:</span>
                      <span className="info-value">{anhangDoc.documentTitle}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Geschäftsjahr:</span>
                      <span className="info-value">{anhangDoc.fiscalYear}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Berichtszeitraum:</span>
                      <span className="info-value">
                        {formatDate(anhangDoc.periodStart)} - {formatDate(anhangDoc.periodEnd)}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Status:</span>
                      <span 
                        className="status-badge" 
                        style={{ backgroundColor: statusColors[anhangDoc.status] }}
                      >
                        {statusLabels[anhangDoc.status]}
                      </span>
                    </div>
                    {anhangDoc.reviewedAt && (
                      <div className="info-row">
                        <span className="info-label">Geprüft:</span>
                        <span className="info-value">
                          {formatDateTime(anhangDoc.reviewedAt)} von {anhangDoc.reviewedByName}
                        </span>
                      </div>
                    )}
                    {anhangDoc.approvedAt && (
                      <div className="info-row">
                        <span className="info-label">Freigegeben:</span>
                        <span className="info-value">
                          {formatDateTime(anhangDoc.approvedAt)} von {anhangDoc.approvedByName}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Workflow Actions */}
                <div className="workflow-actions">
                  <h3>Workflow</h3>
                  <div className="workflow-buttons">
                    {anhangDoc.status === 'draft' && (
                      <button className="btn btn-primary" onClick={handleReviewDocument}>
                        Zur Prüfung einreichen
                      </button>
                    )}
                    {anhangDoc.status === 'reviewed' && (
                      <button className="btn btn-success" onClick={handleApproveDocument}>
                        Freigeben
                      </button>
                    )}
                    {anhangDoc.status === 'finalized' && (
                      <span className="finalized-badge">Freigegeben</span>
                    )}
                  </div>
                </div>

                {/* Section Summary */}
                <div className="section-summary">
                  <h3>Abschnitte nach Status</h3>
                  <div className="status-summary">
                    {Object.entries(statusLabels).map(([status, label]) => {
                      const count = sections.filter(s => s.status === status).length;
                      if (count === 0) return null;
                      return (
                        <div key={status} className="status-item">
                          <span 
                            className="status-dot" 
                            style={{ backgroundColor: statusColors[status] }}
                          />
                          <span className="status-label">{label}</span>
                          <span className="status-count">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Sections Tab */}
            {activeTab === 'sections' && (
              <div className="sections-content">
                {sections.length === 0 ? (
                  <div className="empty-state">
                    <p>Keine Abschnitte vorhanden.</p>
                    <button className="btn btn-primary" onClick={handleRegenerate}>
                      Abschnitte generieren
                    </button>
                  </div>
                ) : (
                  <div className="sections-list">
                    {sections.map(section => (
                      <div 
                        key={section.id} 
                        className={`section-card ${selectedSection?.id === section.id ? 'selected' : ''}`}
                        onClick={() => setSelectedSection(selectedSection?.id === section.id ? null : section)}
                      >
                        <div className="section-header">
                          <div className="section-number">{section.sectionNumber}</div>
                          <div className="section-info">
                            <h4>{section.sectionTitle}</h4>
                            {section.hgbSection && (
                              <span className="hgb-badge">{section.hgbSection}</span>
                            )}
                          </div>
                          <div className="section-status">
                            <span 
                              className="status-badge-sm"
                              style={{ backgroundColor: statusColors[section.status] }}
                            >
                              {statusLabels[section.status]}
                            </span>
                            {section.isAutoGenerated && (
                              <span className="auto-badge">Auto</span>
                            )}
                          </div>
                        </div>
                        
                        {selectedSection?.id === section.id && (
                          <div className="section-content">
                            <div className="content-preview">
                              {section.contentText ? (
                                <pre>{section.contentText}</pre>
                              ) : (
                                <p className="no-content">Kein Inhalt vorhanden.</p>
                              )}
                            </div>
                            <div className="section-actions">
                              {section.status === 'draft' && (
                                <button 
                                  className="btn btn-sm btn-primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReviewSection(section.id);
                                  }}
                                >
                                  Als geprüft markieren
                                </button>
                              )}
                              <button 
                                className="btn btn-sm btn-secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditSection(section);
                                }}
                              >
                                Bearbeiten
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Exports Tab */}
            {activeTab === 'exports' && (
              <div className="exports-content">
                {exportHistory.length === 0 ? (
                  <div className="empty-state">
                    <p>Keine Exporte vorhanden.</p>
                    <button 
                      className="btn btn-primary" 
                      onClick={() => setShowExportModal(true)}
                    >
                      Ersten Export erstellen
                    </button>
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Dateiname</th>
                        <th>Format</th>
                        <th>Größe</th>
                        <th>Exportiert von</th>
                        <th>Datum</th>
                        <th>Zweck</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportHistory.map(exp => (
                        <tr key={exp.id}>
                          <td>{exp.fileName}</td>
                          <td><span className="format-badge">{exp.format.toUpperCase()}</span></td>
                          <td>{exp.fileSize ? `${(exp.fileSize / 1024).toFixed(1)} KB` : '-'}</td>
                          <td>{exp.exportedByName || 'System'}</td>
                          <td>{formatDateTime(exp.exportedAt)}</td>
                          <td>{exp.exportPurpose || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Export Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Konzernanhang exportieren"
      >
        <div className="export-modal-content">
          <p>Wählen Sie das gewünschte Export-Format:</p>
          <div className="export-options">
            <button
              className="export-option"
              onClick={() => handleExport(ExportFormat.HTML)}
              disabled={exporting}
            >
              <span className="export-icon">XML</span>
              <span className="export-label">HTML</span>
              <span className="export-desc">Druckfertig</span>
            </button>
            <button
              className="export-option"
              onClick={() => handleExport(ExportFormat.MARKDOWN)}
              disabled={exporting}
            >
              <span className="export-icon">PDF</span>
              <span className="export-label">Markdown</span>
              <span className="export-desc">Bearbeitbar</span>
            </button>
            <button
              className="export-option"
              onClick={() => handleExport(ExportFormat.TEXT)}
              disabled={exporting}
            >
              <span className="export-icon">DOC</span>
              <span className="export-label">Text</span>
              <span className="export-desc">Einfach</span>
            </button>
            <button
              className="export-option"
              onClick={() => handleExport(ExportFormat.JSON)}
              disabled={exporting}
            >
              <span className="export-icon">XLS</span>
              <span className="export-label">JSON</span>
              <span className="export-desc">Daten</span>
            </button>
          </div>
          {exporting && <p className="exporting-text">Exportiere...</p>}
        </div>
      </Modal>

      {/* Section Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingSection(null);
          setEditContent('');
        }}
        title={editingSection ? `Abschnitt bearbeiten: ${editingSection.sectionTitle}` : 'Abschnitt bearbeiten'}
        size="lg"
      >
        <div className="edit-modal-content">
          {editingSection && (
            <>
              <div className="edit-section-info">
                <div className="edit-info-row">
                  <span className="edit-info-label">Abschnitt:</span>
                  <span>{editingSection.sectionNumber} - {editingSection.sectionTitle}</span>
                </div>
                {editingSection.hgbSection && (
                  <div className="edit-info-row">
                    <span className="edit-info-label">HGB-Referenz:</span>
                    <span className="hgb-badge">{editingSection.hgbSection}</span>
                  </div>
                )}
              </div>
              <div className="edit-textarea-container">
                <label htmlFor="section-content">Inhalt:</label>
                <textarea
                  id="section-content"
                  className="edit-textarea"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={15}
                  placeholder="Geben Sie den Abschnittsinhalt ein..."
                />
              </div>
              <div className="edit-modal-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingSection(null);
                    setEditContent('');
                  }}
                  disabled={savingSection}
                >
                  Abbrechen
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveSection}
                  disabled={savingSection}
                >
                  {savingSection ? 'Speichere...' : 'Speichern'}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Styles */}
      <style>{`
        .konzernanhang-page {
          padding: 24px;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .page-header-actions {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .empty-state-card {
          background: var(--card-bg, #fff);
          border-radius: 16px;
          border: 1px solid var(--border-color, #e2e8f0);
          padding: 60px 40px;
          text-align: center;
          max-width: 500px;
          margin: 60px auto;
        }

        .empty-icon {
          font-size: 64px;
          margin-bottom: 20px;
        }

        .empty-state-card h2 {
          margin: 0 0 12px;
          color: var(--text-primary);
        }

        .empty-state-card p {
          color: var(--text-secondary);
          margin-bottom: 24px;
        }

        .tabs-container {
          margin-bottom: 24px;
        }

        .tabs {
          display: flex;
          gap: 4px;
          border-bottom: 1px solid var(--border-color, #e2e8f0);
        }

        .tab {
          padding: 12px 20px;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--text-secondary, #64748b);
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .tab:hover {
          color: var(--text-primary, #1e293b);
        }

        .tab.active {
          color: var(--primary, #6366f1);
          border-bottom-color: var(--primary, #6366f1);
        }

        .info-card, .overview-content > div {
          background: var(--card-bg, #fff);
          border-radius: 12px;
          border: 1px solid var(--border-color, #e2e8f0);
          padding: 20px;
          margin-bottom: 20px;
        }

        .info-card h3, .workflow-actions h3, .section-summary h3 {
          margin: 0 0 16px;
          font-size: 16px;
          color: var(--text-primary);
        }

        .info-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border-color, #e2e8f0);
        }

        .info-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .info-label {
          color: var(--text-secondary);
        }

        .info-value {
          font-weight: 500;
        }

        .status-badge {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
          color: white;
        }

        .workflow-buttons {
          display: flex;
          gap: 12px;
        }

        .finalized-badge {
          color: #22c55e;
          font-weight: 600;
          font-size: 16px;
        }

        .status-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
        }

        .status-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .status-count {
          font-weight: 600;
          color: var(--text-primary);
        }

        .sections-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .section-card {
          background: var(--card-bg, #fff);
          border-radius: 12px;
          border: 1px solid var(--border-color, #e2e8f0);
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .section-card:hover {
          border-color: var(--primary, #6366f1);
        }

        .section-card.selected {
          border-color: var(--primary, #6366f1);
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .section-number {
          width: 40px;
          height: 40px;
          background: var(--primary, #6366f1);
          color: white;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          flex-shrink: 0;
        }

        .section-info {
          flex: 1;
        }

        .section-info h4 {
          margin: 0 0 4px;
          font-size: 15px;
        }

        .hgb-badge {
          font-size: 12px;
          color: var(--text-secondary);
          background: var(--bg-secondary, #f1f5f9);
          padding: 2px 8px;
          border-radius: 4px;
        }

        .section-status {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .status-badge-sm {
          padding: 3px 8px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 500;
          color: white;
        }

        .auto-badge {
          font-size: 10px;
          background: #e0e7ff;
          color: #4338ca;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .section-content {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--border-color, #e2e8f0);
        }

        .content-preview {
          background: var(--bg-secondary, #f8fafc);
          padding: 16px;
          border-radius: 8px;
          max-height: 300px;
          overflow-y: auto;
          margin-bottom: 16px;
        }

        .content-preview pre {
          margin: 0;
          white-space: pre-wrap;
          font-family: inherit;
          font-size: 14px;
          line-height: 1.6;
        }

        .section-actions {
          display: flex;
          gap: 8px;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          background: var(--card-bg, #fff);
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--border-color, #e2e8f0);
        }

        .data-table th,
        .data-table td {
          padding: 12px 16px;
          text-align: left;
          border-bottom: 1px solid var(--border-color, #e2e8f0);
        }

        .data-table th {
          background: var(--bg-secondary, #f8fafc);
          font-weight: 600;
          font-size: 13px;
          color: var(--text-secondary);
        }

        .format-badge {
          background: var(--primary, #6366f1);
          color: white;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }

        .export-modal-content {
          padding: 20px 0;
        }

        .export-options {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-top: 20px;
        }

        .export-option {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 20px;
          background: var(--bg-secondary, #f8fafc);
          border: 2px solid var(--border-color, #e2e8f0);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .export-option:hover:not(:disabled) {
          border-color: var(--primary, #6366f1);
          background: #eef2ff;
        }

        .export-option:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .export-icon {
          font-size: 32px;
        }

        .export-label {
          font-weight: 600;
          font-size: 16px;
        }

        .export-desc {
          font-size: 12px;
          color: var(--text-secondary);
        }

        .exporting-text {
          text-align: center;
          color: var(--text-secondary);
          margin-top: 16px;
        }

        .edit-modal-content {
          padding: 8px 0;
        }

        .edit-section-info {
          background: var(--bg-secondary, #f8fafc);
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .edit-info-row {
          display: flex;
          gap: 12px;
          margin-bottom: 8px;
        }

        .edit-info-row:last-child {
          margin-bottom: 0;
        }

        .edit-info-label {
          font-weight: 500;
          color: var(--text-secondary);
          min-width: 100px;
        }

        .edit-textarea-container {
          margin-bottom: 20px;
        }

        .edit-textarea-container label {
          display: block;
          font-weight: 500;
          margin-bottom: 8px;
          color: var(--text-primary);
        }

        .edit-textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 8px;
          font-family: inherit;
          font-size: 14px;
          line-height: 1.6;
          resize: vertical;
          min-height: 200px;
        }

        .edit-textarea:focus {
          outline: none;
          border-color: var(--primary, #6366f1);
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
        }

        .edit-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 16px;
          border-top: 1px solid var(--border-color, #e2e8f0);
        }

        .empty-state {
          padding: 48px;
          text-align: center;
          color: var(--text-secondary);
        }

        .page-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
        }

        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--border-color, #e2e8f0);
          border-top-color: var(--primary, #6366f1);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .alert {
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .alert-error {
          background: #fee2e2;
          color: #991b1b;
        }

        .form-select {
          padding: 10px 16px;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 8px;
          background: var(--card-bg, #fff);
          font-size: 14px;
          min-width: 200px;
        }

        .btn {
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .btn-primary {
          background: var(--primary, #6366f1);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: var(--primary-dark, #4f46e5);
        }

        .btn-secondary {
          background: var(--bg-secondary, #f1f5f9);
          color: var(--text-primary, #1e293b);
        }

        .btn-secondary:hover:not(:disabled) {
          background: #e2e8f0;
        }

        .btn-success {
          background: #22c55e;
          color: white;
        }

        .btn-success:hover:not(:disabled) {
          background: #16a34a;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 13px;
        }

        .btn-lg {
          padding: 14px 28px;
          font-size: 16px;
        }
      `}</style>
    </div>
  );
}
