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

  useEffect(() => {
    if (financialStatementId) {
      loadData();
    }
  }, [financialStatementId, accountBalances, financialStatement]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build balance sheet from uploaded account balances (before consolidation)
      if (accountBalances && accountBalances.length > 0 && financialStatement) {
        const before = buildBalanceSheetFromBalances(
          accountBalances,
          financialStatement.fiscalYear,
          financialStatement.periodStart,
          financialStatement.periodEnd
        );
        setBeforeBalanceSheet(before);
      }

      // Try to load consolidated balance sheet (after consolidation)
      try {
        const response = await api.get<ConsolidatedBalanceSheet>(
          `/consolidation/balance-sheet/${financialStatementId}`
        );
        setConsolidatedBalanceSheet(response.data);
        // If we have both, default to 'both' view, otherwise 'after'
        if (beforeBalanceSheet || (accountBalances && accountBalances.length > 0)) {
          setViewType('both');
        } else {
          setViewType('after');
        }
      } catch (consolidatedErr: any) {
        // If consolidated balance sheet doesn't exist, that's okay - we'll show before only
        console.log('No consolidated balance sheet available, showing uploaded data only');
        if (beforeBalanceSheet || (accountBalances && accountBalances.length > 0)) {
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

  // Determine which balance sheet to use
  const balanceSheet = consolidatedBalanceSheet || beforeBalanceSheet;
  const isConsolidated = !!consolidatedBalanceSheet;
  const hasBefore = !!beforeBalanceSheet;
  const hasAfter = !!consolidatedBalanceSheet;

  if (loading) {
    return (
      <div className="card">
        <p>Lade Bilanzdaten...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ backgroundColor: '#fee', border: '1px solid #fcc' }}>
        <p style={{ color: '#c33' }}>Fehler: {error}</p>
      </div>
    );
  }

  if (!balanceSheet) {
    return (
      <div className="card">
        <p>Keine Bilanzdaten verfügbar.</p>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2>Bilanzvisualisierung</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {hasBefore && hasAfter && (
            <>
              <button
                onClick={() => setViewType('before')}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: viewType === 'before' ? '#f39c12' : 'white',
                  color: viewType === 'before' ? 'white' : '#333',
                  cursor: 'pointer',
                }}
              >
                Vor Konsolidierung
              </button>
              <button
                onClick={() => setViewType('after')}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: viewType === 'after' ? '#27ae60' : 'white',
                  color: viewType === 'after' ? 'white' : '#333',
                  cursor: 'pointer',
                }}
              >
                Nach Konsolidierung
              </button>
              <button
                onClick={() => setViewType('both')}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: viewType === 'both' ? '#3498db' : 'white',
                  color: viewType === 'both' ? 'white' : '#333',
                  cursor: 'pointer',
                }}
              >
                Vergleich
              </button>
            </>
          )}
          <button
            onClick={() => setViewMode('pie')}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: viewMode === 'pie' ? '#3498db' : 'white',
              color: viewMode === 'pie' ? 'white' : '#333',
              cursor: 'pointer',
            }}
          >
            Kreis
          </button>
          <button
            onClick={() => setViewMode('bar')}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: viewMode === 'bar' ? '#3498db' : 'white',
              color: viewMode === 'bar' ? 'white' : '#333',
              cursor: 'pointer',
            }}
          >
            Balken
          </button>
          <button
            onClick={() => setViewMode('treemap')}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: viewMode === 'treemap' ? '#3498db' : 'white',
              color: viewMode === 'treemap' ? 'white' : '#333',
              cursor: 'pointer',
            }}
          >
            Treemap
          </button>
        </div>
      </div>

      {viewType === 'both' && hasBefore && hasAfter ? (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Before Consolidation */}
            <div style={{ padding: '1rem', backgroundColor: '#fff3cd', borderRadius: '4px', border: '2px solid #f39c12' }}>
              <h3 style={{ marginTop: 0, color: '#856404' }}>Vor Konsolidierung</h3>
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
            <div style={{ padding: '1rem', backgroundColor: '#d4edda', borderRadius: '4px', border: '2px solid #27ae60' }}>
              <h3 style={{ marginTop: 0, color: '#155724' }}>Nach Konsolidierung</h3>
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
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
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

      {viewMode === 'pie' && (
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
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
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
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
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
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
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
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
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
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
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
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
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

      {viewMode === 'bar' && (
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

      {viewMode === 'treemap' && (
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
        <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <h3>Konsolidierungszusammenfassung</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
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
