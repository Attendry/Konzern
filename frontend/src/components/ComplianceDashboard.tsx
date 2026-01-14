import React, { useState, useEffect } from 'react';
import { ComplianceChecklistItem, ComplianceSummary, ComplianceCategory, ChecklistItemStatus } from '../types';
import complianceService from '../services/complianceService';
import { useToast } from '../contexts/ToastContext';

interface ComplianceDashboardProps {
  financialStatementId: string;
  onClose?: () => void;
}

const CATEGORY_LABELS: Record<ComplianceCategory, string> = {
  capital_consolidation: 'Kapitalkonsolidierung (§ 301)',
  debt_consolidation: 'Schuldenkonsolidierung (§ 303)',
  intercompany_profit: 'Zwischenergebnisse (§ 304)',
  income_expense: 'Aufwands-/Ertragskonsolidierung (§ 305)',
  deferred_tax: 'Latente Steuern (§ 306)',
  minority_interest: 'Minderheitenanteile (§ 307)',
  uniform_valuation: 'Einheitliche Bewertung (§ 308)',
  currency_translation: 'Währungsumrechnung (§ 308a)',
  consolidation_circle: 'Konsolidierungskreis (§ 294-296)',
  equity_method: 'Equity-Methode (§ 312)',
  notes_disclosure: 'Anhangangaben (§ 313-314)',
  general_compliance: 'Allgemeine Compliance',
};

const STATUS_LABELS: Record<ChecklistItemStatus, string> = {
  not_started: 'Offen',
  in_progress: 'In Bearbeitung',
  completed: 'Abgeschlossen',
  not_applicable: 'N/A',
  requires_review: 'Prüfung erforderlich',
};

const STATUS_COLORS: Record<ChecklistItemStatus, string> = {
  not_started: 'badge-secondary',
  in_progress: 'badge-warning',
  completed: 'badge-success',
  not_applicable: 'badge-light',
  requires_review: 'badge-danger',
};

