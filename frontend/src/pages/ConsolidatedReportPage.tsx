import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { reportService, ConsolidationReport, ConsolidatedIncomeStatement } from '../services/reportService';
import { financialStatementService } from '../services/financialStatementService';
import { FinancialStatement } from '../types';
import { useToastContext } from '../contexts/ToastContext';
import { useAIChat } from '../contexts/AIChatContext';
import '../App.css';

type ReportTab = 'balance-sheet' | 'income-statement' | 'overview' | 'comparison';

function ConsolidatedReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success, error: showError } = useToastContext();
  
  // Get AI chat context - ErrorBoundary will catch if context is missing
  const { setFinancialStatementId } = useAIChat();
  
  const [statements, setStatements] = useState<FinancialStatement[]>([]);
  const [selectedStatementId, setSelectedStatementId] = useState<string>(id || '');
  const [report, setReport] = useState<ConsolidationReport | null>(null);
  const [incomeStatement, setIncomeStatement] = useState<ConsolidatedIncomeStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStatements, setLoadingStatements] = useState(true);
  const [activeTab, setActiveTab] = useState<ReportTab>('balance-sheet');
  const [exporting, setExporting] = useState<'excel' | 'pdf' | 'xbrl' | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  // Set AI chatbot context when viewing a consolidated report
  useEffect(() => {
    if (!setFinancialStatementId) return;
    
    try {
      if (selectedStatementId) {
        setFinancialStatementId(selectedStatementId);
      }
      return () => {
        try {
          setFinancialStatementId(null); // Cleanup on unmount
        } catch (err) {
          console.warn('Error cleaning up AI chat context:', err);
        }
      };
    } catch (err) {
      console.warn('Error setting AI chat context:', err);
    }
  }, [selectedStatementId, setFinancialStatementId]);

  useEffect(() => {
    loadStatements();
  }, []);

  const loadStatements = async () => {
    setLoadingStatements(true);
    try {
      const data = await financialStatementService.getAll();
      setStatements(data);
      if (id && data.find(s => s.id === id)) {
        setSelectedStatementId(id);
      }
    } catch (error) {
      console.error('Error loading statements:', error);
    } finally {
      setLoadingStatements(false);
    }
  };

  const loadReport = useCallback(async () => {
    if (!selectedStatementId) return;
    
    setLoading(true);
    try {
      const [reportData, incomeData] = await Promise.all([
        reportService.getConsolidationReport(selectedStatementId, showComparison).catch((err) => {
          console.error('Error loading consolidation report:', err);
          throw err;
        }),
        reportService.getConsolidatedIncomeStatement(selectedStatementId).catch((err) => {
          console.warn('Error loading income statement (non-critical):', err);
          return null;
        }),
      ]);
      setReport(reportData);
      setIncomeStatement(incomeData);
    } catch (error: any) {
      console.error('Error loading report:', error);
      setReport(null);
      setIncomeStatement(null);
      const errorMessage = error?.response?.data?.message || error?.message || 'Unbekannter Fehler';
      showError(`Fehler beim Laden des Berichts: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [selectedStatementId, showComparison, showError]);

  useEffect(() => {
    if (selectedStatementId) {
      loadReport();
    }
  }, [selectedStatementId, loadReport]);

  const handleExport = async (format: 'excel' | 'pdf' | 'xbrl') => {
    if (!selectedStatementId) return;
    
    setExporting(format);
    try {
      let blob: Blob;
      let filename: string;
      
      switch (format) {
        case 'excel':
          blob = await reportService.exportToExcel(selectedStatementId);
          filename = `Konzernabschluss_${report?.fiscalYear || 'export'}.xlsx`;
          break;
        case 'pdf':
          blob = await reportService.exportToPdf(selectedStatementId);
          filename = `Konzernabschluss_${report?.fiscalYear || 'export'}.pdf`;
          break;
        case 'xbrl':
          blob = await reportService.exportToXbrl(selectedStatementId);
          filename = `Konzernabschluss_${report?.fiscalYear || 'export'}.xml`;
          break;
      }
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      success(`${format.toUpperCase()} Export erfolgreich`);
    } catch (error: any) {
      console.error(`Export error (${format}):`, error);
      showError(`Export fehlgeschlagen: ${error.message || 'Unbekannter Fehler'}`);
    } finally {
      setExporting(null);
    }
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number): string => {
    return new Intl.NumberFormat('de-DE', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value / 100);
  };

  const renderBalanceSheet = () => {
    if (!report?.balanceSheet) return null;
    const bs = report.balanceSheet;

    return (
      <div className="consolidated-report-section">
        <h2>Konzernbilanz zum {new Date(report.periodEnd).toLocaleDateString('de-DE')}</h2>
        
        <div className="balance-sheet-grid">
          {/* AKTIVA */}
          <div className="balance-sheet-column">
            <h3 className="section-header">AKTIVA</h3>
            
            <div className="account-group">
              <h4>A. Anlagevermögen</h4>
              {bs.assets.fixedAssets.map((pos, idx) => (
                <div key={idx} className="account-row">
                  <span className="account-name">{pos.accountName}</span>
                  <span className="account-value">{formatCurrency(pos.balance)}</span>
                </div>
              ))}
              <div className="account-row subtotal">
                <span>Summe Anlagevermögen</span>
                <span>{formatCurrency(bs.assets.fixedAssets.reduce((sum, a) => sum + a.balance, 0))}</span>
              </div>
            </div>

            <div className="account-group">
              <h4>B. Umlaufvermögen</h4>
              {bs.assets.currentAssets.map((pos, idx) => (
                <div key={idx} className="account-row">
                  <span className="account-name">{pos.accountName}</span>
                  <span className="account-value">{formatCurrency(pos.balance)}</span>
                </div>
              ))}
              <div className="account-row subtotal">
                <span>Summe Umlaufvermögen</span>
                <span>{formatCurrency(bs.assets.currentAssets.reduce((sum, a) => sum + a.balance, 0))}</span>
              </div>
            </div>

            {bs.assets.goodwill > 0 && (
              <div className="account-group">
                <h4>C. Geschäfts- oder Firmenwert</h4>
                <div className="account-row">
                  <span>Goodwill</span>
                  <span>{formatCurrency(bs.assets.goodwill)}</span>
                </div>
              </div>
            )}

            <div className="account-row total">
              <span>SUMME AKTIVA</span>
              <span>{formatCurrency(bs.assets.totalAssets)}</span>
            </div>
          </div>

          {/* PASSIVA */}
          <div className="balance-sheet-column">
            <h3 className="section-header">PASSIVA</h3>
            
            <div className="account-group">
              <h4>A. Eigenkapital</h4>
              {bs.equity.positions.map((pos, idx) => (
                <div key={idx} className="account-row">
                  <span className="account-name">{pos.accountName}</span>
                  <span className="account-value">{formatCurrency(pos.balance)}</span>
                </div>
              ))}
              {bs.equity.minorityInterests !== 0 && (
                <div className="account-row">
                  <span className="account-name">Anteile anderer Gesellschafter</span>
                  <span className="account-value">{formatCurrency(bs.equity.minorityInterests)}</span>
                </div>
              )}
              {bs.equity.currencyTranslationDifference !== 0 && (
                <div className="account-row">
                  <span className="account-name">Währungsumrechnungsdifferenz</span>
                  <span className="account-value">{formatCurrency(bs.equity.currencyTranslationDifference)}</span>
                </div>
              )}
              <div className="account-row subtotal">
                <span>Summe Eigenkapital</span>
                <span>{formatCurrency(bs.equity.totalEquity)}</span>
              </div>
            </div>

            <div className="account-group">
              <h4>B. Rückstellungen</h4>
              {bs.liabilities.provisions.map((pos, idx) => (
                <div key={idx} className="account-row">
                  <span className="account-name">{pos.accountName}</span>
                  <span className="account-value">{formatCurrency(pos.balance)}</span>
                </div>
              ))}
            </div>

            <div className="account-group">
              <h4>C. Verbindlichkeiten</h4>
              {bs.liabilities.longTermLiabilities.map((pos, idx) => (
                <div key={idx} className="account-row">
                  <span className="account-name">{pos.accountName}</span>
                  <span className="account-value">{formatCurrency(pos.balance)}</span>
                </div>
              ))}
              {bs.liabilities.shortTermLiabilities.map((pos, idx) => (
                <div key={idx} className="account-row">
                  <span className="account-name">{pos.accountName}</span>
                  <span className="account-value">{formatCurrency(pos.balance)}</span>
                </div>
              ))}
              <div className="account-row subtotal">
                <span>Summe Verbindlichkeiten</span>
                <span>{formatCurrency(bs.liabilities.totalLiabilities)}</span>
              </div>
            </div>

            <div className="account-row total">
              <span>SUMME PASSIVA</span>
              <span>{formatCurrency(bs.totalLiabilitiesAndEquity)}</span>
            </div>
          </div>
        </div>

        {/* Balance Check */}
        <div className={`balance-check ${bs.isBalanced ? 'balanced' : 'unbalanced'}`}>
          {bs.isBalanced ? (
            <span>Bilanz ist ausgeglichen</span>
          ) : (
            <span>[Warnung] Bilanz nicht ausgeglichen - Differenz: {formatCurrency(bs.balanceDifference)}</span>
          )}
        </div>
      </div>
    );
  };

  const renderIncomeStatement = () => {
    if (!incomeStatement) {
      return (
        <div className="consolidated-report-section">
          <h2>Konzern-Gewinn- und Verlustrechnung</h2>
          <div className="empty-state">
            <p>Keine GuV-Daten verfügbar. Bitte stellen Sie sicher, dass Aufwands- und Ertragskonten importiert wurden.</p>
          </div>
        </div>
      );
    }

    const is = incomeStatement;

    return (
      <div className="consolidated-report-section">
        <h2>Konzern-Gewinn- und Verlustrechnung</h2>
        <p className="period-info">
          Geschäftsjahr {is.fiscalYear} ({new Date(is.periodStart).toLocaleDateString('de-DE')} - {new Date(is.periodEnd).toLocaleDateString('de-DE')})
        </p>

        <table className="income-statement-table">
          <thead>
            <tr>
              <th>Position</th>
              <th className="number-col">Gesamt</th>
              <th className="number-col">IC Eliminiert</th>
              <th className="number-col">Konsolidiert</th>
            </tr>
          </thead>
          <tbody>
            {/* Revenue */}
            <tr className="section-row">
              <td colSpan={4}><strong>1. Umsatzerlöse</strong></td>
            </tr>
            {is.revenue.positions.slice(0, 5).map((pos, idx) => (
              <tr key={idx} className="detail-row">
                <td className="indent">{pos.accountName}</td>
                <td className="number-col">{formatCurrency(pos.amount)}</td>
                <td className="number-col">-</td>
                <td className="number-col">-</td>
              </tr>
            ))}
            <tr className="subtotal-row">
              <td>Summe Umsatzerlöse</td>
              <td className="number-col">{formatCurrency(is.revenue.total)}</td>
              <td className="number-col negative">{formatCurrency(-is.revenue.intercompanyEliminated)}</td>
              <td className="number-col">{formatCurrency(is.revenue.consolidated)}</td>
            </tr>

            {/* Cost of Sales */}
            <tr className="section-row">
              <td colSpan={4}><strong>2. Herstellungskosten</strong></td>
            </tr>
            <tr className="subtotal-row">
              <td>Summe Herstellungskosten</td>
              <td className="number-col">{formatCurrency(is.costOfSales.total)}</td>
              <td className="number-col">{formatCurrency(-is.costOfSales.intercompanyEliminated)}</td>
              <td className="number-col">{formatCurrency(is.costOfSales.consolidated)}</td>
            </tr>

            {/* Gross Profit */}
            <tr className="highlight-row">
              <td><strong>Bruttoergebnis vom Umsatz</strong></td>
              <td className="number-col">{formatCurrency(is.revenue.total - is.costOfSales.total)}</td>
              <td className="number-col">-</td>
              <td className="number-col">{formatCurrency(is.revenue.consolidated - is.costOfSales.consolidated)}</td>
            </tr>

            {/* Operating Expenses */}
            <tr className="section-row">
              <td colSpan={4}><strong>3. Betriebliche Aufwendungen</strong></td>
            </tr>
            <tr className="subtotal-row">
              <td>Summe betriebliche Aufwendungen</td>
              <td className="number-col">{formatCurrency(is.operatingExpenses.total)}</td>
              <td className="number-col">{formatCurrency(-is.operatingExpenses.intercompanyEliminated)}</td>
              <td className="number-col">{formatCurrency(is.operatingExpenses.consolidated)}</td>
            </tr>

            {/* Financial Result */}
            <tr className="section-row">
              <td colSpan={4}><strong>4. Finanzergebnis</strong></td>
            </tr>
            <tr className="subtotal-row">
              <td>Summe Finanzergebnis</td>
              <td className="number-col">{formatCurrency(is.financialResult.total)}</td>
              <td className="number-col">{formatCurrency(-is.financialResult.intercompanyEliminated)}</td>
              <td className="number-col">{formatCurrency(is.financialResult.consolidated)}</td>
            </tr>

            {/* Income Before Tax */}
            <tr className="highlight-row">
              <td><strong>Ergebnis vor Steuern</strong></td>
              <td className="number-col" colSpan={2}>-</td>
              <td className="number-col">{formatCurrency(is.incomeBeforeTax)}</td>
            </tr>

            {/* Taxes */}
            <tr className="section-row">
              <td colSpan={4}><strong>5. Steuern vom Einkommen und Ertrag</strong></td>
            </tr>
            <tr className="subtotal-row">
              <td>Summe Steuern</td>
              <td className="number-col">{formatCurrency(is.incomeTax.total)}</td>
              <td className="number-col">-</td>
              <td className="number-col">{formatCurrency(is.incomeTax.consolidated)}</td>
            </tr>

            {/* Net Income */}
            <tr className="total-row">
              <td><strong>Konzernjahresüberschuss</strong></td>
              <td className="number-col" colSpan={2}>-</td>
              <td className="number-col"><strong>{formatCurrency(is.netIncome.consolidated)}</strong></td>
            </tr>

            {/* Attribution */}
            <tr className="detail-row">
              <td className="indent">davon Anteil Mutterunternehmen</td>
              <td className="number-col" colSpan={2}>-</td>
              <td className="number-col">{formatCurrency(is.netIncome.parentCompany)}</td>
            </tr>
            <tr className="detail-row">
              <td className="indent">davon Minderheitenanteile</td>
              <td className="number-col" colSpan={2}>-</td>
              <td className="number-col">{formatCurrency(is.netIncome.minorityInterests)}</td>
            </tr>
          </tbody>
        </table>

        {/* Eliminations Summary */}
        <div className="eliminations-summary">
          <h4>Konsolidierungseliminierungen</h4>
          <div className="eliminations-grid">
            <div className="elimination-item">
              <span>Innenumsätze</span>
              <span>{formatCurrency(is.eliminations.intercompanyRevenue)}</span>
            </div>
            <div className="elimination-item">
              <span>Interne Aufwendungen</span>
              <span>{formatCurrency(is.eliminations.intercompanyExpenses)}</span>
            </div>
            <div className="elimination-item">
              <span>Zwischengewinne</span>
              <span>{formatCurrency(is.eliminations.intercompanyProfits)}</span>
            </div>
            <div className="elimination-item">
              <span>Interne Zinsen</span>
              <span>{formatCurrency(is.eliminations.intercompanyInterest)}</span>
            </div>
            <div className="elimination-item total">
              <span><strong>Gesamt Eliminierungen</strong></span>
              <span><strong>{formatCurrency(is.eliminations.total)}</strong></span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderOverview = () => {
    if (!report?.overview) return null;
    const ov = report.overview;

    return (
      <div className="consolidated-report-section">
        <h2>Konsolidierungsübersicht</h2>

        <div className="overview-grid">
          {/* Parent Company */}
          <div className="overview-card">
            <h4>Mutterunternehmen</h4>
            <div className="company-info">
              <span className="company-name">{ov.parentCompany.name}</span>
            </div>
          </div>

          {/* Statistics */}
          <div className="overview-card">
            <h4>Konsolidierung</h4>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-value">{ov.consolidatedCompanies.length + 1}</span>
                <span className="stat-label">Unternehmen im Konzern</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{ov.entriesCount}</span>
                <span className="stat-label">Konsolidierungsbuchungen</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{formatCurrency(ov.eliminationsTotal)}</span>
                <span className="stat-label">Eliminierungen gesamt</span>
              </div>
            </div>
          </div>
        </div>

        {/* Consolidated Companies */}
        <div className="companies-table-container">
          <h4>Konsolidierte Tochterunternehmen</h4>
          <table className="table">
            <thead>
              <tr>
                <th>Unternehmen</th>
                <th className="number-col">Beteiligungsquote</th>
                <th>Konsolidierungsart</th>
              </tr>
            </thead>
            <tbody>
              {ov.consolidatedCompanies.map((company, idx) => (
                <tr key={idx}>
                  <td>{company.name}</td>
                  <td className="number-col">{formatPercent(company.ownershipPercentage)}</td>
                  <td>
                    <span className="badge badge-info">
                      {company.consolidationType === 'full' ? 'Vollkonsolidierung' : 
                       company.consolidationType === 'proportional' ? 'Quotenkonsolidierung' :
                       company.consolidationType === 'equity' ? 'At-Equity' : company.consolidationType}
                    </span>
                  </td>
                </tr>
              ))}
              {ov.consolidatedCompanies.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty-row">Keine Tochterunternehmen konsolidiert</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderComparison = () => {
    if (!report?.comparison) {
      return (
        <div className="consolidated-report-section">
          <h2>Vorjahresvergleich</h2>
          <div className="empty-state">
            <p>Kein Vorjahresvergleich verfügbar. Stellen Sie sicher, dass Vorjahresdaten vorhanden sind.</p>
            <button 
              className="button button-primary"
              onClick={() => setShowComparison(true)}
              disabled={showComparison}
            >
              Vorjahresvergleich laden
            </button>
          </div>
        </div>
      );
    }

    const comp = report.comparison;
    const bs = comp.balanceSheetChanges;

    const renderChangeIndicator = (changePercent: number) => {
      if (changePercent > 0) {
        return <span className="change-indicator positive">↑ {formatPercent(changePercent)}</span>;
      } else if (changePercent < 0) {
        return <span className="change-indicator negative">↓ {formatPercent(Math.abs(changePercent))}</span>;
      }
      return <span className="change-indicator neutral">→ 0%</span>;
    };

    return (
      <div className="consolidated-report-section">
        <h2>Vorjahresvergleich ({report.fiscalYear} vs. {comp.priorYear})</h2>

        <div className="comparison-grid">
          {/* Balance Sheet Comparison */}
          <div className="comparison-card">
            <h4>Bilanz</h4>
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Position</th>
                  <th className="number-col">{comp.priorYear}</th>
                  <th className="number-col">{report.fiscalYear}</th>
                  <th className="number-col">Veränderung</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Bilanzsumme (Aktiva)</td>
                  <td className="number-col">{formatCurrency(bs.totalAssets.prior)}</td>
                  <td className="number-col">{formatCurrency(bs.totalAssets.current)}</td>
                  <td className="number-col">
                    {formatCurrency(bs.totalAssets.change)}
                    {renderChangeIndicator(bs.totalAssets.changePercent)}
                  </td>
                </tr>
                <tr>
                  <td>Eigenkapital</td>
                  <td className="number-col">{formatCurrency(bs.totalEquity.prior)}</td>
                  <td className="number-col">{formatCurrency(bs.totalEquity.current)}</td>
                  <td className="number-col">
                    {formatCurrency(bs.totalEquity.change)}
                    {renderChangeIndicator(bs.totalEquity.changePercent)}
                  </td>
                </tr>
                <tr>
                  <td>Fremdkapital</td>
                  <td className="number-col">{formatCurrency(bs.totalLiabilities.prior)}</td>
                  <td className="number-col">{formatCurrency(bs.totalLiabilities.current)}</td>
                  <td className="number-col">
                    {formatCurrency(bs.totalLiabilities.change)}
                    {renderChangeIndicator(bs.totalLiabilities.changePercent)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Income Statement Comparison */}
          {comp.incomeStatementChanges && (
            <div className="comparison-card">
              <h4>GuV</h4>
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Position</th>
                    <th className="number-col">{comp.priorYear}</th>
                    <th className="number-col">{report.fiscalYear}</th>
                    <th className="number-col">Veränderung</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Umsatzerlöse</td>
                    <td className="number-col">{formatCurrency(comp.incomeStatementChanges.revenue.prior)}</td>
                    <td className="number-col">{formatCurrency(comp.incomeStatementChanges.revenue.current)}</td>
                    <td className="number-col">
                      {formatCurrency(comp.incomeStatementChanges.revenue.change)}
                      {renderChangeIndicator(comp.incomeStatementChanges.revenue.changePercent)}
                    </td>
                  </tr>
                  <tr>
                    <td>Jahresüberschuss</td>
                    <td className="number-col">{formatCurrency(comp.incomeStatementChanges.netIncome.prior)}</td>
                    <td className="number-col">{formatCurrency(comp.incomeStatementChanges.netIncome.current)}</td>
                    <td className="number-col">
                      {formatCurrency(comp.incomeStatementChanges.netIncome.change)}
                      {renderChangeIndicator(comp.incomeStatementChanges.netIncome.changePercent)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Error boundary - if there's a critical error, show error state
  if (loadingStatements && statements.length === 0) {
    return (
      <div className="consolidated-report-page">
        <div className="page-header">
          <div className="header-left">
            <button className="button button-tertiary" onClick={() => navigate('/consolidation')}>
              ← Zurück zur Konsolidierung
            </button>
            <h1>Konzernabschluss</h1>
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-8)' }}>
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Lade Jahresabschlüsse...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="consolidated-report-page">
      <div className="page-header">
        <div className="header-left">
          <button className="button button-tertiary" onClick={() => navigate('/consolidation')}>
            ← Zurück zur Konsolidierung
          </button>
          <h1>Konzernabschluss</h1>
        </div>
        
        <div className="header-actions">
          <button
            className="button button-secondary"
            onClick={() => handleExport('excel')}
            disabled={!report || exporting !== null}
          >
            {exporting === 'excel' ? 'Exportiere...' : 'Excel Export'}
          </button>
          <button
            className="button button-secondary"
            onClick={() => handleExport('pdf')}
            disabled={!report || exporting !== null}
          >
            {exporting === 'pdf' ? 'Exportiere...' : 'PDF Export'}
          </button>
          <button
            className="button button-secondary"
            onClick={() => handleExport('xbrl')}
            disabled={!report || exporting !== null}
          >
            {exporting === 'xbrl' ? 'Exportiere...' : 'eBilanz/XBRL'}
          </button>
        </div>
      </div>

      {/* Statement Selector */}
      <div className="card selector-card">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Jahresabschluss auswählen</label>
          {loadingStatements ? (
            <p>Lade Jahresabschlüsse...</p>
          ) : (
            <select
              value={selectedStatementId}
              onChange={(e) => setSelectedStatementId(e.target.value)}
            >
              <option value="">-- Bitte wählen --</option>
              {statements.map((statement) => (
                <option key={statement.id} value={statement.id}>
                  {statement.company?.name || 'Unbekannt'} - {statement.fiscalYear}
                </option>
              ))}
            </select>
          )}
        </div>
        
        <div className="form-group checkbox-group" style={{ marginBottom: 0, marginLeft: 'var(--spacing-4)' }}>
          <label>
            <input
              type="checkbox"
              checked={showComparison}
              onChange={(e) => setShowComparison(e.target.checked)}
            />
            Mit Vorjahresvergleich
          </label>
        </div>
      </div>

      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Lade Konzernabschluss...</p>
        </div>
      )}

      {!loading && !selectedStatementId && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-8)' }}>
          <div className="empty-state">
            <h3>Kein Jahresabschluss ausgewählt</h3>
            <p>Bitte wählen Sie einen Jahresabschluss aus der Liste oben aus, um den Konzernabschluss anzuzeigen.</p>
          </div>
        </div>
      )}

      {!loading && !report && selectedStatementId && (
        <div className="empty-state">
          <p>Keine Konsolidierungsdaten gefunden. Bitte führen Sie zuerst die Konsolidierung durch.</p>
          <button className="button button-primary" onClick={() => navigate('/consolidation')}>
            Zur Konsolidierung
          </button>
        </div>
      )}

      {!loading && report && (
        <>
          {/* Tabs */}
          <div className="report-tabs">
            <button
              className={`tab-button ${activeTab === 'balance-sheet' ? 'active' : ''}`}
              onClick={() => setActiveTab('balance-sheet')}
            >
              Konzernbilanz
            </button>
            <button
              className={`tab-button ${activeTab === 'income-statement' ? 'active' : ''}`}
              onClick={() => setActiveTab('income-statement')}
            >
              Konzern-GuV
            </button>
            <button
              className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Übersicht
            </button>
            <button
              className={`tab-button ${activeTab === 'comparison' ? 'active' : ''}`}
              onClick={() => setActiveTab('comparison')}
            >
              Vorjahresvergleich
            </button>
          </div>

          {/* Tab Content */}
          <div className="report-content">
            {activeTab === 'balance-sheet' && renderBalanceSheet()}
            {activeTab === 'income-statement' && renderIncomeStatement()}
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'comparison' && renderComparison()}
          </div>
        </>
      )}
    </div>
  );
}

export default ConsolidatedReportPage;
