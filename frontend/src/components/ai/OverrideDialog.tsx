import { useState } from 'react';
import type { OverrideOption } from '../../types/agent.types';
import './agent.css';

interface OverrideDialogProps {
  options: OverrideOption[];
  aiRecommendation: string;
  onSubmit: (option: OverrideOption, reasoning?: string) => void;
  onCancel: () => void;
}

export const OverrideDialog: React.FC<OverrideDialogProps> = ({
  options,
  aiRecommendation,
  onSubmit,
  onCancel,
}) => {
  const [selectedOption, setSelectedOption] = useState<OverrideOption | null>(null);
  const [reasoning, setReasoning] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!selectedOption) {
      setError('Bitte wählen Sie eine Option.');
      return;
    }

    if (selectedOption.requiresReasoning && !reasoning.trim()) {
      setError('Bitte geben Sie eine Begründung an.');
      return;
    }

    onSubmit(selectedOption, reasoning.trim() || undefined);
  };

  return (
    <div className="override-dialog-overlay">
      <div className="override-dialog">
        <div className="override-header">
          <h3>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Empfehlung ablehnen
          </h3>
          <button className="override-close" onClick={onCancel}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="override-content">
          <div className="override-ai-recommendation">
            <strong>Die AI empfahl:</strong>
            <p>{aiRecommendation}</p>
          </div>

          <div className="override-options">
            <label className="override-options-label">Ihre Einschätzung:</label>
            {options.map((option) => (
              <div 
                key={option.id}
                className={`override-option ${selectedOption?.id === option.id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedOption(option);
                  setError('');
                }}
              >
                <input
                  type="radio"
                  name="override-option"
                  checked={selectedOption?.id === option.id}
                  onChange={() => setSelectedOption(option)}
                />
                <span>{option.label}</span>
                {option.requiresReasoning && (
                  <span className="requires-reasoning">(Begründung erforderlich)</span>
                )}
              </div>
            ))}
          </div>

          {selectedOption && (
            <div className="override-reasoning">
              <label>
                Begründung {selectedOption.requiresReasoning ? '(Pflichtfeld)' : '(optional)'}:
              </label>
              <textarea
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                placeholder="Ihre fachliche Begründung für die Abweichung..."
                rows={4}
              />
            </div>
          )}

          {error && (
            <div className="override-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              {error}
            </div>
          )}
        </div>

        <div className="override-actions">
          <button className="override-cancel" onClick={onCancel}>
            Abbrechen
          </button>
          <button 
            className="override-submit"
            onClick={handleSubmit}
            disabled={!selectedOption}
          >
            Ablehnung protokollieren
          </button>
        </div>
      </div>
    </div>
  );
};

export default OverrideDialog;
