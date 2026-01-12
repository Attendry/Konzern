import { useState, useEffect, useCallback } from 'react';
import { Company, FinancialStatement } from '../types';
import { companyService } from '../services/companyService';
import { financialStatementService } from '../services/financialStatementService';
import { firstConsolidationService } from '../services/firstConsolidationService';
import { MetricCard } from './MetricCard';
import { useToastContext } from '../contexts/ToastContext';
import '../App.css';

interface MinorityInterestDashboardProps {
  financialStatementId?: string;
  onRefresh?: () => void;
}

interface CompanyMinorityData {
  company: Company;
  minorityPercentage: number;
  minorityInterestEquity: number;
  minorityInterestProfit: number;
  totalEquity: number;
  totalProfit: number;
}

export function MinorityInterestDashboard({
  financialStatementId,
  onRefresh,
}: MinorityInterestDashboardProps) {
  const { error: showError } = useToastContext();
  const [loading, setLoading] = useState(true);
  const [selectedStatementId, setSelectedStatementId] = useState<string>(financialStatementId || '');
  const [statements, setStatements] = useState<FinancialStatement[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [minorityData, setMinorityData] = useState<CompanyMinorityData[]>([]);

  // Totals
  const [totals, setTotals] = useState({
    totalMinorityEquity: 0,
    totalMinorityProfit: 0,
    companiesWithMinority: 0,
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (financialStatementId) {
      setSelectedStatementId(financialStatementId);
    }
  }, [financialStatementId]);

  useEffect(() => {
    if (selectedStatementId && companies.length > 0) {
      loadMinorityData();
    }
  }, [selectedStatementId, companies]);

  const loadInitialData = async () => {
    try {
      const [statementsData, companiesData] = await Promise.all([
        financialStatementService.getAll(),
        companyService.getAll(),
      ]);
      setStatements(statementsData);
      setCompanies(companiesData);

      if (!selectedStatementId && statementsData.length > 0) {
        setSelectedStatementId(statementsData[0].id);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const loadMinorityData = useCallback(async () => {
    if (!selectedStatementId) return;

    setLoading(true);
    try {
      const results: CompanyMinorityData[] = [];
      let totalEquity = 0;
      let totalProfit = 0;
      let withMinority = 0;

      // Load minority data for each subsidiary
      for (const company of companies) {
        // Skip parent companies
        if (company.isUltimateParent || !company.parentCompanyId) continue;

        try {
          const result = await firstConsolidationService.calculateMinorityInterests(
            selectedStatementId,
            company.id
          );

          if (result.minorityInterestEquity > 0 || result.minorityInterestProfit > 0) {
            const detail = result.details[0];
            if (detail) {
              results.push({
                company,
                minorityPercentage: detail.minorityPercentage,
                minorityInterestEquity: result.minorityInterestEquity,
                minorityInterestProfit: result.minorityInterestProfit,
                totalEquity: detail.totalEquity,
                totalProfit: detail.totalProfit,
              });

              totalEquity += result.minorityInterestEquity;
              totalProfit += result.minorityInterestProfit;
              withMinority++;
            }
          }
        } catch (error) {
          // Skip companies without minority interest data
          console.debug(`No minority data for ${company.name}`);
        }
      }

      setMinorityData(results);
      setTotals({
        totalMinorityEquity: totalEquity,
        totalMinorityProfit: totalProfit,
        companiesWithMinority: withMinority,
      });
    } catch (error: any) {
      showError(`Fehler: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedStatementId, companies, showError]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  };

  const formatPercent = (value: number) => {
    return value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  };

  return (
    <div className="minority-interest-dashboard">
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 'var(--spacing-6)',
      }}>
        <h2 style={{ margin: 0 }}>Minderheitenanteile (§ 307 HGB)</h2>
        <div style={{ display: 'flex', gap: 'var(--spacing-3)', alignItems: 'center' }}>
          <select
            value={selectedStatementId}
            onChange={(e) => setSelectedStatementId(e.target.value)}
            style={{ padding: 'var(--spacing-2) var(--spacing-3)', minWidth: '200px' }}
          >
            <option value="">-- Jahresabschluss wählen --</option>
            {statements.map(s => (
              <option key={s.id} value={s.id}>
                {s.company?.name || 'Unbekannt'} - {s.fiscalYear}
              </option>
            ))}
          </select>
          <button 
            className="button button-secondary" 
            onClick={() => {
              loadMinorityData();
              onRefresh?.();
            }}
            disabled={loading || !selectedStatementId}
          >
            Aktualisieren
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: 'var(--spacing-4)',
        marginBottom: 'var(--spacing-6)',
      }}>
        <MetricCard
          label="Anteile anderer Gesellschafter (EK)"
          value={totals.totalMinorityEquity}
          format={(v) => v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
        />
        <MetricCard
          label="Anteile anderer Gesellschafter (GuV)"
          value={totals.totalMinorityProfit}
          format={(v) => v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
        />
        <MetricCard
          label="Gesellschaften mit Minderheiten"
          value={totals.companiesWithMinority}
        />
      </div>

      {/* Detail Table */}
      <div className="card">
        <div className="card-header">
          <h3>Minderheitenanteile nach Gesellschaft</h3>
        </div>
        
        {loading ? (
          <div className="loading">
            <div className="loading-spinner"></div>
            <span>Lade Minderheitendaten...</span>
          </div>
        ) : !selectedStatementId ? (
          <div className="empty-state">
            <div className="empty-state-title">Kein Jahresabschluss ausgewählt</div>
            <div className="empty-state-description">
              Bitte wählen Sie einen Jahresabschluss aus, um die Minderheitenanteile anzuzeigen.
            </div>
          </div>
        ) : minorityData.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">Keine Minderheitenanteile vorhanden</div>
            <div className="empty-state-description">
              Es wurden keine Gesellschaften mit Minderheitenanteilen gefunden. 
              Minderheitenanteile entstehen bei Beteiligungsquoten unter 100%.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Gesellschaft</th>
                  <th style={{ textAlign: 'right' }}>Minderheitsquote</th>
                  <th style={{ textAlign: 'right' }}>Gesamt-EK</th>
                  <th style={{ textAlign: 'right' }}>Minderheitsanteil EK</th>
                  <th style={{ textAlign: 'right' }}>Gesamt-Ergebnis</th>
                  <th style={{ textAlign: 'right' }}>Minderheitsanteil GuV</th>
                </tr>
              </thead>
              <tbody>
                {minorityData.map((data) => (
                  <tr key={data.company.id}>
                    <td>
                      <div>
                        <strong>{data.company.name}</strong>
                        {data.company.countryCode && (
                          <span style={{ 
                            marginLeft: 'var(--spacing-2)', 
                            fontSize: 'var(--font-size-sm)',
                            color: 'var(--color-text-secondary)',
                          }}>
                            ({data.company.countryCode})
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ 
                        background: 'var(--color-bg-tertiary)', 
                        padding: 'var(--spacing-1) var(--spacing-2)', 
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-size-sm)',
                      }}>
                        {formatPercent(data.minorityPercentage)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-family-mono)' }}>
                      {formatCurrency(data.totalEquity)}
                    </td>
                    <td style={{ 
                      textAlign: 'right', 
                      fontFamily: 'var(--font-family-mono)',
                      fontWeight: 'var(--font-weight-semibold)',
                      color: 'var(--color-accent-blue)',
                    }}>
                      {formatCurrency(data.minorityInterestEquity)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-family-mono)' }}>
                      {formatCurrency(data.totalProfit)}
                    </td>
                    <td style={{ 
                      textAlign: 'right', 
                      fontFamily: 'var(--font-family-mono)',
                      fontWeight: 'var(--font-weight-semibold)',
                      color: data.minorityInterestProfit >= 0 ? 'var(--color-success)' : 'var(--color-error)',
                    }}>
                      {formatCurrency(data.minorityInterestProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ 
                  fontWeight: 'var(--font-weight-bold)', 
                  borderTop: '2px solid var(--color-border)',
                  background: 'var(--color-bg-tertiary)',
                }}>
                  <td colSpan={3}>Summe Minderheitenanteile</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-family-mono)' }}>
                    {formatCurrency(totals.totalMinorityEquity)}
                  </td>
                  <td></td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-family-mono)' }}>
                    {formatCurrency(totals.totalMinorityProfit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Information Box */}
      <div style={{ 
        marginTop: 'var(--spacing-6)',
        padding: 'var(--spacing-4)',
        background: 'rgba(11, 140, 238, 0.1)',
        border: '1px solid var(--color-accent-blue)',
        borderRadius: 'var(--radius-lg)',
      }}>
        <h4 style={{ marginBottom: 'var(--spacing-2)', color: 'var(--color-accent-blue)' }}>
          ℹ️ Hinweis zur Bilanzierung (§ 307 HGB)
        </h4>
        <ul style={{ 
          margin: 0, 
          paddingLeft: 'var(--spacing-4)', 
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
        }}>
          <li>Die Minderheitenanteile am Eigenkapital werden in der Konzernbilanz gesondert ausgewiesen.</li>
          <li>Der auf Minderheitsgesellschafter entfallende Gewinn/Verlust wird in der Konzern-GuV abgesetzt.</li>
          <li>Bei der Erstkonsolidierung wird der Minderheitenanteil am beizulegenden Zeitwert des Eigenkapitals berechnet.</li>
          <li>Folgekonsolidierungen berücksichtigen Gewinn-/Verlustanteile und Ausschüttungen.</li>
        </ul>
      </div>
    </div>
  );
}
