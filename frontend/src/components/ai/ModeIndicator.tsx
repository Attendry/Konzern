import { useState, useEffect } from 'react';
import type { ModeStatus } from '../../types/agent.types';
import aiService from '../../services/aiService';
import './agent.css';

interface ModeIndicatorProps {
  userId?: string;
  onModeChange?: (mode: ModeStatus) => void;
}

export const ModeIndicator: React.FC<ModeIndicatorProps> = ({
  userId,
  onModeChange,
}) => {
  const [mode, setMode] = useState<ModeStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    loadModeStatus();
    
    // Poll for mode status every 30 seconds
    const interval = setInterval(loadModeStatus, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  const loadModeStatus = async () => {
    try {
      const status = await aiService.getModeStatus(userId);
      setMode(status);
    } catch (error) {
      console.error('Failed to load mode status:', error);
    }
  };

  const handleModeToggle = async () => {
    if (mode?.type === 'explain') {
      // Show confirmation before activating action mode
      setShowConfirmation(true);
    } else {
      // Deactivate action mode directly
      await changeMode('explain');
    }
  };

  const changeMode = async (newMode: 'explain' | 'action') => {
    setLoading(true);
    setShowConfirmation(false);
    
    try {
      const status = await aiService.setMode(newMode, userId);
      setMode(status);
      onModeChange?.(status);
    } catch (error) {
      console.error('Failed to change mode:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatRemainingTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (!mode) {
    return null;
  }

  const isActionMode = mode.type === 'action';

  return (
    <>
      <div className={`mode-indicator ${isActionMode ? 'action' : 'explain'}`}>
        <div className="mode-status" onClick={handleModeToggle}>
          <span className="mode-icon">
            {isActionMode ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            )}
          </span>
          <span className="mode-label">
            {isActionMode ? 'Aktions-Modus' : 'Erklär-Modus'}
          </span>
          {isActionMode && mode.remainingSeconds && (
            <span className="mode-timer">
              {formatRemainingTime(mode.remainingSeconds)}
            </span>
          )}
        </div>
        
        {loading && <span className="mode-loading">...</span>}
      </div>

      {showConfirmation && (
        <div className="mode-confirmation-overlay">
          <div className="mode-confirmation">
            <h3>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Aktions-Modus aktivieren
            </h3>
            
            <p>Im Aktions-Modus kann der AI-Agent:</p>
            <ul>
              <li>Korrekturbuchungen vorschlagen und erstellen</li>
              <li>Prüfungen als erledigt markieren</li>
              <li>IC-Differenzen akzeptieren</li>
            </ul>
            
            <p className="mode-warning">
              Alle Aktionen erfordern Ihre Bestätigung.
              Der Modus wird nach 30 Minuten automatisch deaktiviert.
            </p>

            <div className="mode-confirmation-actions">
              <button 
                className="mode-cancel"
                onClick={() => setShowConfirmation(false)}
              >
                Abbrechen
              </button>
              <button 
                className="mode-activate"
                onClick={() => changeMode('action')}
              >
                Aktivieren
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ModeIndicator;
