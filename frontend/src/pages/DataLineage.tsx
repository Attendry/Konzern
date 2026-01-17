import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { lineageService, LineageGraph, LineageGraphNode, DataLineageNode, PruefpfadDocumentation, DocumentationStats } from '../services/lineageService';
import { financialStatementService } from '../services/financialStatementService';
import { FinancialStatement } from '../types';
import { MetricCard } from '../components/MetricCard';
import { Modal } from '../components/Modal';
import { ErrorState } from '../components/ErrorState';
import { Breadcrumbs } from '../components/Breadcrumbs';
import '../App.css';

// Node type labels in German
const nodeTypeLabels: Record<string, string> = {
  source_data: 'Quelldaten',
  account_balance: 'Kontensaldo',
  aggregation: 'Aggregation',
  intercompany_elimination: 'IC-Eliminierung',
  capital_consolidation: 'Kapitalkonsolidierung',
  debt_consolidation: 'Schuldenkonsolidierung',
  currency_translation: 'Währungsumrechnung',
  minority_interest: 'Minderheitenanteile',
  deferred_tax: 'Latente Steuern',
  consolidated_value: 'Konzernwert',
  reclassification: 'Umgliederung',
  valuation_adjustment: 'Bewertungsanpassung',
  proportional_share: 'Quotenkonsolidierung',
  equity_method: 'Equity-Methode',
};

// Status colors
const statusColors: Record<string, string> = {
  documented: '#22c55e',
  partially_documented: '#eab308',
  undocumented: '#ef4444',
  verified: '#3b82f6',
  requires_review: '#f97316',
};

// Status labels
const statusLabels: Record<string, string> = {
  documented: 'Dokumentiert',
  partially_documented: 'Teilweise dokumentiert',
  undocumented: 'Nicht dokumentiert',
  verified: 'Verifiziert',
  requires_review: 'Prüfung erforderlich',
};

// Node type colors for visualization
const nodeTypeColors: Record<string, string> = {
  source_data: '#6366f1',
  account_balance: '#8b5cf6',
  aggregation: '#a855f7',
  intercompany_elimination: '#ec4899',
  capital_consolidation: '#f43f5e',
  debt_consolidation: '#f97316',
  currency_translation: '#eab308',
  minority_interest: '#84cc16',
  deferred_tax: '#22c55e',
  consolidated_value: '#14b8a6',
  reclassification: '#06b6d4',
  valuation_adjustment: '#0ea5e9',
  proportional_share: '#3b82f6',
  equity_method: '#6366f1',
};

