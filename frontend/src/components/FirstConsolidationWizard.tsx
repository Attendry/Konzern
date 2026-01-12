import { useState, useEffect } from 'react';
import { Company, FinancialStatement } from '../types';
import { companyService } from '../services/companyService';
import { financialStatementService } from '../services/financialStatementService';
import { 
  firstConsolidationService, 
  FirstConsolidationInput,
  FirstConsolidationResult,
} from '../services/firstConsolidationService';
import { Modal } from './Modal';
import { useToastContext } from '../contexts/ToastContext';
import '../App.css';

interface FirstConsolidationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (result: FirstConsolidationResult) => void;
  preselectedSubsidiary?: Company | null;
}

type WizardStep = 1 | 2 | 3 | 4;

export function FirstConsolidationWizard({
  isOpen,
  onClose,
  onComplete,
  preselectedSubsidiary,
}: FirstConsolidationWizardProps) {
  const { success, error: showError } = useToastContext();
  const [step, setStep] = useState<WizardStep>(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FirstConsolidationResult | null>(null);

  // Data
  const [companies, setCompanies] = useState<Company[]>([]);
  const [statements, setStatements] = useState<FinancialStatement[]>([]);

  // Form data
  const [formData, setFormData] = useState<FirstConsolidationInput>({
    parentCompanyId: '',
    subsidiaryCompanyId: '',
    acquisitionDate: new Date().toISOString().split('T')[0],
    participationPercentage: 100,
    acquisitionCost: 0,
    subscribedCapital: 0,
    capitalReserves: 0,
    revenueReserves: 0,
    retainedEarnings: 0,
    hiddenReserves: 0,
    hiddenLiabilities: 0,
    financialStatementId: '',
  });

  // Calculated values (for preview)
  const [preview, setPreview] = useState({
    equityAtAcquisition: 0,
    adjustedEquity: 0,
    parentShare: 0,
    minorityShare: 0,
    goodwill: 0,
    negativeGoodwill: 0,
  });

  useEffect(() => {
    if (isOpen) {
      loadData();
      if (preselectedSubsidiary) {
        setFormData(prev => ({ ...prev, subsidiaryCompanyId: preselectedSubsidiary.id }));
      }
    }
  }, [isOpen, preselectedSubsidiary]);

  // Calculate preview when form data changes
  useEffect(() => {
    const equity = formData.subscribedCapital + formData.capitalReserves + 
                   formData.revenueReserves + formData.retainedEarnings;
    const adjusted = equity + (formData.hiddenReserves || 0) - (formData.hiddenLiabilities || 0);
    const parentShare = adjusted * (formData.participationPercentage / 100);
    const minorityShare = adjusted * ((100 - formData.participationPercentage) / 100);
    const difference = formData.acquisitionCost - parentShare;

    setPreview({
      equityAtAcquisition: equity,
      adjustedEquity: adjusted,
      parentShare,
      minorityShare,
      goodwill: difference > 0 ? difference : 0,
      negativeGoodwill: difference < 0 ? Math.abs(difference) : 0,
    });
  }, [formData]);

  const loadData = async () => {
    try {
      const [companiesData, statementsData] = await Promise.all([
        companyService.getAll(),
        financialStatementService.getAll(),
      ]);
      setCompanies(companiesData);
      setStatements(statementsData);

      // Auto-select parent company (ultimate parent)
      const parent = companiesData.find(c => c.isUltimateParent || !c.parentCompanyId);
      if (parent) {
        setFormData(prev => ({ ...prev, parentCompanyId: parent.id }));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const result = await firstConsolidationService.performFirstConsolidation(formData);
      setResult(result);
      setStep(4);
      success('Erstkonsolidierung erfolgreich durchgeführt!');
      onComplete?.(result);
    } catch (error: any) {
      showError(`Fehler: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setResult(null);
    setFormData({
      parentCompanyId: '',
      subsidiaryCompanyId: '',
      acquisitionDate: new Date().toISOString().split('T')[0],
      participationPercentage: 100,
      acquisitionCost: 0,
      subscribedCapital: 0,
      capitalReserves: 0,
      revenueReserves: 0,
      retainedEarnings: 0,
      hiddenReserves: 0,
      hiddenLiabilities: 0,
      financialStatementId: '',
    });
    onClose();
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.parentCompanyId && formData.subsidiaryCompanyId && 
               formData.parentCompanyId !== formData.subsidiaryCompanyId;
      case 2:
        return formData.acquisitionDate && formData.participationPercentage > 0 && 
               formData.acquisitionCost > 0;
      case 3:
        return formData.financialStatementId && 
               (formData.subscribedCapital > 0 || formData.capitalReserves > 0);
      default:
        return false;
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Erstkonsolidierung (§ 301 HGB)"
      size="lg"
    >
      <div className="wizard">
        {/* Progress Steps */}
        <div className="wizard-steps" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginBottom: 'var(--spacing-6)',
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: 'var(--spacing-4)',
        }}>
          {[1, 2, 3, 4].map((s) => (
            <div 
              key={s} 
              className={`wizard-step ${step === s ? 'active' : ''} ${step > s ? 'completed' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-2)',
                color: step >= s ? 'var(--color-accent-blue)' : 'var(--color-text-tertiary)',
              }}
            >
              <span style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: step >= s ? 'var(--color-accent-blue)' : 'var(--color-bg-tertiary)',
                color: step >= s ? 'white' : 'var(--color-text-tertiary)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)',
              }}>
                {step > s ? '✓' : s}
              </span>
              <span style={{ fontSize: 'var(--font-size-sm)' }}>
                {s === 1 && 'Unternehmen'}
                {s === 2 && 'Erwerb'}
                {s === 3 && 'Eigenkapital'}
                {s === 4 && 'Ergebnis'}
              </span>
            </div>
          ))}
        </div>

        {/* Step 1: Select Companies */}
        {step === 1 && (
          <div className="wizard-content">
            <h3 style={{ marginBottom: 'var(--spacing-4)' }}>Schritt 1: Unternehmen auswählen</h3>
            
            <div className="form-group">
              <label htmlFor="parentCompany">Mutterunternehmen *</label>
              <select
                id="parentCompany"
                value={formData.parentCompanyId}
                onChange={(e) => setFormData({ ...formData, parentCompanyId: e.target.value })}
              >
                <option value="">-- Auswählen --</option>
                {companies.filter(c => !c.parentCompanyId || c.isUltimateParent).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="subsidiaryCompany">Tochterunternehmen *</label>
              <select
                id="subsidiaryCompany"
                value={formData.subsidiaryCompanyId}
                onChange={(e) => setFormData({ ...formData, subsidiaryCompanyId: e.target.value })}
              >
                <option value="">-- Auswählen --</option>
                {companies.filter(c => c.id !== formData.parentCompanyId).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Step 2: Acquisition Details */}
        {step === 2 && (
          <div className="wizard-content">
            <h3 style={{ marginBottom: 'var(--spacing-4)' }}>Schritt 2: Erwerbsdetails</h3>
            
            <div style={{ display: 'flex', gap: 'var(--spacing-4)' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label htmlFor="acquisitionDate">Erwerbsdatum *</label>
                <input
                  type="date"
                  id="acquisitionDate"
                  value={formData.acquisitionDate}
                  onChange={(e) => setFormData({ ...formData, acquisitionDate: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label htmlFor="participationPercentage">Beteiligungsquote (%) *</label>
                <input
                  type="number"
                  id="participationPercentage"
                  value={formData.participationPercentage}
                  onChange={(e) => setFormData({ ...formData, participationPercentage: parseFloat(e.target.value) })}
                  min="0.01"
                  max="100"
                  step="0.01"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="acquisitionCost">Anschaffungskosten (EUR) *</label>
              <input
                type="number"
                id="acquisitionCost"
                value={formData.acquisitionCost}
                onChange={(e) => setFormData({ ...formData, acquisitionCost: parseFloat(e.target.value) })}
                min="0"
                step="0.01"
              />
              <small style={{ color: 'var(--color-text-secondary)' }}>
                Kaufpreis für die Beteiligung
              </small>
            </div>
          </div>
        )}

        {/* Step 3: Equity at Acquisition */}
        {step === 3 && (
          <div className="wizard-content">
            <h3 style={{ marginBottom: 'var(--spacing-4)' }}>Schritt 3: Eigenkapital zum Erwerbszeitpunkt</h3>
            
            <div className="form-group">
              <label htmlFor="financialStatement">Jahresabschluss *</label>
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
              background: 'var(--color-bg-tertiary)', 
              padding: 'var(--spacing-4)', 
              borderRadius: 'var(--radius-lg)',
              marginBottom: 'var(--spacing-4)',
            }}>
              <h4 style={{ marginBottom: 'var(--spacing-3)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                EIGENKAPITAL-KOMPONENTEN
              </h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="subscribedCapital">Gezeichnetes Kapital</label>
                  <input
                    type="number"
                    id="subscribedCapital"
                    value={formData.subscribedCapital}
                    onChange={(e) => setFormData({ ...formData, subscribedCapital: parseFloat(e.target.value) || 0 })}
                    step="0.01"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="capitalReserves">Kapitalrücklage</label>
                  <input
                    type="number"
                    id="capitalReserves"
                    value={formData.capitalReserves}
                    onChange={(e) => setFormData({ ...formData, capitalReserves: parseFloat(e.target.value) || 0 })}
                    step="0.01"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="revenueReserves">Gewinnrücklagen</label>
                  <input
                    type="number"
                    id="revenueReserves"
                    value={formData.revenueReserves}
                    onChange={(e) => setFormData({ ...formData, revenueReserves: parseFloat(e.target.value) || 0 })}
                    step="0.01"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="retainedEarnings">Gewinn-/Verlustvortrag</label>
                  <input
                    type="number"
                    id="retainedEarnings"
                    value={formData.retainedEarnings}
                    onChange={(e) => setFormData({ ...formData, retainedEarnings: parseFloat(e.target.value) || 0 })}
                    step="0.01"
                  />
                </div>
              </div>
            </div>

            <div style={{ 
              background: 'var(--color-bg-tertiary)', 
              padding: 'var(--spacing-4)', 
              borderRadius: 'var(--radius-lg)',
            }}>
              <h4 style={{ marginBottom: 'var(--spacing-3)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                STILLE RESERVEN / LASTEN (optional)
              </h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="hiddenReserves">Stille Reserven</label>
                  <input
                    type="number"
                    id="hiddenReserves"
                    value={formData.hiddenReserves || 0}
                    onChange={(e) => setFormData({ ...formData, hiddenReserves: parseFloat(e.target.value) || 0 })}
                    step="0.01"
                    min="0"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="hiddenLiabilities">Stille Lasten</label>
                  <input
                    type="number"
                    id="hiddenLiabilities"
                    value={formData.hiddenLiabilities || 0}
                    onChange={(e) => setFormData({ ...formData, hiddenLiabilities: parseFloat(e.target.value) || 0 })}
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div style={{ 
              marginTop: 'var(--spacing-4)',
              padding: 'var(--spacing-4)', 
              background: 'rgba(11, 140, 238, 0.1)', 
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-accent-blue)',
            }}>
              <h4 style={{ marginBottom: 'var(--spacing-3)', color: 'var(--color-accent-blue)' }}>
                Vorschau Erstkonsolidierung
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)' }}>
                <div>Eigenkapital zum Erwerb:</div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--font-family-mono)' }}>{formatCurrency(preview.equityAtAcquisition)}</div>
                <div>+ Stille Reserven / - Lasten:</div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--font-family-mono)' }}>{formatCurrency((formData.hiddenReserves || 0) - (formData.hiddenLiabilities || 0))}</div>
                <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>= Bereinigtes Eigenkapital:</div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--font-family-mono)', fontWeight: 'var(--font-weight-semibold)' }}>{formatCurrency(preview.adjustedEquity)}</div>
                <div>Anteil Mutterunternehmen ({formData.participationPercentage}%):</div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--font-family-mono)' }}>{formatCurrency(preview.parentShare)}</div>
                <div>Anschaffungskosten:</div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--font-family-mono)' }}>{formatCurrency(formData.acquisitionCost)}</div>
                <div style={{ fontWeight: 'var(--font-weight-bold)', color: preview.goodwill > 0 ? 'var(--color-accent-blue)' : 'var(--color-success)' }}>
                  {preview.goodwill > 0 ? 'Geschäfts- oder Firmenwert:' : 'Negativer Unterschiedsbetrag:'}
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--font-family-mono)', fontWeight: 'var(--font-weight-bold)', color: preview.goodwill > 0 ? 'var(--color-accent-blue)' : 'var(--color-success)' }}>
                  {formatCurrency(preview.goodwill || preview.negativeGoodwill)}
                </div>
                {preview.minorityShare > 0 && (
                  <>
                    <div>Minderheitenanteile ({100 - formData.participationPercentage}%):</div>
                    <div style={{ textAlign: 'right', fontFamily: 'var(--font-family-mono)' }}>{formatCurrency(preview.minorityShare)}</div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Result */}
        {step === 4 && result && (
          <div className="wizard-content">
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
              <h3>Erstkonsolidierung abgeschlossen!</h3>
            </div>

            <div style={{ 
              background: 'var(--color-bg-tertiary)', 
              padding: 'var(--spacing-4)', 
              borderRadius: 'var(--radius-lg)',
              marginBottom: 'var(--spacing-4)',
            }}>
              <h4 style={{ marginBottom: 'var(--spacing-3)' }}>Zusammenfassung</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-2)', fontSize: 'var(--font-size-sm)' }}>
                <div>Eigenkapital zum Erwerb:</div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--font-family-mono)' }}>{formatCurrency(result.summary.equityAtAcquisition)}</div>
                <div>Anteil Mutterunternehmen:</div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--font-family-mono)' }}>{formatCurrency(result.summary.parentShare)}</div>
                <div>Minderheitenanteile:</div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--font-family-mono)' }}>{formatCurrency(result.summary.minorityShare)}</div>
                {result.goodwill > 0 && (
                  <>
                    <div style={{ fontWeight: 'var(--font-weight-bold)' }}>Goodwill:</div>
                    <div style={{ textAlign: 'right', fontFamily: 'var(--font-family-mono)', fontWeight: 'var(--font-weight-bold)' }}>{formatCurrency(result.goodwill)}</div>
                  </>
                )}
                {result.negativeGoodwill > 0 && (
                  <>
                    <div style={{ fontWeight: 'var(--font-weight-bold)' }}>Negativer Goodwill:</div>
                    <div style={{ textAlign: 'right', fontFamily: 'var(--font-family-mono)', fontWeight: 'var(--font-weight-bold)' }}>{formatCurrency(result.negativeGoodwill)}</div>
                  </>
                )}
              </div>
            </div>

            <div style={{ 
              background: 'var(--color-bg-tertiary)', 
              padding: 'var(--spacing-4)', 
              borderRadius: 'var(--radius-lg)',
            }}>
              <h4 style={{ marginBottom: 'var(--spacing-3)' }}>Erstellte Konsolidierungsbuchungen</h4>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                {result.consolidationEntries.length} Buchungen wurden als Entwurf erstellt. 
                Bitte prüfen und freigeben Sie diese in der Konsolidierungsübersicht.
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginTop: 'var(--spacing-6)',
          paddingTop: 'var(--spacing-4)',
          borderTop: '1px solid var(--color-border)',
        }}>
          {step > 1 && step < 4 ? (
            <button
              className="button button-secondary"
              onClick={() => setStep((step - 1) as WizardStep)}
            >
              ← Zurück
            </button>
          ) : (
            <div />
          )}

          {step < 3 && (
            <button
              className="button button-primary"
              onClick={() => setStep((step + 1) as WizardStep)}
              disabled={!canProceed()}
            >
              Weiter →
            </button>
          )}

          {step === 3 && (
            <button
              className="button button-primary"
              onClick={handleSubmit}
              disabled={!canProceed() || loading}
            >
              {loading ? 'Verarbeite...' : 'Erstkonsolidierung durchführen'}
            </button>
          )}

          {step === 4 && (
            <button
              className="button button-primary"
              onClick={handleClose}
            >
              Schließen
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
