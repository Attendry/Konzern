import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { companyService } from '../services/companyService';
import { financialStatementService } from '../services/financialStatementService';
import { Company, FinancialStatement } from '../types';
import '../App.css';

interface CompanyStatus {
  company: Company;
  hasData: boolean;
  statement?: FinancialStatement;
  isParent: boolean;
  ownershipPercentage?: number;
}

interface ConsolidationStatusDashboardProps {
  fiscalYear?: number;
  parentCompanyId?: string;
}

export function ConsolidationStatusDashboard({
  fiscalYear = new Date().getFullYear(),
  parentCompanyId: propParentId,
}: ConsolidationStatusDashboardProps) {
  const navigate = useNavigate();
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [statements, setStatements] = useState<FinancialStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(fiscalYear);
  const [parentCompanyId, setParentCompanyId] = useState<string>(propParentId || '');

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

      // Auto-select parent if only one exists
      const parents = companiesData.filter((c: Company) => !c.parentCompanyId);
      if (parents.length === 1 && !parentCompanyId) {
        setParentCompanyId(parents[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCompanyStatuses = (): CompanyStatus[] => {
    if (!parentCompanyId) return [];

    const parent = companies.find(c => c.id === parentCompanyId);
    if (!parent) return [];

    const subsidiaries = companies.filter(c => c.parentCompanyId === parentCompanyId);
    
    const statuses: CompanyStatus[] = [
      {
        company: parent,
        hasData: statements.some(s => s.companyId === parent.id && s.fiscalYear === selectedYear),
        statement: statements.find(s => s.companyId === parent.id && s.fiscalYear === selectedYear),
        isParent: true,
      },
    ];

    subsidiaries.forEach(sub => {
      statuses.push({
        company: sub,
        hasData: statements.some(s => s.companyId === sub.id && s.fiscalYear === selectedYear),
        statement: statements.find(s => s.companyId === sub.id && s.fiscalYear === selectedYear),
        isParent: false,
        ownershipPercentage: sub.ownershipPercentage,
      });
    });

    return statuses;
  };

  const companyStatuses = getCompanyStatuses();
  const totalCompanies = companyStatuses.length;
  const companiesWithData = companyStatuses.filter(s => s.hasData).length;
  const completionPercent = totalCompanies > 0 ? (companiesWithData / totalCompanies) * 100 : 0;
  const isReadyForConsolidation = completionPercent === 100;

  const parentCompanies = companies.filter(c => !c.parentCompanyId);

  if (loading) {
    return (
      <div className="loading-state" style={{ padding: 'var(--spacing-8)' }}>
        <div className="spinner"></div>
        <p>Lade Status...</p>
      </div>
    );
  }

  return (
    <div className="status-dashboard-container">
      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-6)', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-1)' }}>Konzern</label>
          <select
            value={parentCompanyId}
            onChange={(e) => setParentCompanyId(e.target.value)}
            style={{ minWidth: '200px' }}
          >
            <option value="">-- Konzern wählen --</option>
            {parentCompanies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-1)' }}>Geschäftsjahr</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          >
            {[...Array(5)].map((_, i) => {
              const year = new Date().getFullYear() - i;
              return <option key={year} value={year}>{year}</option>;
            })}
          </select>
        </div>
      </div>

      {!parentCompanyId ? (
        <div className="empty-state">
          <p>Bitte wählen Sie einen Konzern aus.</p>
        </div>
      ) : (
        <>
          {/* Status Cards */}
          <div className="status-dashboard">
            {/* Overall Progress */}
            <div className={`status-card ${isReadyForConsolidation ? 'complete' : 'pending'}`}>
              <div className="status-header">
                <div className="status-title">Datenvollständigkeit</div>
                <div className="status-icon">{isReadyForConsolidation ? '✅' : '📊'}</div>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar" style={{ width: `${completionPercent}%` }}></div>
              </div>
              <div className="progress-label">
                <span>{companiesWithData} von {totalCompanies} Unternehmen</span>
                <span>{completionPercent.toFixed(0)}%</span>
              </div>
              {!isReadyForConsolidation && (
                <div className="status-action">
                  <button
                    className="button button-secondary button-sm"
                    onClick={() => navigate('/import')}
                  >
                    Daten importieren
                  </button>
                </div>
              )}
            </div>

            {/* Consolidation Ready */}
            <div className={`status-card ${isReadyForConsolidation ? 'complete' : 'pending'}`}>
              <div className="status-header">
                <div className="status-title">Konsolidierungsbereit</div>
                <div className="status-icon">{isReadyForConsolidation ? '🚀' : '⏳'}</div>
              </div>
              <div className="status-details">
                {isReadyForConsolidation ? (
                  <p>Alle Daten für {selectedYear} sind vollständig. Sie können die Konsolidierung starten.</p>
                ) : (
                  <p>Es fehlen noch Daten für einige Unternehmen. Bitte vervollständigen Sie den Import.</p>
                )}
              </div>
              {isReadyForConsolidation && (
                <div className="status-action">
                  <button
                    className="button button-primary button-sm"
                    onClick={() => navigate('/konsolidierung-assistent')}
                  >
                    Konsolidierung starten
                  </button>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="status-card">
              <div className="status-header">
                <div className="status-title">Konzernstruktur</div>
                <div className="status-icon">🏢</div>
              </div>
              <div className="status-details">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)', marginTop: 'var(--spacing-3)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-accent-blue)' }}>
                      {totalCompanies}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                      Unternehmen
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
                      {totalCompanies - 1}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                      Töchter
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Company Status List */}
          <div className="card" style={{ marginTop: 'var(--spacing-6)' }}>
            <div className="card-header">
              <h3 style={{ margin: 0 }}>Unternehmensstatus für {selectedYear}</h3>
            </div>
            <div className="company-status-list">
              {companyStatuses.map(status => (
                <div key={status.company.id} className="company-status-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
                    <span className={`status-dot ${status.hasData ? 'complete' : 'missing'}`}></span>
                    <span className="company-name">
                      {status.isParent ? '👑 ' : '└ '}
                      {status.company.name}
                    </span>
                    {!status.isParent && status.ownershipPercentage && (
                      <span className="badge badge-neutral" style={{ fontSize: 'var(--font-size-xs)' }}>
                        {status.ownershipPercentage}%
                      </span>
                    )}
                  </div>
                  <div className="company-status">
                    {status.hasData ? (
                      <>
                        <span className="badge badge-success">Daten vorhanden</span>
                        <button
                          className="button button-tertiary button-sm"
                          onClick={() => navigate(`/financial-statements/${status.statement?.id}`)}
                          style={{ marginLeft: 'var(--spacing-2)' }}
                        >
                          Ansehen
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="badge badge-warning">Keine Daten</span>
                        <button
                          className="button button-secondary button-sm"
                          onClick={() => navigate('/import')}
                          style={{ marginLeft: 'var(--spacing-2)' }}
                        >
                          Importieren
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ marginTop: 'var(--spacing-6)', display: 'flex', gap: 'var(--spacing-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="button button-secondary"
              onClick={() => navigate('/companies')}
            >
              🏢 Unternehmen verwalten
            </button>
            <button
              className="button button-secondary"
              onClick={() => navigate('/import')}
            >
              📤 Daten importieren
            </button>
            <button
              className="button button-secondary"
              onClick={() => navigate('/consolidation-circle')}
            >
              🔗 Konsolidierungskreis
            </button>
            {isReadyForConsolidation && (
              <button
                className="button button-primary"
                onClick={() => navigate('/konsolidierung-assistent')}
              >
                🧙 Konsolidierung starten
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ConsolidationStatusDashboard;
