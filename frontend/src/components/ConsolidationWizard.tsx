import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToastContext } from '../contexts/ToastContext';
import { financialStatementService } from '../services/financialStatementService';
import { companyService } from '../services/companyService';
import { consolidationService } from '../services/consolidationService';
import { FinancialStatement, Company } from '../types';
import '../App.css';

interface ConsolidationWizardProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

interface StepStatus {
  companies: 'pending' | 'in_progress' | 'complete' | 'error';
  dataImport: 'pending' | 'in_progress' | 'complete' | 'error';
  participations: 'pending' | 'in_progress' | 'complete' | 'error';
  consolidation: 'pending' | 'in_progress' | 'complete' | 'error';
  review: 'pending' | 'in_progress' | 'complete' | 'error';
}

type WizardStep = 'companies' | 'dataImport' | 'participations' | 'consolidation' | 'review';

export function ConsolidationWizard({ onComplete, onCancel }: ConsolidationWizardProps) {
  const navigate = useNavigate();
  const { success, error: showError } = useToastContext();

  const [currentStep, setCurrentStep] = useState<WizardStep>('companies');
  const [stepStatus, setStepStatus] = useState<StepStatus>({
    companies: 'in_progress',
    dataImport: 'pending',
    participations: 'pending',
    consolidation: 'pending',
    review: 'pending',
  });

  const [companies, setCompanies] = useState<Company[]>([]);
  const [statements, setStatements] = useState<FinancialStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState(new Date().getFullYear());
  const [parentCompanyId, setParentCompanyId] = useState<string>('');
  const [selectedStatementId, setSelectedStatementId] = useState<string>('');
  const [consolidating, setConsolidating] = useState(false);
  const [consolidationResult, setConsolidationResult] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [companiesData, statementsData] = await Promise.all([
        companyService.getAll(),
        financialStatementService.getAll(),
      ]);
      setCompanies(companiesData);
      setStatements(statementsData);

      // Auto-select parent company if only one exists
      const parentCompanies = companiesData.filter((c: Company) => !c.parentCompanyId);
      if (parentCompanies.length === 1) {
        setParentCompanyId(parentCompanies[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCompanyDataStatus = (companyId: string) => {
    const statement = statements.find(
      s => s.companyId === companyId && s.fiscalYear === selectedFiscalYear
    );
    if (!statement) return { status: 'missing', label: 'Keine Daten' };
    return { status: 'complete', label: 'Daten vorhanden', statementId: statement.id };
  };

  const getConsolidationReadiness = () => {
    const parentCompany = companies.find(c => c.id === parentCompanyId);
    if (!parentCompany) return { ready: false, issues: ['Kein Mutterunternehmen ausgewählt'] };

    const subsidiaries = companies.filter(c => c.parentCompanyId === parentCompanyId);
    const issues: string[] = [];

    // Check parent has data
    const parentStatus = getCompanyDataStatus(parentCompanyId);
    if (parentStatus.status !== 'complete') {
      issues.push(`Mutterunternehmen "${parentCompany.name}" hat keine Bilanzdaten`);
    }

    // Check subsidiaries have data
    subsidiaries.forEach(sub => {
      const status = getCompanyDataStatus(sub.id);
      if (status.status !== 'complete') {
        issues.push(`Tochterunternehmen "${sub.name}" hat keine Bilanzdaten`);
      }
    });

    return { ready: issues.length === 0, issues };
  };

  const handleNextStep = () => {
    const steps: WizardStep[] = ['companies', 'dataImport', 'participations', 'consolidation', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    
    if (currentIndex < steps.length - 1) {
      // Mark current as complete
      setStepStatus(prev => ({
        ...prev,
        [currentStep]: 'complete',
        [steps[currentIndex + 1]]: 'in_progress',
      }));
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const handlePrevStep = () => {
    const steps: WizardStep[] = ['companies', 'dataImport', 'participations', 'consolidation', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    
    if (currentIndex > 0) {
      setStepStatus(prev => ({
        ...prev,
        [currentStep]: 'pending',
        [steps[currentIndex - 1]]: 'in_progress',
      }));
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handleRunConsolidation = async () => {
    if (!selectedStatementId) {
      showError('Bitte wählen Sie einen Jahresabschluss');
      return;
    }

    setConsolidating(true);
    try {
      const result = await consolidationService.calculate(selectedStatementId);
      setConsolidationResult(result);
      success(`Konsolidierung erfolgreich: ${result.summary.totalEntries} Buchungen erstellt`);
      handleNextStep();
    } catch (error: any) {
      showError(`Fehler: ${error.message}`);
    } finally {
      setConsolidating(false);
    }
  };

  const handleComplete = () => {
    if (onComplete) {
      onComplete();
    } else {
      navigate(`/konzernabschluss/${selectedStatementId}`);
    }
  };

  const parentCompany = companies.find(c => c.id === parentCompanyId);
  const subsidiaries = companies.filter(c => c.parentCompanyId === parentCompanyId);
  const readiness = getConsolidationReadiness();

  const steps = [
    { id: 'companies', label: 'Konzernstruktur', icon: '🏢' },
    { id: 'dataImport', label: 'Datenprüfung', icon: '📊' },
    { id: 'participations', label: 'Beteiligungen', icon: '🔗' },
    { id: 'consolidation', label: 'Konsolidierung', icon: '⚙️' },
    { id: 'review', label: 'Abschluss', icon: '✅' },
  ];

  return (
    <div className="consolidation-wizard">
      <div className="wizard-header">
        <h1>Konsolidierungsassistent</h1>
        <p>Schritt-für-Schritt zum Konzernabschluss</p>
      </div>

      {/* Progress Steps */}
      <div className="wizard-steps">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`wizard-step ${stepStatus[step.id as WizardStep]} ${currentStep === step.id ? 'active' : ''}`}
          >
            <div className="step-circle">
              {stepStatus[step.id as WizardStep] === 'complete' ? '✓' : step.icon}
            </div>
            <span className="step-label">{step.label}</span>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="wizard-content">
        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Lade Daten...</p>
          </div>
        )}

        {!loading && currentStep === 'companies' && (
          <>
            <h2>🏢 Konzernstruktur definieren</h2>
            <p className="step-description">
              Wählen Sie das Mutterunternehmen und überprüfen Sie die Konzernstruktur.
            </p>

            <div className="form-group">
              <label>Mutterunternehmen</label>
              <select
                value={parentCompanyId}
                onChange={(e) => setParentCompanyId(e.target.value)}
              >
                <option value="">-- Bitte wählen --</option>
                {companies.filter(c => !c.parentCompanyId).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Geschäftsjahr</label>
              <select
                value={selectedFiscalYear}
                onChange={(e) => setSelectedFiscalYear(parseInt(e.target.value))}
              >
                {[...Array(5)].map((_, i) => {
                  const year = new Date().getFullYear() - i;
                  return <option key={year} value={year}>{year}</option>;
                })}
              </select>
            </div>

            {parentCompanyId && (
              <div style={{ marginTop: 'var(--spacing-6)' }}>
                <h3>Konzernstruktur</h3>
                <div className="company-status-list">
                  <div className="company-status-item">
                    <span className="company-name">👑 {parentCompany?.name}</span>
                    <span className="badge badge-info">Mutterunternehmen</span>
                  </div>
                  {subsidiaries.length > 0 ? (
                    subsidiaries.map(sub => (
                      <div key={sub.id} className="company-status-item">
                        <span className="company-name">└ {sub.name}</span>
                        <span className="badge badge-neutral">
                          {sub.ownershipPercentage || 100}% Beteiligung
                        </span>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-4)' }}>
                      Keine Tochterunternehmen gefunden. 
                      <a href="/companies" style={{ marginLeft: 'var(--spacing-2)' }}>
                        Unternehmen verwalten →
                      </a>
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {!loading && currentStep === 'dataImport' && (
          <>
            <h2>📊 Datenprüfung</h2>
            <p className="step-description">
              Überprüfen Sie, ob alle Unternehmen Bilanzdaten für {selectedFiscalYear} haben.
            </p>

            <div className="company-status-list" style={{ marginTop: 'var(--spacing-6)' }}>
              {[parentCompany, ...subsidiaries].filter(Boolean).map(company => {
                if (!company) return null;
                const status = getCompanyDataStatus(company.id);
                return (
                  <div key={company.id} className="company-status-item">
                    <span className="company-name">
                      {company.id === parentCompanyId ? '👑 ' : '└ '}
                      {company.name}
                    </span>
                    <div className="company-status">
                      <span 
                        className={`status-dot ${status.status === 'complete' ? 'complete' : 'missing'}`}
                      ></span>
                      <span>{status.label}</span>
                      {status.status !== 'complete' && (
                        <button
                          className="button button-secondary button-sm"
                          onClick={() => navigate('/import')}
                          style={{ marginLeft: 'var(--spacing-2)' }}
                        >
                          Importieren
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {!readiness.ready && (
              <div className="error-message" style={{ marginTop: 'var(--spacing-6)' }}>
                <strong>Fehlende Daten:</strong>
                <ul style={{ marginTop: 'var(--spacing-2)' }}>
                  {readiness.issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {readiness.ready && (
              <div className="success-message" style={{ marginTop: 'var(--spacing-6)' }}>
                ✓ Alle Unternehmen haben Bilanzdaten für {selectedFiscalYear}
              </div>
            )}
          </>
        )}

        {!loading && currentStep === 'participations' && (
          <>
            <h2>🔗 Beteiligungsverhältnisse</h2>
            <p className="step-description">
              Überprüfen Sie die Beteiligungsquoten und Konsolidierungsart.
            </p>

            <div style={{ marginTop: 'var(--spacing-6)' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Tochterunternehmen</th>
                    <th>Beteiligungsquote</th>
                    <th>Konsolidierungsart</th>
                  </tr>
                </thead>
                <tbody>
                  {subsidiaries.map(sub => (
                    <tr key={sub.id}>
                      <td>{sub.name}</td>
                      <td>{sub.ownershipPercentage || 100}%</td>
                      <td>
                        <span className="badge badge-info">
                          {(sub.ownershipPercentage || 100) > 50 
                            ? 'Vollkonsolidierung' 
                            : (sub.ownershipPercentage || 100) >= 20 
                            ? 'At-Equity' 
                            : 'Keine Konsolidierung'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {subsidiaries.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                        Keine Tochterunternehmen vorhanden
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 'var(--spacing-6)', padding: 'var(--spacing-4)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                💡 Für detaillierte Beteiligungsverwaltung nutzen Sie die 
                <a href="/consolidation-circle" style={{ marginLeft: 'var(--spacing-1)' }}>
                  Konsolidierungskreis-Seite
                </a>
              </p>
            </div>
          </>
        )}

        {!loading && currentStep === 'consolidation' && (
          <>
            <h2>⚙️ Konsolidierung durchführen</h2>
            <p className="step-description">
              Wählen Sie den Jahresabschluss und starten Sie die Konsolidierung.
            </p>

            <div className="form-group">
              <label>Jahresabschluss des Mutterunternehmens</label>
              <select
                value={selectedStatementId}
                onChange={(e) => setSelectedStatementId(e.target.value)}
              >
                <option value="">-- Bitte wählen --</option>
                {statements
                  .filter(s => s.companyId === parentCompanyId && s.fiscalYear === selectedFiscalYear)
                  .map(s => (
                    <option key={s.id} value={s.id}>
                      {s.company?.name} - {s.fiscalYear}
                    </option>
                  ))}
              </select>
            </div>

            <div style={{ marginTop: 'var(--spacing-6)' }}>
              <h3>Konsolidierungsschritte</h3>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                <li style={{ padding: 'var(--spacing-2) 0' }}>✓ Kapitalkonsolidierung (§ 301 HGB)</li>
                <li style={{ padding: 'var(--spacing-2) 0' }}>✓ Schuldenkonsolidierung (§ 303 HGB)</li>
                <li style={{ padding: 'var(--spacing-2) 0' }}>✓ Zwischenergebniseliminierung (§ 304 HGB)</li>
                <li style={{ padding: 'var(--spacing-2) 0' }}>✓ Aufwands-/Ertragskonsolidierung (§ 305 HGB)</li>
              </ul>
            </div>

            <button
              className="button button-primary"
              onClick={handleRunConsolidation}
              disabled={consolidating || !selectedStatementId}
              style={{ marginTop: 'var(--spacing-6)' }}
            >
              {consolidating ? (
                <>
                  <span className="spinner" style={{ width: '16px', height: '16px', marginRight: 'var(--spacing-2)' }}></span>
                  Konsolidiere...
                </>
              ) : (
                '🚀 Konsolidierung starten'
              )}
            </button>
          </>
        )}

        {!loading && currentStep === 'review' && (
          <>
            <h2>✅ Konsolidierung abgeschlossen</h2>
            <p className="step-description">
              Die Konsolidierung wurde erfolgreich durchgeführt.
            </p>

            {consolidationResult && (
              <div className="preview-summary" style={{ marginTop: 'var(--spacing-6)' }}>
                <div className="summary-item success">
                  <span className="count">{consolidationResult.summary.totalEntries}</span>
                  <span>Buchungen erstellt</span>
                </div>
                <div className="summary-item">
                  <span className="count">{consolidationResult.summary.intercompanyEliminations}</span>
                  <span>IC-Eliminierungen</span>
                </div>
                <div className="summary-item">
                  <span className="count">{consolidationResult.summary.debtConsolidations}</span>
                  <span>Schuldenkonsolidierung</span>
                </div>
                <div className="summary-item">
                  <span className="count">{consolidationResult.summary.capitalConsolidations}</span>
                  <span>Kapitalkonsolidierung</span>
                </div>
              </div>
            )}

            <div style={{ marginTop: 'var(--spacing-8)', display: 'flex', gap: 'var(--spacing-4)', justifyContent: 'center' }}>
              <button
                className="button button-secondary"
                onClick={() => navigate('/consolidation')}
              >
                Buchungen prüfen
              </button>
              <button
                className="button button-primary"
                onClick={handleComplete}
              >
                📊 Konzernabschluss ansehen
              </button>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="wizard-actions">
        {onCancel && (
          <button className="button button-tertiary" onClick={onCancel}>
            Abbrechen
          </button>
        )}
        
        <div className="button-group">
          {currentStep !== 'companies' && currentStep !== 'review' && (
            <button className="button button-secondary" onClick={handlePrevStep}>
              ← Zurück
            </button>
          )}
          
          {currentStep !== 'consolidation' && currentStep !== 'review' && (
            <button
              className="button button-primary"
              onClick={handleNextStep}
              disabled={
                (currentStep === 'companies' && !parentCompanyId) ||
                (currentStep === 'dataImport' && !readiness.ready)
              }
            >
              Weiter →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConsolidationWizard;
