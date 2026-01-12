import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Treemap } from 'recharts';
import api from '../services/api';
import { AccountBalance, FinancialStatement } from '../types';
import { buildBalanceSheetFromBalances, BuiltBalanceSheet } from '../utils/balanceSheetBuilder';
import '../App.css';

interface BalanceSheetPosition {
  accountId: string;
  accountNumber: string;
  accountName: string;
  accountType: 'asset' | 'liability' | 'equity';
  amount?: number;
  balance?: number;
  companyId?: string;
  companyName?: string;
}

interface ConsolidatedBalanceSheet {
  fiscalYear: number;
  periodStart: string;
  periodEnd: string;
  assets: {
    fixedAssets: BalanceSheetPosition[];
    currentAssets: BalanceSheetPosition[];
    deferredTaxAssets: BalanceSheetPosition[];
    goodwill: number;
    totalAssets: number;
  };
  liabilities: {
    equity: {
      parentCompany: BalanceSheetPosition[];
      minorityInterests: number;
      totalEquity: number;
    };
    provisions: BalanceSheetPosition[];
    liabilities: BalanceSheetPosition[];
    deferredTaxLiabilities: BalanceSheetPosition[];
    totalLiabilities: number;
  };
  balanceValidation: {
    isBalanced: boolean;
    difference: number;
    errors: string[];
    warnings: string[];
  };
  consolidationSummary: {
    companiesIncluded: number;
    eliminationsApplied: number;
    totalEliminationAmount: number;
  };
}

interface BalanceSheetVisualizationProps {
  financialStatementId: string;
  financialStatement?: FinancialStatement;
  accountBalances?: AccountBalance[];
}

const COLORS = {
  fixedAssets: '#3498db',
  currentAssets: '#2ecc71',
  goodwill: '#9b59b6',
  deferredTaxAssets: '#e67e22',
  equity: '#f39c12',
  minorityInterests: '#e74c3c',
  provisions: '#1abc9c',
  liabilities: '#34495e',
  deferredTaxLiabilities: '#95a5a6',
};

