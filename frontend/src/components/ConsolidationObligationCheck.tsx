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
  companyName,
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
        <p>Prüfe Konsolidierungspflicht...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ backgroundColor: '#fee', border: '1px solid #fcc' }}>
        <p style={{ color: '#c33' }}>Fehler: {error}</p>
        <button onClick={loadCheck} style={{ marginTop: '1rem' }}>
          Erneut prüfen
        </button>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="card">
        <p>Keine Prüfungsergebnisse verfügbar.</p>
        <button onClick={loadCheck} style={{ marginTop: '1rem' }}>
          Prüfung starten
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Konsolidierungspflicht-Prüfung</h2>
        <button onClick={loadCheck} style={{ padding: '0.5rem 1rem' }}>
          Erneut prüfen
        </button>
      </div>

      {/* Status */}
      <div
        style={{
          padding: '1rem',
          borderRadius: '4px',
          marginBottom: '1rem',
          backgroundColor: result.isObligatory
            ? result.exceptions.length > 0
              ? '#fff3cd'
              : '#f8d7da'
            : '#d4edda',
          border: `2px solid ${
            result.isObligatory
              ? result.exceptions.length > 0
                ? '#ffc107'
                : '#dc3545'
              : '#28a745'
          }`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <strong style={{ fontSize: '1.2rem' }}>
            {result.isObligatory
              ? result.exceptions.length > 0
                ? '⚠️ Konsolidierungspflicht mit Ausnahmen'
                : '❌ Konsolidierungspflicht besteht'
              : '✅ Keine Konsolidierungspflicht'}
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
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
          <h3>Ausnahmen (HGB § 296)</h3>
          <ul>
            {result.exceptions.map((exception, index) => (
              <li key={index}>{EXCEPTION_LABELS[exception] || exception}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8d7da', borderRadius: '4px' }}>
          <h3 style={{ color: '#721c24' }}>⚠️ Warnungen</h3>
          <ul>
            {result.warnings.map((warning, index) => (
              <li key={index} style={{ color: '#721c24' }}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {result.recommendations.length > 0 && (
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#d1ecf1', borderRadius: '4px' }}>
          <h3 style={{ color: '#0c5460' }}>💡 Empfehlungen</h3>
          <ul>
            {result.recommendations.map((recommendation, index) => (
              <li key={index} style={{ color: '#0c5460' }}>{recommendation}</li>
            ))}
          </ul>
        </div>
      )}

      {/* HGB References */}
      {result.hgbReferences.length > 0 && (
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <h3>HGB-Referenzen</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {result.hgbReferences.map((ref, index) => (
              <span
                key={index}
                style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: '#e9ecef',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              >
                {ref}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Manual Decision */}
      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #ddd' }}>
        {!showManualDecision ? (
          <button
            onClick={() => setShowManualDecision(true)}
            style={{ padding: '0.5rem 1rem' }}
          >
            Manuelle Entscheidung eingeben
          </button>
        ) : (
          <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
            <h3>Manuelle Entscheidung</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
              <label>
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
                {' '}Einheitliche Leitung
              </label>
              <label>
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
                {' '}Beherrschungsvertrag
              </label>
              <div>
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
                  style={{ width: '100%', minHeight: '100px', marginTop: '0.5rem' }}
                  placeholder="Begründung der manuellen Entscheidung..."
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleSaveManualDecision}
                disabled={saving}
                style={{ padding: '0.5rem 1rem', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}
              >
                {saving ? 'Speichern...' : 'Speichern'}
              </button>
              <button
                onClick={() => {
                  setShowManualDecision(false);
                  setManualDecision({});
                }}
                style={{ padding: '0.5rem 1rem' }}
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
