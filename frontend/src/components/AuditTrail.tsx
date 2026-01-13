import React, { useState, useEffect } from 'react';
import { AuditLog, AuditAction, AuditEntityType } from '../types';
import auditService from '../services/auditService';
import { useToast } from '../contexts/ToastContext';

interface AuditTrailProps {
  financialStatementId?: string;
  entityType?: AuditEntityType;
  entityId?: string;
  onClose?: () => void;
}

const ACTION_LABELS: Record<AuditAction, string> = {
  create: 'Erstellt',
  update: 'Aktualisiert',
  delete: 'Gelöscht',
  approve: 'Freigegeben',
  reject: 'Abgelehnt',
  reverse: 'Storniert',
  submit: 'Eingereicht',
  import: 'Importiert',
  export: 'Exportiert',
  calculate: 'Berechnet',
  login: 'Angemeldet',
  logout: 'Abgemeldet',
};

const ACTION_ICONS: Record<AuditAction, string> = {
  create: '➕',
  update: '✏️',
  delete: '🗑️',
  approve: 'Freigabe',
  reject: '❌',
  reverse: '↩️',
  submit: 'Einreichung',
  import: '📥',
  export: 'Export',
  calculate: '🔢',
  login: '🔑',
  logout: '🚪',
};

const ENTITY_LABELS: Record<AuditEntityType, string> = {
  company: 'Unternehmen',
  financial_statement: 'Jahresabschluss',
  account_balance: 'Kontosaldo',
  consolidation_entry: 'Konsolidierungsbuchung',
  participation: 'Beteiligung',
  exchange_rate: 'Wechselkurs',
  intercompany_transaction: 'IC-Transaktion',
  deferred_tax: 'Latente Steuer',
  ic_reconciliation: 'IC-Abstimmung',
  user: 'Benutzer',
  system: 'System',
};

const AuditTrail: React.FC<AuditTrailProps> = ({
  financialStatementId,
  entityType,
  entityId,
  onClose,
}) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [filterAction, setFilterAction] = useState<AuditAction | ''>('');
  const [filterEntityType, setFilterEntityType] = useState<AuditEntityType | ''>('');
  const { showToast } = useToast();

  useEffect(() => {
    loadLogs();
  }, [financialStatementId, entityType, entityId]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      
      let result: AuditLog[];
      
      if (entityType && entityId) {
        result = await auditService.getEntityAuditTrail(entityType, entityId);
      } else if (financialStatementId) {
        result = await auditService.getFinancialStatementActivity(financialStatementId, 100);
      } else {
        const response = await auditService.getLogs({ limit: 100 });
        result = response.logs;
      }
      
      setLogs(result);
    } catch (error) {
      console.error('Error loading audit logs:', error);
      showToast('Fehler beim Laden der Audit-Logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (filterAction && log.action !== filterAction) return false;
    if (filterEntityType && log.entityType !== filterEntityType) return false;
    return true;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return <div className="loading">Lade Audit-Trail...</div>;
  }

  return (
    <div className="audit-trail">
      <div className="audit-header">
        <h2>🔍 Audit-Trail</h2>
        {onClose && (
          <button className="btn-close" onClick={onClose}>×</button>
        )}
      </div>

      {/* Filters */}
      <div className="audit-filters">
        <div className="filter-group">
          <label>Aktion:</label>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value as AuditAction | '')}
          >
            <option value="">Alle Aktionen</option>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Entität:</label>
          <select
            value={filterEntityType}
            onChange={(e) => setFilterEntityType(e.target.value as AuditEntityType | '')}
          >
            <option value="">Alle Entitäten</option>
            {Object.entries(ENTITY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <button className="btn-secondary" onClick={loadLogs}>
          🔄 Aktualisieren
        </button>
      </div>

      {/* Timeline */}
      <div className="audit-timeline">
        {filteredLogs.length === 0 ? (
          <p className="empty-state">Keine Audit-Einträge gefunden.</p>
        ) : (
          filteredLogs.map((log) => (
            <div 
              key={log.id} 
              className={`timeline-item action-${log.action}`}
              onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
            >
              <div className="timeline-marker">
                <span className="action-icon">{ACTION_ICONS[log.action]}</span>
              </div>
              <div className="timeline-content">
                <div className="timeline-header">
                  <span className="timestamp">{formatDate(log.createdAt)}</span>
                  <span className={`action-badge ${log.action}`}>
                    {ACTION_LABELS[log.action]}
                  </span>
                </div>
                <div className="timeline-body">
                  <p className="description">
                    {log.description || `${ENTITY_LABELS[log.entityType]}: ${log.entityName || log.entityId}`}
                  </p>
                  {log.userName && (
                    <p className="user">👤 {log.userName}</p>
                  )}
                </div>
                
                {selectedLog?.id === log.id && (
                  <div className="timeline-details">
                    <h4>Details</h4>
                    <dl>
                      <dt>Entität</dt>
                      <dd>{ENTITY_LABELS[log.entityType]}</dd>
                      
                      {log.entityId && (
                        <>
                          <dt>ID</dt>
                          <dd><code>{log.entityId}</code></dd>
                        </>
                      )}
                      
                      {log.ipAddress && (
                        <>
                          <dt>IP-Adresse</dt>
                          <dd>{log.ipAddress}</dd>
                        </>
                      )}
                    </dl>
                    
                    {log.changes && Object.keys(log.changes).length > 0 && (
                      <div className="changes">
                        <h5>Änderungen</h5>
                        <table className="changes-table">
                          <thead>
                            <tr>
                              <th>Feld</th>
                              <th>Vorher</th>
                              <th>Nachher</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(log.changes).map(([field, change]) => (
                              <tr key={field}>
                                <td>{field}</td>
                                <td className="old-value">{JSON.stringify(change.from)}</td>
                                <td className="new-value">{JSON.stringify(change.to)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      <div className="audit-summary">
        <p>
          Zeige {filteredLogs.length} von {logs.length} Einträgen
        </p>
      </div>
    </div>
  );
};

export default AuditTrail;
