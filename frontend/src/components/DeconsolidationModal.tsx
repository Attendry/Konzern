import { useState, useEffect } from 'react';
import { Company, FinancialStatement, Participation } from '../types';
import { companyService } from '../services/companyService';
import { financialStatementService } from '../services/financialStatementService';
import { 
  firstConsolidationService, 
  DeconsolidationInput,
  DeconsolidationResult,
} from '../services/firstConsolidationService';
import { Modal } from './Modal';
import { useToastContext } from '../contexts/ToastContext';
import '../App.css';

interface DeconsolidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (result: DeconsolidationResult) => void;
  participation?: Participation | null;
  subsidiary?: Company | null;
}

export function DeconsolidationModal({
  isOpen,
  onClose,
  onComplete,
  participation,
  subsidiary,
}: DeconsolidationModalProps) {
  const { success, error: showError } = useToastContext();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DeconsolidationResult | null>(null);
  const [statements, setStatements] = useState<FinancialStatement[]>([]);

  const [formData, setFormData] = useState<DeconsolidationInput>({
    participationId: '',
    disposalDate: new Date().toISOString().split('T')[0],
    disposalProceeds: 0,
    financialStatementId: '',
  });

  useEffect(() => {
    if (isOpen && participation) {
      setFormData(prev => ({ ...prev, participationId: participation.id }));
      loadStatements();
    }
  }, [isOpen, participation]);

  const loadStatements = async () => {
    try {
      const data = await financialStatementService.getAll();
      setStatements(data);
    } catch (error) {
      console.error('Error loading statements:', error);
    }
  };

  const handleSubmit = async () => {
    if (!formData.participationId || !formData.financialStatementId) {
      showError('Bitte alle Pflichtfelder ausfüllen.');
      return;
    }

    setLoading(true);
    try {
      const result = await firstConsolidationService.performDeconsolidation(formData);
      setResult(result);
      success('Entkonsolidierung erfolgreich durchgeführt!');
      onComplete?.(result);
    } catch (error: any) {
      showError(`Fehler: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setFormData({
      participationId: '',
      disposalDate: new Date().toISOString().split('T')[0],
      disposalProceeds: 0,
      financialStatementId: '',
    });
    onClose();
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Entkonsolidierung: ${subsidiary?.name || 'Tochterunternehmen'}`}
      size="md"
    >
      {!result ? (
        <div className="deconsolidation-form">
          <div style={{ 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid var(--color-error)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-4)',
            marginBottom: 'var(--spacing-4)',
          }}>
            <p style={{ color: 'var(--color-error)', fontWeight: 'var(--font-weight-medium)', margin: 0 }}>
              ⚠️ Achtung: Die Entkonsolidierung entfernt das Tochterunternehmen dauerhaft aus dem Konsolidierungskreis. 
              Dieser Vorgang kann nicht rückgängig gemacht werden.
            </p>
          </div>

          {participation && (
            <div style={{ 
              background: 'var(--color-bg-tertiary)', 
              padding: 'var(--spacing-4)', 
              borderRadius: 'var(--radius-lg)',
              marginBottom: 'var(--spacing-4)',
            }}>
              <h4 style={{ marginBottom: 'var(--spacing-3)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                AKTUELLE BETEILIGUNGSDATEN
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)' }}>
                <div>Beteiligungsquote:</div>
                <div style={{ textAlign: 'right' }}>{participation.participationPercentage}%</div>
                <div>Anschaffungskosten:</div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--font-family-mono)' }}>{formatCurrency(participation.acquisitionCost || 0)}</div>
                {participation.goodwill > 0 && (
                  <>
                    <div>Goodwill:</div>
                    <div style={{ textAlign: 'right', fontFamily: 'var(--font-family-mono)' }}>{formatCurrency(participation.goodwill)}</div>
                  </>
                )}
                <div>Erwerbsdatum:</div>
                <div style={{ textAlign: 'right' }}>{new Date(participation.acquisitionDate).toLocaleDateString('de-DE')}</div>
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="disposalDate">Veräußerungsdatum *</label>
            <input
              type="date"
              id="disposalDate"
              value={formData.disposalDate}
              onChange={(e) => setFormData({ ...formData, disposalDate: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="disposalProceeds">Veräußerungserlös (EUR) *</label>
            <input
              type="number"
              id="disposalProceeds"
              value={formData.disposalProceeds}
              onChange={(e) => setFormData({ ...formData, disposalProceeds: parseFloat(e.target.value) || 0 })}
              min="0"
              step="0.01"
            />
          </div>

          <div className="form-group">
            <label htmlFor="financialStatement">Jahresabschluss für Buchungen *</label>
            <select
              id="financialStatement"
              value={formData.financialStatementId}
              onChange={(e) => setFormData({ ...formData, financialStatementId: e.target.value })}
            >
              <option value="">-- Auswählen --</option>
              {statements.map(s => (
                <option key={s.id} value={s.id}>
                  {s.company?.name || 'Unbekannt'} - {s.fiscalYear}
                </option>
              ))}
            </select>
          </div>

          <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            gap: 'var(--spacing-3)', 
            marginTop: 'var(--spacing-6)',
          }}>
            <button className="button button-secondary" onClick={handleClose}>
              Abbrechen
            </button>
            <button 
              className="button" 
              style={{ background: 'var(--color-error)', color: 'white' }}
              onClick={handleSubmit}
              disabled={loading || !formData.financialStatementId}
            >
              {loading ? 'Verarbeite...' : 'Entkonsolidierung durchführen'}
            </button>
          </div>
        </div>
      ) : (
        <div className="deconsolidation-result">
          <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-6)' }}>
            <div style={{ 
              width: '64px', 
              height: '64px', 
              borderRadius: '50%', 
              background: 'var(--color-success)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto var(--spacing-4)',
              fontSize: '2rem',
            }}>
              ✓
            </div>
            <h3>Entkonsolidierung abgeschlossen!</h3>
          </div>

          <div style={{ 
            background: 'var(--color-bg-tertiary)', 
            padding: 'var(--spacing-4)', 
            borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--spacing-4)',
          }}>
            <h4 style={{ marginBottom: 'var(--spacing-3)' }}>Zusammenfassung</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)' }}>
              <div>Buchwert:</div>
              <div style={{ textAlign: 'right', fontFamily: 'var(--font-family-mono)' }}>{formatCurrency(result.summary.bookValue)}</div>
              <div>Veräußerungserlös:</div>
              <div style={{ textAlign: 'right', fontFamily: 'var(--font-family-mono)' }}>{formatCurrency(result.summary.disposalProceeds)}</div>
              <div>Aufgelöste Minderheitenanteile:</div>
              <div style={{ textAlign: 'right', fontFamily: 'var(--font-family-mono)' }}>{formatCurrency(result.summary.minorityInterestReleased)}</div>
              {result.summary.cumulativeTranslationDifference !== 0 && (
                <>
                  <div>Währungsdifferenzen:</div>
                  <div style={{ textAlign: 'right', fontFamily: 'var(--font-family-mono)' }}>{formatCurrency(result.summary.cumulativeTranslationDifference)}</div>
                </>
              )}
              <div style={{ fontWeight: 'var(--font-weight-bold)', paddingTop: 'var(--spacing-2)', borderTop: '1px solid var(--color-border)' }}>
                {result.disposalGainLoss >= 0 ? 'Entkonsolidierungsgewinn:' : 'Entkonsolidierungsverlust:'}
              </div>
              <div style={{ 
                textAlign: 'right', 
                fontFamily: 'var(--font-family-mono)', 
                fontWeight: 'var(--font-weight-bold)',
                paddingTop: 'var(--spacing-2)',
                borderTop: '1px solid var(--color-border)',
                color: result.disposalGainLoss >= 0 ? 'var(--color-success)' : 'var(--color-error)',
              }}>
                {formatCurrency(Math.abs(result.disposalGainLoss))}
              </div>
            </div>
          </div>

          <div style={{ 
            background: 'var(--color-bg-tertiary)', 
            padding: 'var(--spacing-4)', 
            borderRadius: 'var(--radius-lg)',
          }}>
            <h4 style={{ marginBottom: 'var(--spacing-3)' }}>Erstellte Buchungen</h4>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              {result.consolidationEntries.length} Buchungen wurden erstellt.
            </p>
          </div>

          <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            marginTop: 'var(--spacing-6)',
          }}>
            <button className="button button-primary" onClick={handleClose}>
              Schließen
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