function BalanceSheetVisualization({ 
  financialStatementId, 
  financialStatement,
  accountBalances 
}: BalanceSheetVisualizationProps) {
  const [consolidatedBalanceSheet, setConsolidatedBalanceSheet] = useState<ConsolidatedBalanceSheet | null>(null);
  const [beforeBalanceSheet, setBeforeBalanceSheet] = useState<BuiltBalanceSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'pie' | 'bar' | 'treemap'>('pie');
  const [viewType, setViewType] = useState<'before' | 'after' | 'both'>('both');
  const [chartsReady, setChartsReady] = useState(false);

  // Update beforeBalanceSheet when accountBalances or financialStatement change
  useEffect(() => {
    if (accountBalances && accountBalances.length > 0 && financialStatement) {
      const before = buildBalanceSheetFromBalances(
        accountBalances,
        financialStatement.fiscalYear,
        financialStatement.periodStart,
        financialStatement.periodEnd
      );
      setBeforeBalanceSheet(before);
    }
  }, [accountBalances, financialStatement]);

  // Defer chart rendering to avoid initialization issues
  useEffect(() => {
    // Use requestAnimationFrame to ensure we're past the initialization phase
    const frame1 = requestAnimationFrame(() => {
      const frame2 = requestAnimationFrame(() => {
        setChartsReady(true);
      });
      return () => cancelAnimationFrame(frame2);
    });
    return () => cancelAnimationFrame(frame1);
  }, []);

  // Load consolidated balance sheet when financialStatementId changes
  useEffect(() => {
    if (!financialStatementId) return;

    const loadConsolidated = async () => {
      try {
        setLoading(true);
        setError(null);

        // Try to load consolidated balance sheet (after consolidation)
        try {
          const response = await api.get<ConsolidatedBalanceSheet>(
            `/consolidation/balance-sheet/${financialStatementId}`
          );
          setConsolidatedBalanceSheet(response.data);
          // If we have both, default to 'both' view, otherwise 'after'
          if (accountBalances && accountBalances.length > 0) {
            setViewType('both');
          } else {
            setViewType('after');
          }
        } catch (consolidatedErr: any) {
          // If consolidated balance sheet doesn't exist, that's okay - we'll show before only
          console.log('No consolidated balance sheet available, showing uploaded data only');
          if (accountBalances && accountBalances.length > 0) {
            setViewType('before');
          }
        }
      } catch (err: any) {
        console.error('Error loading balance sheet:', err);
        setError(err.response?.data?.message || err.message || 'Fehler beim Laden der Bilanz');
      } finally {
        setLoading(false);
      }
    };

    loadConsolidated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [financialStatementId]);

  // Determine which balance sheet to use
  const balanceSheet = consolidatedBalanceSheet || beforeBalanceSheet;
  const isConsolidated = !!consolidatedBalanceSheet;
  const hasBefore = !!beforeBalanceSheet;
  const hasAfter = !!consolidatedBalanceSheet;

  // Early return if no financial statement ID
  if (!financialStatementId) {
    return (
      <div className="card">
        <p>Keine Jahresabschluss-ID angegeben.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card">
        <div className="loading">
          <div className="loading-spinner"></div>
          <span>Lade Bilanzdaten...</span>
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
      </div>
    );
  }

  if (!balanceSheet) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-title">Keine Bilanzdaten verfügbar</div>
          <div className="empty-state-description">
            Importieren Sie Daten oder führen Sie eine Konsolidierung durch.
          </div>
        </div>
      </div>
    );
  }

  // Get chart data based on view type
  const getCurrentChartData = () => {
    if (viewType === 'before' && beforeBalanceSheet) {
      return getChartData(beforeBalanceSheet);
    }
    if (viewType === 'after' && consolidatedBalanceSheet) {
      return getChartData(consolidatedBalanceSheet);
    }
    // Default to consolidated if available, otherwise before
    if (consolidatedBalanceSheet) {
      return getChartData(consolidatedBalanceSheet);
    }
    if (beforeBalanceSheet) {
      return getChartData(beforeBalanceSheet);
    }
    return { assetData: [], liabilityData: [] };
  };

  const { assetData, liabilityData } = getCurrentChartData();
  const treemapData = [
    ...assetData.map(item => ({ name: item.name, value: item.value, category: 'Aktiva' })),
    ...liabilityData.map(item => ({ name: item.name, value: item.value, category: 'Passiva' })),
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const currentBalanceSheet = viewType === 'before' && beforeBalanceSheet 
        ? beforeBalanceSheet 
        : viewType === 'after' && consolidatedBalanceSheet
        ? consolidatedBalanceSheet
        : balanceSheet;
      
      const total = currentBalanceSheet?.assets?.totalAssets || 0;
      const percentage = total > 0 ? ((payload[0].value / total) * 100).toFixed(1) : '0.0';
      
      return (
        <div style={{
          backgroundColor: 'white',
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{payload[0].name}</p>
          <p style={{ margin: '5px 0 0 0', color: payload[0].color }}>
            {formatCurrency(payload[0].value)}
          </p>
          <p style={{ margin: '5px 0 0 0', fontSize: '0.875rem', color: '#666' }}>
            {percentage}%
          </p>
        </div>
      );
    }
    return null;
  };

  // Helper to get chart data from a balance sheet
  const getChartData = (bs: ConsolidatedBalanceSheet | BuiltBalanceSheet) => {
    const getPositionAmount = (pos: BalanceSheetPosition): number => {
      return pos.amount || pos.balance || 0;
    };

    const assetData = [
      {
        name: 'Anlagevermögen',
        value: bs.assets.fixedAssets.reduce((sum, pos) => sum + Math.abs(getPositionAmount(pos)), 0),
        color: COLORS.fixedAssets,
      },
      {
        name: 'Umlaufvermögen',
        value: bs.assets.currentAssets.reduce((sum, pos) => sum + Math.abs(getPositionAmount(pos)), 0),
        color: COLORS.currentAssets,
      },
      {
        name: 'Geschäftswert',
        value: Math.abs(bs.assets.goodwill || 0),
        color: COLORS.goodwill,
      },
      {
        name: 'Aktive Rechnungsabgrenzung',
        value: bs.assets.deferredTaxAssets.reduce((sum, pos) => sum + Math.abs(getPositionAmount(pos)), 0),
        color: COLORS.deferredTaxAssets,
      },
    ].filter(item => item.value > 0);

    const liabilityData = [
      {
        name: 'Eigenkapital',
        value: bs.liabilities.equity.parentCompany.reduce((sum, pos) => sum + Math.abs(getPositionAmount(pos)), 0),
        color: COLORS.equity,
      },
      {
        name: 'Minderheitsanteile',
        value: Math.abs(bs.liabilities.equity.minorityInterests || 0),
        color: COLORS.minorityInterests,
      },
      {
        name: 'Rückstellungen',
        value: bs.liabilities.provisions.reduce((sum, pos) => sum + Math.abs(getPositionAmount(pos)), 0),
        color: COLORS.provisions,
      },
      {
        name: 'Verbindlichkeiten',
        value: bs.liabilities.liabilities.reduce((sum, pos) => sum + Math.abs(getPositionAmount(pos)), 0),
        color: COLORS.liabilities,
      },
      {
        name: 'Passive Rechnungsabgrenzung',
        value: bs.liabilities.deferredTaxLiabilities.reduce((sum, pos) => sum + Math.abs(getPositionAmount(pos)), 0),
        color: COLORS.deferredTaxLiabilities,
      },
    ].filter(item => item.value > 0);

    return { assetData, liabilityData };
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2>Bilanzvisualisierung</h2>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 'var(--spacing-6)', flexWrap: 'wrap', gap: 'var(--spacing-2)' }}>
          {hasBefore && hasAfter && (
            <>
              <button
                onClick={() => setViewType('before')}
                className={`button ${viewType === 'before' ? 'button-primary' : 'button-secondary'}`}
              >
                Vor Konsolidierung
              </button>
              <button
                onClick={() => setViewType('after')}
                className={`button ${viewType === 'after' ? 'button-primary' : 'button-secondary'}`}
              >
                Nach Konsolidierung
              </button>
              <button
                onClick={() => setViewType('both')}
                className={`button ${viewType === 'both' ? 'button-primary' : 'button-secondary'}`}
              >
                Vergleich
              </button>
            </>
          )}
          <button
            onClick={() => setViewMode('pie')}
            className={`button button-sm ${viewMode === 'pie' ? 'button-primary' : 'button-secondary'}`}
          >
            Kreis
          </button>
          <button
            onClick={() => setViewMode('bar')}
            className={`button button-sm ${viewMode === 'bar' ? 'button-primary' : 'button-secondary'}`}
          >
            Balken
          </button>
          <button
            onClick={() => setViewMode('treemap')}
            className={`button button-sm ${viewMode === 'treemap' ? 'button-primary' : 'button-secondary'}`}
          >
            Treemap
          </button>
        </div>
      </div>

      {viewType === 'both' && hasBefore && hasAfter ? (
        <div style={{ marginBottom: 'var(--spacing-6)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)' }}>
            {/* Before Consolidation */}
            <div className="card" style={{ backgroundColor: 'rgba(247, 201, 72, 0.1)', border: '2px solid var(--color-warning)' }}>
              <h3 style={{ marginTop: 0, color: '#b8941f', fontSize: 'var(--font-size-lg)' }}>Vor Konsolidierung</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                <div>
                  <strong>Gesamtvermögen:</strong>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#27ae60' }}>
                    {formatCurrency(beforeBalanceSheet!.assets.totalAssets)}
                  </div>
                </div>
                <div>
                  <strong>Gesamtkapital:</strong>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#e74c3c' }}>
                    {formatCurrency(beforeBalanceSheet!.liabilities.totalLiabilities)}
                  </div>
                </div>
                <div>
                  <strong>Bilanzgleichheit:</strong>
                  <div style={{ 
                    fontSize: '1rem', 
                    fontWeight: 'bold',
                    color: beforeBalanceSheet!.balanceValidation.isBalanced ? '#27ae60' : '#e74c3c'
                  }}>
                    {beforeBalanceSheet!.balanceValidation.isBalanced ? '✓ Ausgeglichen' : '✗ Nicht ausgeglichen'}
                  </div>
                </div>
              </div>
            </div>
            {/* After Consolidation */}
            <div className="card" style={{ backgroundColor: 'rgba(15, 123, 15, 0.1)', border: '2px solid var(--color-success)' }}>
              <h3 style={{ marginTop: 0, color: 'var(--color-success)', fontSize: 'var(--font-size-lg)' }}>Nach Konsolidierung</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                <div>
                  <strong>Gesamtvermögen:</strong>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#27ae60' }}>
                    {formatCurrency(consolidatedBalanceSheet!.assets.totalAssets)}
                  </div>
                </div>
                <div>
                  <strong>Gesamtkapital:</strong>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#e74c3c' }}>
                    {formatCurrency(consolidatedBalanceSheet!.liabilities.totalLiabilities)}
                  </div>
                </div>
                <div>
                  <strong>Bilanzgleichheit:</strong>
                  <div style={{ 
                    fontSize: '1rem', 
                    fontWeight: 'bold',
                    color: consolidatedBalanceSheet!.balanceValidation.isBalanced ? '#27ae60' : '#e74c3c'
                  }}>
                    {consolidatedBalanceSheet!.balanceValidation.isBalanced ? '✓ Ausgeglichen' : '✗ Nicht ausgeglichen'}
                  </div>
                </div>
                {consolidatedBalanceSheet!.consolidationSummary && (
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #ccc' }}>
                    <div style={{ fontSize: '0.875rem' }}>
                      <strong>Eliminierungen:</strong> {consolidatedBalanceSheet!.consolidationSummary.eliminationsApplied}
                    </div>
                    <div style={{ fontSize: '0.875rem' }}>
                      <strong>Eliminierungsbetrag:</strong> {formatCurrency(consolidatedBalanceSheet!.consolidationSummary.totalEliminationAmount)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 'var(--spacing-6)', backgroundColor: 'var(--color-bg-tertiary)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)' }}>
            <div>
              <strong>Gesamtvermögen:</strong>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#27ae60' }}>
                {formatCurrency(balanceSheet!.assets.totalAssets)}
              </div>
            </div>
            <div>
              <strong>Gesamtkapital:</strong>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#e74c3c' }}>
                {formatCurrency(balanceSheet!.liabilities.totalLiabilities)}
              </div>
            </div>
            <div>
              <strong>Bilanzgleichheit:</strong>
              <div style={{ 
                fontSize: '1.2rem', 
                fontWeight: 'bold',
                color: balanceSheet!.balanceValidation.isBalanced ? '#27ae60' : '#e74c3c'
              }}>
                {balanceSheet!.balanceValidation.isBalanced ? '✓ Ausgeglichen' : '✗ Nicht ausgeglichen'}
              </div>
              {!balanceSheet!.balanceValidation.isBalanced && (
                <div style={{ fontSize: '0.875rem', color: '#666' }}>
                  Differenz: {formatCurrency(Math.abs(balanceSheet!.balanceValidation.difference))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!chartsReady && (
        <div className="card" style={{ marginTop: '2rem' }}>
          <p>Initialisiere Diagramme...</p>
        </div>
      )}

      {viewMode === 'pie' && chartsReady && (
        <>
          {viewType === 'both' && hasBefore && hasAfter ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>
              {/* Before Charts */}
              <div>
                <h3 style={{ textAlign: 'center', marginBottom: '1rem', color: '#856404' }}>Vor Konsolidierung</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <h4 style={{ textAlign: 'center', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Aktiva</h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={getChartData(beforeBalanceSheet!).assetData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {getChartData(beforeBalanceSheet!).assetData.map((entry, index) => (
                            <Cell key={`cell-before-asset-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <h4 style={{ textAlign: 'center', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Passiva</h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={getChartData(beforeBalanceSheet!).liabilityData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {getChartData(beforeBalanceSheet!).liabilityData.map((entry, index) => (
                            <Cell key={`cell-before-liab-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              {/* After Charts */}
              <div>
                <h3 style={{ textAlign: 'center', marginBottom: '1rem', color: '#155724' }}>Nach Konsolidierung</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <h4 style={{ textAlign: 'center', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Aktiva</h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={getChartData(consolidatedBalanceSheet!).assetData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {getChartData(consolidatedBalanceSheet!).assetData.map((entry, index) => (
                            <Cell key={`cell-after-asset-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <h4 style={{ textAlign: 'center', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Passiva</h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={getChartData(consolidatedBalanceSheet!).liabilityData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {getChartData(consolidatedBalanceSheet!).liabilityData.map((entry, index) => (
                            <Cell key={`cell-after-liab-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>
              <div>
                <h3 style={{ textAlign: 'center', marginBottom: '1rem' }}>Aktiva</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={assetData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {assetData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h3 style={{ textAlign: 'center', marginBottom: '1rem' }}>Passiva</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={liabilityData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {liabilityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

      {viewMode === 'bar' && chartsReady && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ textAlign: 'center', marginBottom: '1rem' }}>Bilanzstruktur</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={[...assetData, ...liabilityData]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis tickFormatter={(value) => formatCurrency(value)} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="value" fill="#3498db">
                {[...assetData, ...liabilityData].map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {viewMode === 'treemap' && chartsReady && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ textAlign: 'center', marginBottom: '1rem' }}>Bilanzübersicht (Treemap)</h3>
          <ResponsiveContainer width="100%" height={400}>
            <Treemap
              data={treemapData}
              dataKey="value"
              stroke="#fff"
              fill="#8884d8"
              content={({ x, y, width, height, payload }: any) => (
                <g>
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    fill={payload.category === 'Aktiva' ? COLORS.fixedAssets : COLORS.liabilities}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                  <text
                    x={x + width / 2}
                    y={y + height / 2 - 10}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={14}
                    fontWeight="bold"
                  >
                    {payload.name}
                  </text>
                  <text
                    x={x + width / 2}
                    y={y + height / 2 + 10}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={12}
                  >
                    {formatCurrency(payload.value)}
                  </text>
                </g>
              )}
            />
          </ResponsiveContainer>
        </div>
      )}

      {isConsolidated && consolidatedBalanceSheet?.consolidationSummary && (
        <div className="card" style={{ marginTop: 'var(--spacing-8)', backgroundColor: 'var(--color-bg-tertiary)' }}>
          <h3 style={{ marginBottom: 'var(--spacing-4)' }}>Konsolidierungszusammenfassung</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)' }}>
            <div>
              <strong>Einbezogene Unternehmen:</strong> {consolidatedBalanceSheet.consolidationSummary.companiesIncluded}
            </div>
            <div>
              <strong>Eliminierungen:</strong> {consolidatedBalanceSheet.consolidationSummary.eliminationsApplied}
            </div>
            <div>
              <strong>Eliminierungsbetrag:</strong> {formatCurrency(consolidatedBalanceSheet.consolidationSummary.totalEliminationAmount)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BalanceSheetVisualization;