const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({
  financialStatementId,
  onClose,
}) => {
  const [checklist, setChecklist] = useState<ComplianceChecklistItem[]>([]);
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<ComplianceCategory | 'all'>('all');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    loadData();
  }, [financialStatementId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [items, sum] = await Promise.all([
        complianceService.getChecklist(financialStatementId),
        complianceService.getSummary(financialStatementId),
      ]);
      setChecklist(items);
      setSummary(sum);
    } catch (error: any) {
      // If no checklist exists, initialize one
      if (error.response?.status === 404 || checklist.length === 0) {
        try {
          const items = await complianceService.initializeChecklist(financialStatementId);
          setChecklist(items);
          const sum = await complianceService.getSummary(financialStatementId);
          setSummary(sum);
        } catch (initError) {
          console.error('Error initializing checklist:', initError);
          showToast('Fehler beim Initialisieren der Checkliste', 'error');
        }
      } else {
        console.error('Error loading compliance data:', error);
        showToast('Fehler beim Laden der Compliance-Daten', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (itemId: string, newStatus: ChecklistItemStatus) => {
    try {
      await complianceService.updateItem(itemId, { status: newStatus });
      showToast('Status aktualisiert', 'success');
      loadData();
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Fehler beim Aktualisieren', 'error');
    }
  };

  const handleAutoUpdate = async () => {
    try {
      await complianceService.autoUpdate(financialStatementId);
      showToast('Checkliste automatisch aktualisiert', 'success');
      loadData();
    } catch (error) {
      console.error('Error auto-updating:', error);
      showToast('Fehler beim Auto-Update', 'error');
    }
  };

  const filteredChecklist = selectedCategory === 'all'
    ? checklist
    : checklist.filter(item => item.category === selectedCategory);

  const getProgressColor = (percent: number) => {
    if (percent >= 80) return '#22c55e';
    if (percent >= 50) return '#f59e0b';
    return '#ef4444';
  };

  if (loading) {
    return <div className="loading">Lade Compliance-Daten...</div>;
  }

  return (
    <div className="compliance-dashboard">
      <div className="dashboard-header">
        <h2>HGB Compliance Checkliste</h2>
        {onClose && (
          <button className="btn-close" onClick={onClose}>×</button>
        )}
      </div>

      {/* Summary */}
      {summary && (
        <div className="compliance-summary">
          <div className="progress-overview">
            <div className="progress-circle" style={{ '--progress': `${summary.percentComplete}%`, '--color': getProgressColor(summary.percentComplete) } as React.CSSProperties}>
              <span className="percent">{summary.percentComplete}%</span>
            </div>
            <div className="progress-details">
              <h3>Gesamtfortschritt</h3>
              <p>{summary.completed} von {summary.totalItems} Prüfpunkten abgeschlossen</p>
              {!summary.mandatoryComplete && (
                <p className="warning">Pflichtprüfpunkte noch nicht vollständig</p>
              )}
            </div>
          </div>

          <div className="status-cards">
            <div className="status-card completed">
              <span className="count">{summary.completed}</span>
              <span className="label">Abgeschlossen</span>
            </div>
            <div className="status-card in-progress">
              <span className="count">{summary.inProgress}</span>
              <span className="label">In Bearbeitung</span>
            </div>
            <div className="status-card not-started">
              <span className="count">{summary.notStarted}</span>
              <span className="label">Offen</span>
            </div>
            <div className="status-card overdue">
              <span className="count">{summary.overdue}</span>
              <span className="label">Überfällig</span>
            </div>
          </div>
        </div>
      )}

      {/* Category Progress */}
      {summary && summary.byCategory.length > 0 && (
        <div className="category-progress">
          <h3>Fortschritt nach Kategorie</h3>
          <div className="category-bars">
            {summary.byCategory.map((cat) => (
              <div key={cat.category} className="category-bar-item">
                <div className="category-label">
                  <span>{CATEGORY_LABELS[cat.category]}</span>
                  <span>{cat.completed}/{cat.total - cat.notApplicable}</span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ 
                      width: `${cat.percentComplete}%`,
                      backgroundColor: getProgressColor(cat.percentComplete)
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="controls">
        <div className="filter-control">
          <label>Kategorie:</label>
          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as ComplianceCategory | 'all')}
          >
            <option value="all">Alle Kategorien</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <button className="btn-secondary" onClick={handleAutoUpdate}>
          🔄 Auto-Update aus Konsolidierung
        </button>
      </div>

      {/* Checklist */}
      <div className="checklist">
        <h3>Prüfpunkte</h3>
        {filteredChecklist.length === 0 ? (
          <p className="empty-state">Keine Prüfpunkte in dieser Kategorie.</p>
        ) : (
          <div className="checklist-items">
            {filteredChecklist.map((item) => (
              <div 
                key={item.id} 
                className={`checklist-item ${item.isMandatory ? 'mandatory' : ''} ${expandedItem === item.id ? 'expanded' : ''}`}
              >
                <div className="item-header" onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}>
                  <div className="item-info">
                    <span className="item-code">{item.itemCode}</span>
                    <span className="item-description">{item.description}</span>
                    {item.isMandatory && <span className="mandatory-badge">Pflicht</span>}
                  </div>
                  <div className="item-status">
                    <select
                      value={item.status}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleStatusChange(item.id, e.target.value as ChecklistItemStatus);
                      }}
                      className={STATUS_COLORS[item.status]}
                    >
                      {Object.entries(STATUS_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {expandedItem === item.id && (
                  <div className="item-details">
                    {item.hgbReference && (
                      <p><strong>HGB-Referenz:</strong> {item.hgbReference}</p>
                    )}
                    {item.requirement && (
                      <p><strong>Anforderung:</strong> {item.requirement}</p>
                    )}
                    {item.notes && (
                      <p><strong>Notizen:</strong> {item.notes}</p>
                    )}
                    {item.evidence && (
                      <p><strong>Nachweis:</strong> {item.evidence}</p>
                    )}
                    {item.completedAt && (
                      <p><strong>Abgeschlossen am:</strong> {new Date(item.completedAt).toLocaleDateString('de-DE')}</p>
                    )}
                    {item.dueDate && (
                      <p><strong>Fällig bis:</strong> {new Date(item.dueDate).toLocaleDateString('de-DE')}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Next Due Item */}
      {summary?.nextDueItem && (
        <div className="next-due-alert">
          <h4>⏰ Nächste Fälligkeit</h4>
          <p>
            <strong>{summary.nextDueItem.itemCode}</strong> - {summary.nextDueItem.description}
            <br />
            Fällig: {summary.nextDueItem.dueDate ? new Date(summary.nextDueItem.dueDate).toLocaleDateString('de-DE') : 'Kein Datum'}
          </p>
        </div>
      )}
    </div>
  );
};

export default ComplianceDashboard;
