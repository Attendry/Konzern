import { useState } from 'react';
import type { QualityIndicators } from '../../types/agent.types';
import { getConfidenceColor } from '../../types/agent.types';
import './agent.css';

interface QualityDisplayProps {
  quality: QualityIndicators;
  compact?: boolean;
}

export const QualityDisplay: React.FC<QualityDisplayProps> = ({
  quality,
  compact = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const overallPercent = Math.round(quality.confidenceBreakdown.overall * 100);
  const color = getConfidenceColor(quality.confidenceLevel);

  if (compact) {
    return (
      <div 
        className="quality-compact"
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer' }}
      >
        <span className="quality-badge" style={{ backgroundColor: color }}>
          <span className="confidence-dot" style={{ backgroundColor: 'white' }} />
          {overallPercent}%
        </span>
      </div>
    );
  }

  return (
    <div className="quality-display">
      <div 
        className="quality-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="quality-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 20V10" />
            <path d="M12 20V4" />
            <path d="M6 20v-6" />
          </svg>
          Qualitätsindikatoren
        </span>
        <span className="quality-overall" style={{ backgroundColor: color }}>
          <span className="confidence-dot-inline" />
          {overallPercent}%
        </span>
      </div>

      {expanded && (
        <div className="quality-details">
          {/* Data Completeness */}
          <div className="quality-row">
            <span className="quality-label">Datenvollständigkeit:</span>
            <div className="quality-bar-container">
              <div 
                className="quality-bar" 
                style={{ width: `${quality.dataCompleteness.percentage}%` }}
              />
              <span className="quality-value">
                {Math.round(quality.dataCompleteness.percentage)}%
              </span>
            </div>
          </div>
          
          {quality.dataCompleteness.missingData && 
           quality.dataCompleteness.missingData.length > 0 && (
            <div className="quality-warning">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Fehlend: {quality.dataCompleteness.missingData.join(', ')}
            </div>
          )}

          {/* HGB Conformity */}
          <div className="quality-row">
            <span className="quality-label">HGB-Konformität:</span>
            <span className={`quality-status ${quality.ruleCompliance.hgbConformity ? 'pass' : 'fail'}`}>
              {quality.ruleCompliance.hgbConformity ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  eingehalten
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  Abweichungen
                </>
              )}
            </span>
          </div>
          
          {quality.ruleCompliance.deviations && 
           quality.ruleCompliance.deviations.length > 0 && (
            <div className="quality-warning">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              {quality.ruleCompliance.deviations.join('; ')}
            </div>
          )}

          {/* Historical Accuracy */}
          {quality.historicalAccuracy && (
            <div className="quality-row">
              <span className="quality-label">Historische Trefferquote:</span>
              <span className="quality-value">
                {Math.round(quality.historicalAccuracy.accuracy * 100)}% 
                ({quality.historicalAccuracy.correctPredictions}/{quality.historicalAccuracy.similarCases})
              </span>
            </div>
          )}

          {/* Confidence Breakdown */}
          <div className="quality-breakdown">
            <h5>Konfidenz-Aufschlüsselung:</h5>
            <div className="breakdown-grid">
              <BreakdownItem 
                label="Datenqualität" 
                value={quality.confidenceBreakdown.dataQuality} 
              />
              <BreakdownItem 
                label="Mustererkennung" 
                value={quality.confidenceBreakdown.patternMatch} 
              />
              <BreakdownItem 
                label="Regelkonformität" 
                value={quality.confidenceBreakdown.ruleMatch} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface BreakdownItemProps {
  label: string;
  value: number;
}

const BreakdownItem: React.FC<BreakdownItemProps> = ({ label, value }) => {
  const percent = Math.round(value * 100);
  
  return (
    <div className="breakdown-item">
      <span className="breakdown-label">{label}</span>
      <div className="breakdown-bar-container">
        <div 
          className="breakdown-bar" 
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="breakdown-value">{percent}%</span>
    </div>
  );
};

export default QualityDisplay;
