import { useState } from 'react';
import type { ReasoningChain, ReasoningStep, AlternativeInterpretation } from '../../types/agent.types';
import { getConfidenceLevel } from '../../types/agent.types';
import './agent.css';

interface ReasoningDisplayProps {
  reasoning: ReasoningChain;
  initiallyExpanded?: boolean;
}

export const ReasoningDisplay: React.FC<ReasoningDisplayProps> = ({
  reasoning,
  initiallyExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(initiallyExpanded);

  return (
    <div className="reasoning-display">
      <button 
        className="reasoning-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        {expanded ? 'Begründung ausblenden' : 'Begründung anzeigen'}
      </button>

      {expanded && (
        <div className="reasoning-content">
          <h4>Begründung</h4>
          
          {reasoning.steps.map((step, i) => (
            <ReasoningStepCard key={i} step={step} index={i} />
          ))}
          
          <div className="reasoning-conclusion">
            <strong>Fazit:</strong> {reasoning.conclusion}
          </div>
          
          {/* Prominent alternatives when confidence is low */}
          {reasoning.showAlternativesProminent && 
           reasoning.alternativeInterpretations && 
           reasoning.alternativeInterpretations.length > 0 && (
            <div className="alternatives-prominent">
              <div className="alternatives-warning">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Alternative Ursachen prüfen
              </div>
              <p className="alternatives-explanation">
                Die Konfidenz liegt unter 80%. Bitte prüfen Sie auch:
              </p>
              <div className="alternatives-list">
                {reasoning.alternativeInterpretations.map((alt, i) => (
                  <AlternativeCard key={i} alternative={alt} />
                ))}
              </div>
            </div>
          )}
          
          {/* Standard alternatives when confidence is high */}
          {!reasoning.showAlternativesProminent && 
           reasoning.alternativeInterpretations && 
           reasoning.alternativeInterpretations.length > 0 && (
            <div className="alternatives-standard">
              <h5>Alternative Interpretationen:</h5>
              <ul>
                {reasoning.alternativeInterpretations.map((alt, i) => (
                  <li key={i}>
                    {alt.interpretation} ({Math.round(alt.probability * 100)}%)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface ReasoningStepCardProps {
  step: ReasoningStep;
  index: number;
}

const ReasoningStepCard: React.FC<ReasoningStepCardProps> = ({ step, index }) => {
  const confidencePercent = Math.round(step.confidence * 100);
  const level = getConfidenceLevel(step.confidence);

  return (
    <div className="reasoning-step">
      <div className="step-header">
        <span className="step-number">Schritt {index + 1}</span>
        <span className={`step-confidence confidence-${level}`}>
          <span className="confidence-dot" />
          {confidencePercent}%
        </span>
      </div>
      <div className="step-content">
        <p><strong>Beobachtung:</strong> {step.observation}</p>
        <p><strong>Schlussfolgerung:</strong> {step.inference}</p>
        {step.dataPoints.length > 0 && (
          <div className="data-points">
            {step.dataPoints.map((dp, i) => (
              <span key={i} className="data-point-badge">
                {dp.length > 30 ? dp.substring(0, 30) + '...' : dp}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface AlternativeCardProps {
  alternative: AlternativeInterpretation;
}

const AlternativeCard: React.FC<AlternativeCardProps> = ({ alternative }) => {
  return (
    <div className="alternative-card">
      <div className="alternative-header">
        <span className="alternative-name">{alternative.interpretation}</span>
        <span className="alternative-probability">
          {Math.round(alternative.probability * 100)}%
        </span>
      </div>
      <div className="alternative-check">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {alternative.checkQuestion}
      </div>
    </div>
  );
};

export default ReasoningDisplay;
