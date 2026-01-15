import { useState } from 'react';
import type { LegalChangeAlert as LegalChangeAlertType } from '../../types/legal.types';
import aiService from '../../services/aiService';
import './legal-alerts.css';

interface LegalChangeAlertProps {
  alert: LegalChangeAlertType;
  onDismiss?: () => void;
}

export const LegalChangeAlert: React.FC<LegalChangeAlertProps> = ({
  alert,
  onDismiss,
}) => {
  const [dismissing, setDismissing] = useState(false);

  const handleDismiss = async () => {
    setDismissing(true);
    try {
      await aiService.dismissLegalAlert(alert.change.id);
      onDismiss?.();
    } catch (error) {
      console.error('Failed to dismiss alert:', error);
    } finally {
      setDismissing(false);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const getSeverityColor = (severity: 'low' | 'medium' | 'high'): string => {
    switch (severity) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#3b82f6';
    }
  };

  const getChangeTypeLabel = (type: string): string => {
    switch (type) {
      case 'amendment': return 'Änderung';
      case 'addition': return 'Ergänzung';
      case 'repeal': return 'Aufhebung';
      case 'clarification': return 'Klarstellung';
      default: return type;
    }
  };

  return (
    <div 
      className={`legal-change-alert severity-${alert.impactSeverity}`}
      style={{ borderLeftColor: getSeverityColor(alert.impactSeverity) }}
    >
      <div className="alert-header">
        <div className="alert-title-section">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="alert-title">Rechtliche Änderung</span>
          <span className="alert-type-badge">{getChangeTypeLabel(alert.change.changeType)}</span>
        </div>
        <div className="alert-meta">
          <span className="alert-date">
            Ab {formatDate(alert.change.effectiveDate)}
            {alert.daysUntilEffective > 0 && (
              <span className="days-remaining"> ({alert.daysUntilEffective} Tage)</span>
            )}
          </span>
        </div>
      </div>
      
      <div className="alert-content">
        <div className="alert-paragraph">
          <strong>{alert.paragraph.fullReference}</strong> - {alert.paragraph.title}
        </div>
        <p className="alert-summary">{alert.change.changeSummary}</p>
        
        {alert.change.impactOnConsolidation && (
          <div className="alert-impact">
            <strong>Auswirkung auf Konsolidierung:</strong>
            <p>{alert.change.impactOnConsolidation}</p>
          </div>
        )}
        
        {alert.change.lawName && (
          <div className="alert-source">
            <strong>Quelle:</strong> {alert.change.lawName}
            {alert.change.sourceReference && ` (${alert.change.sourceReference})`}
          </div>
        )}
      </div>
      
      <div className="alert-actions">
        {alert.change.sourceUrl && (
          <a 
            href={alert.change.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="alert-btn secondary"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Details ansehen
          </a>
        )}
        <button 
          onClick={handleDismiss} 
          className="alert-btn dismiss"
          disabled={dismissing}
        >
          {dismissing ? '...' : 'Verstanden'}
        </button>
      </div>
    </div>
  );
};

export default LegalChangeAlert;