export default function DataLineage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [financialStatement, setFinancialStatement] = useState<FinancialStatement | null>(null);
  const [financialStatements, setFinancialStatements] = useState<FinancialStatement[]>([]);
  const [selectedFsId, setSelectedFsId] = useState<string>(id || '');
  const [graph, setGraph] = useState<LineageGraph | null>(null);
  const [stats, setStats] = useState<DocumentationStats | null>(null);
  const [documentation, setDocumentation] = useState<PruefpfadDocumentation[]>([]);
  const [selectedNode, setSelectedNode] = useState<LineageGraphNode | null>(null);
  const [_nodeDetails, setNodeDetails] = useState<DataLineageNode | null>(null);
  const [nodeDocumentation, setNodeDocumentation] = useState<PruefpfadDocumentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'graph' | 'documentation' | 'export'>('graph');
  const [showDocModal, setShowDocModal] = useState(false);
  const [auditTrailExport, setAuditTrailExport] = useState<any>(null);
  const [exporting, setExporting] = useState(false);

  // Load financial statements list
  useEffect(() => {
    const loadFinancialStatements = async () => {
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
    loadFinancialStatements();
  }, [id]);

  // Load lineage data function
  const loadLineageData = async (fsId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [fsData, graphData, statsData, docsData] = await Promise.all([
        financialStatementService.getById(fsId),
        lineageService.getLineageGraph(fsId),
        lineageService.getDocumentationStats(fsId),
        lineageService.getDocumentation({ financialStatementId: fsId }),
      ]);
      setFinancialStatement(fsData);
      setGraph(graphData);
      setStats(statsData);
      setDocumentation(docsData);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  // Load lineage data when financial statement changes
  useEffect(() => {
    if (!selectedFsId) return;
    loadLineageData(selectedFsId);
  }, [selectedFsId]);

  // Load node details when selected
  useEffect(() => {
    if (!selectedNode) {
      setNodeDetails(null);
      setNodeDocumentation(null);
      return;
    }

    const loadNodeDetails = async () => {
      try {
        const [node, doc] = await Promise.all([
          lineageService.getNodeById(selectedNode.id),
          lineageService.getDocumentationForEntity('lineage_node', selectedNode.id),
        ]);
        setNodeDetails(node);
        setNodeDocumentation(doc);
      } catch (err) {
        console.error('Error loading node details:', err);
      }
    };
    loadNodeDetails();
  }, [selectedNode]);

  // Export audit trail
  const handleExportAuditTrail = async () => {
    if (!selectedFsId) return;
    setExporting(true);
    try {
      const data = await lineageService.exportAuditTrail(selectedFsId);
      setAuditTrailExport(data);
      setActiveTab('export');
    } catch (err: any) {
      setError(err.message || 'Fehler beim Exportieren');
    } finally {
      setExporting(false);
    }
  };

  // Download export as JSON
  const handleDownloadExport = () => {
    if (!auditTrailExport) return;
    const blob = new Blob([JSON.stringify(auditTrailExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${financialStatement?.fiscalYear || 'export'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Graph visualization using SVG
  const graphVisualization = useMemo(() => {
    if (!graph || graph.nodes.length === 0) return null;

    const width = 1200;
    const height = 800;
    const nodeRadius = 40;
    
    // Group nodes by type for layered layout
    const layers: Record<string, LineageGraphNode[]> = {};
    const layerOrder = [
      'source_data',
      'account_balance',
      'aggregation',
      'intercompany_elimination',
      'capital_consolidation',
      'debt_consolidation',
      'currency_translation',
      'minority_interest',
      'deferred_tax',
      'reclassification',
      'valuation_adjustment',
      'proportional_share',
      'equity_method',
      'consolidated_value',
    ];

    graph.nodes.forEach(node => {
      const layer = node.type;
      if (!layers[layer]) layers[layer] = [];
      layers[layer].push(node);
    });

    // Calculate positions
    const positions: Record<string, { x: number; y: number }> = {};
    let currentY = 60;

    layerOrder.forEach(layerType => {
      const nodesInLayer = layers[layerType] || [];
      if (nodesInLayer.length === 0) return;

      const layerWidth = width - 100;
      const spacing = layerWidth / (nodesInLayer.length + 1);

      nodesInLayer.forEach((node, index) => {
        positions[node.id] = {
          x: 50 + spacing * (index + 1),
          y: currentY,
        };
      });

      currentY += 100;
    });

    // Handle nodes not in layer order
    graph.nodes.forEach(node => {
      if (!positions[node.id]) {
        positions[node.id] = {
          x: Math.random() * (width - 100) + 50,
          y: Math.random() * (height - 100) + 50,
        };
      }
    });

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="lineage-graph-svg">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
          </marker>
        </defs>

        {/* Edges */}
        {graph.edges.map(edge => {
          const source = positions[edge.source];
          const target = positions[edge.target];
          if (!source || !target) return null;

          // Calculate edge path with offset for arrow
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const offsetX = (dx / length) * nodeRadius;
          const offsetY = (dy / length) * nodeRadius;

          return (
            <g key={edge.id}>
              <line
                x1={source.x + offsetX}
                y1={source.y + offsetY}
                x2={target.x - offsetX}
                y2={target.y - offsetY}
                stroke="#64748b"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
                opacity="0.6"
              />
              <text
                x={(source.x + target.x) / 2}
                y={(source.y + target.y) / 2 - 5}
                textAnchor="middle"
                fontSize="10"
                fill="#94a3b8"
              >
                {edge.label}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {graph.nodes.map(node => {
          const pos = positions[node.id];
          if (!pos) return null;

          const isSelected = selectedNode?.id === node.id;
          const color = nodeTypeColors[node.type] || '#6366f1';

          return (
            <g
              key={node.id}
              onClick={() => setSelectedNode(node)}
              style={{ cursor: 'pointer' }}
            >
              {/* Node circle */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={nodeRadius}
                fill={color}
                stroke={isSelected ? '#fff' : 'transparent'}
                strokeWidth={isSelected ? 3 : 0}
                opacity={isSelected ? 1 : 0.85}
              />
              
              {/* Audit badge */}
              {node.isAudited && (
                <circle
                  cx={pos.x + nodeRadius * 0.7}
                  cy={pos.y - nodeRadius * 0.7}
                  r={10}
                  fill="#22c55e"
                />
              )}
              
              {/* Final badge */}
              {node.isFinal && (
                <circle
                  cx={pos.x - nodeRadius * 0.7}
                  cy={pos.y - nodeRadius * 0.7}
                  r={10}
                  fill="#3b82f6"
                />
              )}

              {/* Label */}
              <text
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="11"
                fontWeight="500"
                fill="white"
              >
                {node.label.length > 12 ? node.label.substring(0, 12) + '...' : node.label}
              </text>

              {/* Value */}
              <text
                x={pos.x}
                y={pos.y + 14}
                textAnchor="middle"
                fontSize="9"
                fill="rgba(255,255,255,0.8)"
              >
                {node.value.toLocaleString('de-DE', { minimumFractionDigits: 2 })} {node.currency}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }, [graph, selectedNode]);

  if (loading && !graph) {
    return (
      <div className="page-loading">
        <div className="loading-spinner" />
        <p>Lade Datenherkunft...</p>
      </div>
    );
  }

  return (
    <div className="data-lineage-page">
      {/* Back Button */}
      <div style={{ marginBottom: '16px' }}>
        <button 
          className="btn btn-secondary" 
          onClick={() => navigate('/')}
        >
          ← Zurück zum Dashboard
        </button>
      </div>

      {/* Header */}
      <div className="page-header">
        <div className="page-header-content">
          <h1 className="page-title">Datenherkunft & Prüfpfad</h1>
          <p className="page-subtitle">
            Vollständige Nachverfolgbarkeit aller Konsolidierungsdaten für Wirtschaftsprüfer
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
          <button
            className="btn btn-primary"
            onClick={handleExportAuditTrail}
            disabled={!selectedFsId || exporting}
          >
            {exporting ? 'Exportiere...' : 'Prüfpfad exportieren'}
          </button>
        </div>
      </div>

      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/' },
          { label: 'Berichte', to: '/reports' },
          { label: 'Prüfpfad' }
        ]}
      />

      {/* Error message */}
      {error && (
        <ErrorState
          error={error}
          onRetry={() => {
            setError(null);
            if (selectedFsId) {
              loadLineageData(selectedFsId);
            }
          }}
          context={{
            page: 'DataLineage',
            financialStatementId: selectedFsId || undefined,
          }}
          alternativeActions={[
            {
              label: 'Zum Dashboard',
              onClick: () => navigate('/')
            }
          ]}
        />
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="metrics-grid">
          <MetricCard
            title="Datenpunkte"
            value={stats.total.toString()}
            subtitle="Erfasste Lineage-Knoten"
            trend="neutral"
          />
          <MetricCard
            title="Dokumentiert"
            value={`${stats.byStatus.documented || 0}`}
            subtitle={`${Math.round(((stats.byStatus.documented || 0) / stats.total) * 100) || 0}% abgeschlossen`}
            trend={(stats.byStatus.documented || 0) > 0 ? "up" : "neutral"}
          />
          <MetricCard
            title="Verifiziert"
            value={`${stats.byStatus.verified || 0}`}
            subtitle="Durch WP bestätigt"
            trend={(stats.byStatus.verified || 0) > 0 ? "up" : "neutral"}
          />
          <MetricCard
            title="Prüfung erforderlich"
            value={`${stats.byStatus.requires_review || 0}`}
            subtitle="Offene Punkte"
            trend={(stats.byStatus.requires_review || 0) > 0 ? "down" : "neutral"}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="tabs-container">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'graph' ? 'active' : ''}`}
            onClick={() => setActiveTab('graph')}
          >
            Lineage Graph
          </button>
          <button
            className={`tab ${activeTab === 'documentation' ? 'active' : ''}`}
            onClick={() => setActiveTab('documentation')}
          >
            Dokumentation ({documentation.length})
          </button>
          <button
            className={`tab ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
          >
            Export
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Graph Tab */}
        {activeTab === 'graph' && (
          <div className="lineage-graph-container">
            <div className="lineage-graph-main">
              {graph && graph.nodes.length > 0 ? (
                <div className="graph-wrapper">
                  {graphVisualization}
                </div>
              ) : (
                <div className="empty-state">
                  <p>Keine Lineage-Daten vorhanden.</p>
                  <p className="text-muted">
                    Lineage-Daten werden automatisch während der Konsolidierung erfasst.
                  </p>
                </div>
              )}
            </div>

            {/* Node Details Sidebar */}
            {selectedNode && (
              <div className="lineage-node-details">
                <div className="node-details-header">
                  <h3>{selectedNode.label}</h3>
                  <button
                    className="btn-close"
                    onClick={() => setSelectedNode(null)}
                  >
                    &times;
                  </button>
                </div>

                <div className="node-details-content">
                  <div className="detail-row">
                    <span className="detail-label">Typ:</span>
                    <span className="detail-value">
                      {nodeTypeLabels[selectedNode.type] || selectedNode.type}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Wert:</span>
                    <span className="detail-value">
                      {selectedNode.value.toLocaleString('de-DE', { minimumFractionDigits: 2 })} {selectedNode.currency}
                    </span>
                  </div>
                  {selectedNode.companyName && (
                    <div className="detail-row">
                      <span className="detail-label">Gesellschaft:</span>
                      <span className="detail-value">{selectedNode.companyName}</span>
                    </div>
                  )}
                  {selectedNode.accountCode && (
                    <div className="detail-row">
                      <span className="detail-label">Konto:</span>
                      <span className="detail-value">{selectedNode.accountCode}</span>
                    </div>
                  )}
                  {selectedNode.hgbSection && (
                    <div className="detail-row">
                      <span className="detail-label">HGB-Referenz:</span>
                      <span className="detail-value">{selectedNode.hgbSection}</span>
                    </div>
                  )}

                  <div className="node-badges">
                    {selectedNode.isAudited && (
                      <span className="badge badge-success">Geprüft</span>
                    )}
                    {selectedNode.isFinal && (
                      <span className="badge badge-info">Final</span>
                    )}
                  </div>

                  {/* Documentation Status */}
                  <div className="documentation-section">
                    <h4>Dokumentation</h4>
                    {nodeDocumentation ? (
                      <div className="doc-status">
                        <span
                          className="status-indicator"
                          style={{ backgroundColor: statusColors[nodeDocumentation.status] }}
                        />
                        <span>{statusLabels[nodeDocumentation.status]}</span>
                      </div>
                    ) : (
                      <p className="text-muted">Keine Dokumentation vorhanden</p>
                    )}
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowDocModal(true)}
                    >
                      {nodeDocumentation ? 'Bearbeiten' : 'Dokumentieren'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Documentation Tab */}
        {activeTab === 'documentation' && (
          <div className="documentation-list">
            {documentation.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Entität</th>
                    <th>HGB-Referenz</th>
                    <th>Status</th>
                    <th>Risiko</th>
                    <th>Erstellt von</th>
                    <th>Verifiziert</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {documentation.map(doc => (
                    <tr key={doc.id}>
                      <td>
                        <div className="cell-content">
                          <span className="cell-main">{doc.documentationSummary.substring(0, 50)}...</span>
                          <span className="cell-sub">{doc.entityType}</span>
                        </div>
                      </td>
                      <td>{doc.hgbSection || '-'}</td>
                      <td>
                        <span
                          className="status-badge"
                          style={{ backgroundColor: statusColors[doc.status] }}
                        >
                          {statusLabels[doc.status]}
                        </span>
                      </td>
                      <td>
                        {doc.riskLevel && (
                          <span className={`risk-badge risk-${doc.riskLevel}`}>
                            {doc.riskLevel === 'low' ? 'Niedrig' : doc.riskLevel === 'medium' ? 'Mittel' : 'Hoch'}
                          </span>
                        )}
                      </td>
                      <td>{doc.preparedByName || '-'}</td>
                      <td>
                        {doc.verifiedAt ? (
                          <span className="verified-badge">
                            [Verifiziert] {doc.verifiedByName}
                          </span>
                        ) : (
                          <span className="text-muted">Ausstehend</span>
                        )}
                      </td>
                      <td>
                        <button className="btn-icon" title="Anzeigen">
                          Anzeigen
                        </button>
                        <button className="btn-icon" title="Bearbeiten">
                          Bearbeiten
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <p>Keine Dokumentation vorhanden.</p>
              </div>
            )}
          </div>
        )}

        {/* Export Tab */}
        {activeTab === 'export' && (
          <div className="export-section">
            {auditTrailExport ? (
              <div className="export-content">
                <div className="export-summary">
                  <h3>Prüfpfad Export - GJ {auditTrailExport.fiscalYear}</h3>
                  <p>Exportiert am: {new Date(auditTrailExport.exportedAt).toLocaleString('de-DE')}</p>
                  
                  <div className="export-stats">
                    <div className="stat-card">
                      <span className="stat-value">{auditTrailExport.summary.totalNodes}</span>
                      <span className="stat-label">Datenpunkte</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-value">{auditTrailExport.summary.totalTraces}</span>
                      <span className="stat-label">Transformationen</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-value">{auditTrailExport.summary.documentedPercentage}%</span>
                      <span className="stat-label">Dokumentiert</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-value">{auditTrailExport.summary.verifiedPercentage}%</span>
                      <span className="stat-label">Verifiziert</span>
                    </div>
                  </div>

                  <div className="export-breakdown">
                    <h4>Datenpunkte nach Typ</h4>
                    <div className="type-breakdown">
                      {Object.entries(auditTrailExport.summary.nodesByType).map(([type, count]) => (
                        <div key={type} className="type-row">
                          <span
                            className="type-color"
                            style={{ backgroundColor: nodeTypeColors[type] }}
                          />
                          <span className="type-name">{nodeTypeLabels[type] || type}</span>
                          <span className="type-count">{count as number}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="export-actions">
                  <button className="btn btn-primary" onClick={handleDownloadExport}>
                    Als JSON herunterladen
                  </button>
                  <button className="btn btn-secondary" onClick={() => window.print()}>
                    Drucken
                  </button>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p>Kein Export vorhanden.</p>
                <p className="text-muted">
                  Klicken Sie auf "Prüfpfad exportieren" um den vollständigen Audit-Trail zu generieren.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="lineage-legend">
        <h4>Legende</h4>
        <div className="legend-items">
          {Object.entries(nodeTypeLabels).slice(0, 8).map(([type, label]) => (
            <div key={type} className="legend-item">
              <span
                className="legend-color"
                style={{ backgroundColor: nodeTypeColors[type] }}
              />
              <span className="legend-label">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Documentation Modal */}
      <Modal
        isOpen={showDocModal}
        onClose={() => setShowDocModal(false)}
        title={nodeDocumentation ? 'Dokumentation bearbeiten' : 'Neue Dokumentation'}
      >
        <div className="documentation-form">
          <p className="text-muted">
            Dokumentationsformular wird hier implementiert.
          </p>
        </div>
      </Modal>

      {/* Styles */}
      <style>{`
        .data-lineage-page {
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
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
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

        .lineage-graph-container {
          display: flex;
          gap: 24px;
          background: var(--card-bg, #fff);
          border-radius: 12px;
          border: 1px solid var(--border-color, #e2e8f0);
          overflow: hidden;
        }

        .lineage-graph-main {
          flex: 1;
          min-height: 600px;
          overflow: auto;
        }

        .graph-wrapper {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          min-height: 600px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .lineage-graph-svg {
          display: block;
        }

        .lineage-node-details {
          width: 320px;
          border-left: 1px solid var(--border-color, #e2e8f0);
          background: var(--card-bg, #fff);
        }

        .node-details-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid var(--border-color, #e2e8f0);
        }

        .node-details-header h3 {
          margin: 0;
          font-size: 16px;
        }

        .btn-close {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: var(--text-secondary);
        }

        .node-details-content {
          padding: 16px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid var(--border-color, #e2e8f0);
        }

        .detail-label {
          color: var(--text-secondary);
          font-size: 13px;
        }

        .detail-value {
          font-weight: 500;
        }

        .node-badges {
          display: flex;
          gap: 8px;
          margin-top: 16px;
        }

        .badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .badge-success {
          background: #dcfce7;
          color: #166534;
        }

        .badge-info {
          background: #dbeafe;
          color: #1e40af;
        }

        .documentation-section {
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid var(--border-color, #e2e8f0);
        }

        .documentation-section h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
        }

        .doc-status {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .status-indicator {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .documentation-list {
          background: var(--card-bg, #fff);
          border-radius: 12px;
          border: 1px solid var(--border-color, #e2e8f0);
          overflow: hidden;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
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

        .cell-content {
          display: flex;
          flex-direction: column;
        }

        .cell-main {
          font-weight: 500;
        }

        .cell-sub {
          font-size: 12px;
          color: var(--text-secondary);
        }

        .status-badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
          color: white;
        }

        .risk-badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .risk-low {
          background: #dcfce7;
          color: #166534;
        }

        .risk-medium {
          background: #fef3c7;
          color: #92400e;
        }

        .risk-high {
          background: #fee2e2;
          color: #991b1b;
        }

        .verified-badge {
          color: #16a34a;
          font-weight: 500;
        }

        .btn-icon {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          padding: 4px;
          opacity: 0.7;
          transition: opacity 0.2s;
        }

        .btn-icon:hover {
          opacity: 1;
        }

        .export-section {
          background: var(--card-bg, #fff);
          border-radius: 12px;
          border: 1px solid var(--border-color, #e2e8f0);
          padding: 24px;
        }

        .export-summary h3 {
          margin: 0 0 8px 0;
        }

        .export-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin: 24px 0;
        }

        .stat-card {
          background: var(--bg-secondary, #f8fafc);
          padding: 16px;
          border-radius: 8px;
          text-align: center;
        }

        .stat-value {
          display: block;
          font-size: 28px;
          font-weight: 700;
          color: var(--primary, #6366f1);
        }

        .stat-label {
          display: block;
          font-size: 13px;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        .export-breakdown {
          margin-top: 24px;
        }

        .export-breakdown h4 {
          margin: 0 0 12px 0;
        }

        .type-breakdown {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .type-row {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--bg-secondary, #f8fafc);
          padding: 8px 12px;
          border-radius: 6px;
        }

        .type-color {
          width: 12px;
          height: 12px;
          border-radius: 3px;
        }

        .type-name {
          font-size: 13px;
        }

        .type-count {
          font-weight: 600;
        }

        .export-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid var(--border-color, #e2e8f0);
        }

        .lineage-legend {
          margin-top: 24px;
          padding: 16px;
          background: var(--card-bg, #fff);
          border-radius: 12px;
          border: 1px solid var(--border-color, #e2e8f0);
        }

        .lineage-legend h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
        }

        .legend-items {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .legend-color {
          width: 14px;
          height: 14px;
          border-radius: 4px;
        }

        .legend-label {
          font-size: 13px;
          color: var(--text-secondary);
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

        .btn-primary:hover {
          background: var(--primary-dark, #4f46e5);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: var(--bg-secondary, #f1f5f9);
          color: var(--text-primary, #1e293b);
        }

        .btn-secondary:hover {
          background: #e2e8f0;
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 13px;
        }

        .text-muted {
          color: var(--text-secondary, #64748b);
        }

        @media (max-width: 1024px) {
          .lineage-graph-container {
            flex-direction: column;
          }

          .lineage-node-details {
            width: 100%;
            border-left: none;
            border-top: 1px solid var(--border-color, #e2e8f0);
          }

          .export-stats {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}
