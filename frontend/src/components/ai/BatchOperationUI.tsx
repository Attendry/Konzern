import { useState } from 'react';
import type { BatchResult } from '../../types/agent.types';
import './agent.css';

interface BatchOperationUIProps {
  batchResult: BatchResult;
  onViewDetails?: (index: number) => void;
  onDownloadReport?: () => void;
}

export const BatchOperationUI: React.FC<BatchOperationUIProps> = ({
  batchResult,
  onViewDetails,
  onDownloadReport,
}) => {
  const [expanded, setExpanded] = useState(false);
  
  const successRate = batchResult.total > 0 
    ? Math.round((batchResult.succeeded / batchResult.total) * 100) 
    : 0;

  return (
    <div className="batch-summary">
      <div className="batch-header">
        <h4>Batch-Verarbeitung abgeschlossen</h4>
        <button 
          className="batch-toggle"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Weniger anzeigen' : 'Details anzeigen'}
        </button>
      </div>

      <div className="batch-stats">
        <div className="batch-stat">
          <div className="batch-stat-value">{batchResult.total}</div>
          <div className="batch-stat-label">Gesamt</div>
        </div>
        <div className="batch-stat">
          <div className="batch-stat-value success">{batchResult.succeeded}</div>
          <div className="batch-stat-label">Erfolgreich</div>
        </div>
        <div className="batch-stat">
          <div className="batch-stat-value failed">{batchResult.failed}</div>
          <div className="batch-stat-label">Fehlgeschlagen</div>
        </div>
        <div className="batch-stat">
          <div className="batch-stat-value">{successRate}%</div>
          <div className="batch-stat-label">Erfolgsrate</div>
        </div>
      </div>

      <div className="batch-summary-text">
        {batchResult.summary}
      </div>

      {expanded && batchResult.resultIndex && (
        <div className="batch-results-list">
          <h5>Verarbeitete Elemente:</h5>
          <div className="batch-results-grid">
            {Object.entries(batchResult.resultIndex).map(([index, id]) => (
              <div 
                key={index} 
                className="batch-result-item"
                onClick={() => onViewDetails?.(parseInt(index))}
              >
                <span className="batch-result-index">#{parseInt(index) + 1}</span>
                <span className="batch-result-id">{id.substring(0, 8)}...</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="batch-actions">
        {batchResult.reportUrl && (
          <a 
            href={batchResult.reportUrl} 
            className="batch-action-btn secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Bericht herunterladen
          </a>
        )}
        {onDownloadReport && !batchResult.reportUrl && (
          <button 
            className="batch-action-btn secondary"
            onClick={onDownloadReport}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Bericht erstellen
          </button>
        )}
      </div>
    </div>
  );
};

export default BatchOperationUI;
