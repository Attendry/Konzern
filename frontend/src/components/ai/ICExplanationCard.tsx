import React, { useState } from 'react';
import aiService, { ICExplanation, CorrectionEntry } from '../../services/aiService';

// ==========================================
// TYPES
// ==========================================

interface ICExplanationCardProps {
  reconciliationId: string;
  onApplyCorrection?: (correction: CorrectionEntry) => void;
  onAccept?: (reconciliationId: string, reason: string) => void;
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

const getCauseIcon = (cause: string): string => {
  const icons: Record<string, string> = {
    timing: '⏰',
    fx: '💱',
    rounding: '🔢',
    missing_entry: '❓',
    error: '⚠️',
    unknown: '❔',
  };
  return icons[cause] || '❔';
};

const getCauseLabel = (cause: string): string => {
  const labels: Record<string, string> = {
    timing: 'Timing-Differenz',
    fx: 'Währungsdifferenz',
    rounding: 'Rundungsdifferenz',
    missing_entry: 'Fehlende Buchung',
    error: 'Buchungsfehler',
    unknown: 'Unbekannt',
  };
  return labels[cause] || 'Unbekannt';
};

const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.8) return '#2e7d32'; // green
  if (confidence >= 0.5) return '#f57c00'; // orange
  return '#c62828'; // red
};

// ==========================================
// COMPONENT
// ==========================================

export const ICExplanationCard: React.FC<ICExplanationCardProps> = ({
  reconciliationId,
  onApplyCorrection,
  onAccept,
}) => {
  const [explanation, setExplanation] = useState<ICExplanation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await aiService.explainDifference(reconciliationId);
      setExplanation(result);
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Analyse fehlgeschlagen';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyCorrection = () => {
    if (explanation?.correctionEntry && onApplyCorrection) {
      onApplyCorrection(explanation.correctionEntry);
    }
  };

  const handleAccept = () => {
    if (explanation && onAccept) {
      onAccept(reconciliationId, explanation.suggestedAction);
    }
  };

  // Initial state - show analyze button
  if (!explanation && !isLoading && !error) {
    return (
      <button
        onClick={analyze}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 18px',
          backgroundColor: '#1a73e8',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 500,
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1557b0'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1a73e8'}
      >
        <span>🤖</span>
        <span>AI Analyse</span>
      </button>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div style={{ 
        padding: 20, 
        backgroundColor: '#f5f5f5', 
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{
          width: 20,
          height: 20,
          border: '2px solid #1a73e8',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <span style={{ color: '#666' }}>Analysiere Differenz mit AI...</span>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{ 
        padding: 16, 
        backgroundColor: '#ffebee', 
        borderRadius: 10,
        border: '1px solid #ffcdd2',
      }}>
        <div style={{ color: '#c62828', marginBottom: 12 }}>
          <strong>Fehler:</strong> {error}
        </div>
        <button 
          onClick={analyze}
          style={{
            padding: '8px 16px',
            backgroundColor: '#c62828',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  // Success state - show explanation
  if (!explanation) return null;

  return (
    <div style={{
      padding: 20,
      backgroundColor: '#fafafa',
      borderRadius: 12,
      border: '1px solid #e0e0e0',
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>{getCauseIcon(explanation.likelyCause)}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              {getCauseLabel(explanation.likelyCause)}
            </div>
            <div style={{ 
              fontSize: 12, 
              color: getConfidenceColor(explanation.confidence),
              marginTop: 2,
            }}>
              {Math.round(explanation.confidence * 100)}% Konfidenz
            </div>
          </div>
        </div>
        <button
          onClick={analyze}
          style={{
            padding: '6px 12px',
            backgroundColor: 'transparent',
            border: '1px solid #ddd',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 12,
            color: '#666',
          }}
          title="Erneut analysieren"
        >
          ↻ Neu
        </button>
      </div>

      {/* Explanation */}
      <div style={{ 
        marginBottom: 16,
        padding: 14,
        backgroundColor: 'white',
        borderRadius: 8,
        fontSize: 14,
        lineHeight: 1.6,
        color: '#333',
        whiteSpace: 'pre-wrap',
      }}>
        {explanation.explanation}
      </div>

      {/* Suggested Action */}
      <div style={{
        padding: 14,
        backgroundColor: '#e3f2fd',
        borderRadius: 8,
        marginBottom: 16,
        border: '1px solid #bbdefb',
      }}>
        <div style={{ fontSize: 12, color: '#1565c0', marginBottom: 4 }}>
          Empfohlene Maßnahme:
        </div>
        <div style={{ fontSize: 14, color: '#0d47a1', fontWeight: 500 }}>
          {explanation.suggestedAction}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {explanation.correctionEntry && onApplyCorrection && (
          <button
            onClick={handleApplyCorrection}
            style={{
              padding: '10px 18px',
              backgroundColor: '#2e7d32',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>✓</span>
            <span>Korrekturbuchung erstellen</span>
          </button>
        )}
        
        {onAccept && (
          <button
            onClick={handleAccept}
            style={{
              padding: '10px 18px',
              backgroundColor: '#f5f5f5',
              color: '#333',
              border: '1px solid #ddd',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>📋</span>
            <span>Als erklärt akzeptieren</span>
          </button>
        )}
      </div>

      {/* Correction Entry Preview */}
      {explanation.correctionEntry && (
        <div style={{
          marginTop: 16,
          padding: 12,
          backgroundColor: '#fff8e1',
          borderRadius: 8,
          border: '1px solid #ffecb3',
          fontSize: 13,
        }}>
          <div style={{ fontWeight: 500, marginBottom: 8, color: '#f57c00' }}>
            Buchungsvorschlag:
          </div>
          <div style={{ display: 'grid', gap: 4, color: '#333' }}>
            <div><strong>Soll:</strong> {explanation.correctionEntry.debitAccount}</div>
            <div><strong>Haben:</strong> {explanation.correctionEntry.creditAccount}</div>
            <div><strong>Betrag:</strong> €{explanation.correctionEntry.amount.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</div>
            <div><strong>Text:</strong> {explanation.correctionEntry.description}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ICExplanationCard;
