import { useEffect, useState } from 'react';
import { consolidationObligationService, ConsolidationObligationResult, ManualDecision } from '../services/consolidationObligationService';
import '../App.css';

interface ConsolidationObligationCheckProps {
  companyId: string;
  companyName?: string;
  onCheckComplete?: (result: ConsolidationObligationResult) => void;
}

const REASON_LABELS: { [key: string]: string } = {
  majority_interest: 'Mehrheitsbeteiligung (>50%)',
  unified_management: 'Einheitliche Leitung',
  control_agreement: 'Beherrschungsvertrag',
  none: 'Keine Konsolidierungspflicht',
};

const EXCEPTION_LABELS: { [key: string]: string } = {
  materiality: 'Bedeutungslosigkeit (HGB § 296)',
  temporary_control: 'Vorübergehende Beherrschung',
  severe_restrictions: 'Schwerwiegende Beschränkungen',
  different_activities: 'Wesentlich abweichende Tätigkeiten',
};

function ConsolidationObligationCheck({
  companyId,
  onCheckComplete,
}: ConsolidationObligationCheckProps) {
  const [result, setResult] = useState<ConsolidationObligationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManualDecision, setShowManualDecision] = useState(false);
  const [manualDecision, setManualDecision] = useState<ManualDecision>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (companyId) {
      loadCheck();
    }
  }, [companyId]);

  const loadCheck = async () => {
    try {
      setLoading(true);
      setError(null);
      const checkResult = await consolidationObligationService.checkObligation(companyId);
      setResult(checkResult);
      if (onCheckComplete) {
        onCheckComplete(checkResult);
      }
    } catch (err: any) {
      console.error('Error checking consolidation obligation:', err);
      setError(err.response?.data?.message || err.message || 'Fehler beim Prüfen der Konsolidierungspflicht');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveManualDecision = async () => {
    try {
      setSaving(true);
      await consolidationObligationService.updateManualDecision(companyId, manualDecision);
      await loadCheck(); // Reload to get updated result
      setShowManualDecision(false);
    } catch (err: any) {
      console.error('Error saving manual decision:', err);
      setError(err.response?.data?.message || err.message || 'Fehler beim Speichern der manuellen Entscheidung');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="loading">
          <div className="loading-spinner"></div>
          <span>Prüfe Konsolidierungspflicht...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="error-message">
          <strong>Fehler:</strong> {error}
        </div>
        <button onClick={loadCheck} className="button button-primary" style={{ marginTop: 'var(--spacing-4)' }}>
          Erneut prüfen
        </button>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-title">Keine Prüfungsergebnisse verfügbar</div>
        </div>
        <button onClick={loadCheck} className="button button-primary" style={{ marginTop: 'var(--spacing-4)' }}>
          Prüfung starten
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Konsolidierungspflicht-Prüfung</h2>
        <button onClick={loadCheck} className="button button-secondary button-sm">
          Erneut prüfen
        </button>
      </div>

      {/* Status */}
      <div
        className={result.isObligatory
          ? result.exceptions.length > 0
            ? 'error-message'
            : 'error-message'
          : 'success-message'}
        style={{
          marginBottom: 'var(--spacing-4)',
          backgroundColor: result.isObligatory
            ? result.exceptions.length > 0
              ? 'rgba(247, 201, 72, 0.1)'
              : 'rgba(225, 98, 89, 0.1)'
            : 'rgba(15, 123, 15, 0.1)',
          border: `2px solid ${
            result.isObligatory
              ? result.exceptions.length > 0
                ? 'var(--color-warning)'
                : 'var(--color-error)'
              : 'var(--color-success)'
          }`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <strong style={{ fontSize: '1.2rem' }}>
            {result.isObligatory
              ? result.exceptions.length > 0
                ? '⚠️ Konsolidierungspflicht mit Ausnahmen'
                : '❌ Konsolidierungspflicht besteht'
              : 'Keine Konsolidierungspflicht'}
          </strong>
        </div>
        {result.reason && (
          <div style={{ marginTop: '0.5rem' }}>
            <strong>Grund:</strong> {REASON_LABELS[result.reason] || result.reason}
          </div>
        )}
      </div>

      {/* Details */}
      <div style={{ marginBottom: '1rem' }}>
        <h3>Details</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          {result.participationPercentage !== null && (
            <div>
              <strong>Beteiligungsquote:</strong> {result.participationPercentage.toFixed(2)}%
            </div>
          )}
          {result.hasUnifiedManagement !== null && (
            <div>
              <strong>Einheitliche Leitung:</strong>{' '}
              {result.hasUnifiedManagement ? 'Ja' : 'Nein'}
            </div>
          )}
          {result.hasControlAgreement !== null && (
            <div>
              <strong>Beherrschungsvertrag:</strong>{' '}
              {result.hasControlAgreement ? 'Ja' : 'Nein'}
            </div>
          )}
        </div>
      </div>

      {/* Exceptions */}
      {result.exceptions.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--spacing-4)', backgroundColor: 'rgba(247, 201, 72, 0.1)', border: '1px solid var(--color-warning)' }}>
          <h3 style={{ marginBottom: 'var(--spacing-3)' }}>Ausnahmen (HGB § 296)</h3>
          <ul style={{ paddingLeft: 'var(--spacing-5)' }}>
            {result.exceptions.map((exception, index) => (
              <li key={index} style={{ marginBottom: 'var(--spacing-2)' }}>{EXCEPTION_LABELS[exception] || exception}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="error-message" style={{ marginBottom: 'var(--spacing-4)' }}>
          <h3 style={{ marginBottom: 'var(--spacing-3)' }}>⚠️ Warnungen</h3>
          <ul style={{ paddingLeft: 'var(--spacing-5)' }}>
            {result.warnings.map((warning, index) => (
              <li key={index} style={{ marginBottom: 'var(--spacing-2)' }}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {result.recommendations.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--spacing-4)', backgroundColor: 'rgba(11, 140, 238, 0.1)', border: '1px solid var(--color-info)' }}>
          <h3 style={{ marginBottom: 'var(--spacing-3)', color: 'var(--color-info)' }}>Empfehlungen</h3>
          <ul style={{ paddingLeft: 'var(--spacing-5)' }}>
            {result.recommendations.map((recommendation, index) => (
              <li key={index} style={{ marginBottom: 'var(--spacing-2)' }}>{recommendation}</li>
            ))}
          </ul>
        </div>
      )}

      {/* HGB References */}
      {result.hgbReferences.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--spacing-4)', backgroundColor: 'var(--color-bg-tertiary)' }}>
          <h3 style={{ marginBottom: 'var(--spacing-3)' }}>HGB-Referenzen</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-2)' }}>
            {result.hgbReferences.map((ref, index) => (
              <span key={index} className="badge badge-info">
                {ref}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Manual Decision */}
      <div style={{ marginTop: 'var(--spacing-4)', paddingTop: 'var(--spacing-4)', borderTop: '1px solid var(--color-border)' }}>
        {!showManualDecision ? (
          <button
            onClick={() => setShowManualDecision(true)}
            className="button button-secondary"
          >
            Manuelle Entscheidung eingeben
          </button>
        ) : (
          <div className="card" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
            <h3 style={{ marginBottom: 'var(--spacing-4)' }}>Manuelle Entscheidung</h3>
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={manualDecision.hasUnifiedManagement || false}
                  onChange={(e) =>
                    setManualDecision({
                      ...manualDecision,
                      hasUnifiedManagement: e.target.checked,
                    })
                  }
                />
                Einheitliche Leitung
              </label>
            </div>
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={manualDecision.hasControlAgreement || false}
                  onChange={(e) =>
                    setManualDecision({
                      ...manualDecision,
                      hasControlAgreement: e.target.checked,
                    })
                  }
                />
                Beherrschungsvertrag
              </label>
            </div>
            <div className="form-group">
              <label>
                <strong>Kommentar:</strong>
              </label>
              <textarea
                value={manualDecision.comment || ''}
                onChange={(e) =>
                  setManualDecision({
                    ...manualDecision,
                    comment: e.target.value,
                  })
                }
                placeholder="Begründung der manuellen Entscheidung..."
              />
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
              <button
                onClick={handleSaveManualDecision}
                disabled={saving}
                className="button button-primary"
              >
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
              <button
                onClick={() => {
                  setShowManualDecision(false);
                  setManualDecision({});
                }}
                className="button button-secondary"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ConsolidationObligationCheck;
