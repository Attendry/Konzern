import { useState, useEffect } from 'react';
import type { LegalChangeAlert } from '../../types/legal.types';
import { LegalChangeAlert as LegalChangeAlertComponent } from './LegalChangeAlert';
import aiService from '../../services/aiService';
import './legal-alerts.css';

interface LegalChangeAlertsProps {
  userId?: string;
  maxVisible?: number;
}

export const LegalChangeAlerts: React.FC<LegalChangeAlertsProps> = ({
  userId,
  maxVisible = 3,
}) => {
  const [alerts, setAlerts] = useState<LegalChangeAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadAlerts();
    
    // Refresh alerts every 5 minutes
    const interval = setInterval(loadAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userId]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const fetchedAlerts = await aiService.getLegalAlerts(userId);
      // Filter to only show alerts user hasn't seen
      const unseenAlerts = fetchedAlerts.filter(a => !a.userHasSeen);
      setAlerts(unseenAlerts);
    } catch (error) {
      console.error('Failed to load legal alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = (dismissedAlert: LegalChangeAlert) => {
    setAlerts(prev => prev.filter(a => a.change.id !== dismissedAlert.change.id));
  };

  if (loading) {
    return null;
  }

  if (alerts.length === 0) {
    return null;
  }

  const visibleAlerts = expanded ? alerts : alerts.slice(0, maxVisible);
  const remainingCount = alerts.length - maxVisible;

  return (
    <div className="legal-alerts-container">
      {visibleAlerts.map((alert) => (
        <LegalChangeAlertComponent
          key={alert.change.id}
          alert={alert}
          onDismiss={() => handleDismiss(alert)}
        />
      ))}
      
      {!expanded && remainingCount > 0 && (
        <button
          className="legal-alerts-expand"
          onClick={() => setExpanded(true)}
        >
          {remainingCount} weitere Änderung{remainingCount > 1 ? 'en' : ''} anzeigen
        </button>
      )}
      
      {expanded && alerts.length > maxVisible && (
        <button
          className="legal-alerts-collapse"
          onClick={() => setExpanded(false)}
        >
          Weniger anzeigen
        </button>
      )}
    </div>
  );
};

export default LegalChangeAlerts;
