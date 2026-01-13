import { useState, useEffect } from 'react';
import '../App.css';

interface Suggestion {
  id: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  type?: 'info' | 'tip' | 'warning';
  dismissible?: boolean;
}

interface SmartSuggestionsProps {
  suggestions: Suggestion[];
  maxVisible?: number;
  autoDismiss?: boolean;
  dismissDelay?: number;
  className?: string;
}

export function SmartSuggestions({
  suggestions,
  maxVisible = 3,
  autoDismiss = false,
  dismissDelay = 5000,
  className = '',
}: SmartSuggestionsProps) {
  const [visibleSuggestions, setVisibleSuggestions] = useState<Suggestion[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const filtered = suggestions
      .filter((s) => !dismissedIds.has(s.id))
      .slice(0, maxVisible);
    setVisibleSuggestions(filtered);
  }, [suggestions, dismissedIds, maxVisible]);

  useEffect(() => {
    if (autoDismiss && visibleSuggestions.length > 0) {
      const timer = setTimeout(() => {
        const firstId = visibleSuggestions[0].id;
        setDismissedIds((prev) => new Set([...prev, firstId]));
      }, dismissDelay);
      return () => clearTimeout(timer);
    }
  }, [visibleSuggestions, autoDismiss, dismissDelay]);

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
  };

  if (visibleSuggestions.length === 0) return null;

  return (
    <div className={`smart-suggestions ${className}`}>
      {visibleSuggestions.map((suggestion) => (
        <div
          key={suggestion.id}
          className={`smart-suggestion smart-suggestion-${suggestion.type || 'info'}`}
        >
          <div className="smart-suggestion-content">
            <span className="smart-suggestion-icon">
              {suggestion.type === 'tip' ? 'Tipp' : suggestion.type === 'warning' ? '!' : 'i'}
            </span>
            <span className="smart-suggestion-message">{suggestion.message}</span>
          </div>
          <div className="smart-suggestion-actions">
            {suggestion.action && (
              <button
                className="button button-sm button-primary"
                onClick={suggestion.action.onClick}
              >
                {suggestion.action.label}
              </button>
            )}
            {suggestion.dismissible !== false && (
              <button
                className="smart-suggestion-dismiss"
                onClick={() => handleDismiss(suggestion.id)}
                aria-label="Dismiss suggestion"
              >
                ×
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Hook for context-aware suggestions
export function useSmartSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const addSuggestion = (suggestion: Suggestion) => {
    setSuggestions((prev) => {
      // Don't add duplicates
      if (prev.some((s) => s.id === suggestion.id)) return prev;
      return [...prev, suggestion];
    });
  };

  const removeSuggestion = (id: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  };

  const clearSuggestions = () => {
    setSuggestions([]);
  };

  return {
    suggestions,
    addSuggestion,
    removeSuggestion,
    clearSuggestions,
  };
}