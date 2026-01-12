import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { incomeStatementService, ConsolidatedIncomeStatement } from '../services/incomeStatementService';
import '../App.css';

interface IncomeStatementVisualizationProps {
  financialStatementId: string;
}

const COLORS = {
  revenue: '#27ae60',
  costOfSales: '#e74c3c',
  operatingExpenses: '#f39c12',
  financialResult: '#3498db',
  incomeTax: '#9b59b6',
  netIncome: '#2ecc71',
};

function IncomeStatementVisualization({ financialStatementId }: IncomeStatementVisualizationProps) {
  const [incomeStatement, setIncomeStatement] = useState<ConsolidatedIncomeStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'before' | 'after'>('after');

  useEffect(() => {
    if (financialStatementId) {
      loadIncomeStatement();
    }
  }, [financialStatementId]);

  const loadIncomeStatement = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await incomeStatementService.consolidate(financialStatementId);
      setIncomeStatement(data);
    } catch (err: any) {
      console.error('Error loading income statement:', err);
      setError(err.response?.data?.message || err.message || 'Fehler beim Laden der GuV');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="loading">
          <div className="loading-spinner"></div>
          <span>Lade GuV-Daten...</span>
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
        <button onClick={loadIncomeStatement} className="button button-primary" style={{ marginTop: 'var(--spacing-4)' }}>
          Erneut laden
        </button>
      </div>
    );
  }

  if (!incomeStatement) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-title">Keine GuV-Daten verfügbar</div>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Prepare chart data
  const chartData = [
    {
      name: 'Umsatzerlöse',
      vor: incomeStatement.revenue.total,
      nach: incomeStatement.revenue.consolidated,
      eliminated: incomeStatement.revenue.intercompanyEliminated,
    },
    {
      name: 'Herstellungskosten',
      vor: incomeStatement.costOfSales.total,
      nach: incomeStatement.costOfSales.consolidated,
      eliminated: incomeStatement.costOfSales.intercompanyEliminated,
    },
    {
      name: 'Betriebsaufwendungen',
      vor: incomeStatement.operatingExpenses.total,
      nach: incomeStatement.operatingExpenses.consolidated,
      eliminated: incomeStatement.operatingExpenses.intercompanyEliminated,
    },
    {
      name: 'Finanzergebnis',
      vor: incomeStatement.financialResult.total,
      nach: incomeStatement.financialResult.consolidated,
      eliminated: incomeStatement.financialResult.intercompanyEliminated,
    },
    {
      name: 'Ergebnis vor Steuern',
      vor: incomeStatement.revenue.total - incomeStatement.costOfSales.total - incomeStatement.operatingExpenses.total + incomeStatement.financialResult.total,
      nach: incomeStatement.incomeBeforeTax,
      eliminated: 0,
    },
    {
      name: 'Steuern',
      vor: incomeStatement.incomeTax.total,
      nach: incomeStatement.incomeTax.consolidated,
      eliminated: 0,
    },
    {
      name: 'Jahresüberschuss',
      vor: incomeStatement.netIncome.total,
      nach: incomeStatement.netIncome.consolidated,
      eliminated: 0,
    },
  ];

  const pieData = [
    {
      name: 'Mutterunternehmen',
      value: incomeStatement.netIncome.parentCompany,
      color: COLORS.netIncome,
    },
    {
      name: 'Minderheitsanteile',
      value: incomeStatement.netIncome.minorityInterests,
      color: '#e74c3c',
    },
  ].filter(item => item.value > 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'white',
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{payload[0].payload.name}</p>
          {payload.map((p: any, index: number) => (
            <p key={index} style={{ margin: '5px 0 0 0', color: p.color }}>
              {p.name}: {formatCurrency(p.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--spacing-4)' }}>
        <h2>Konsolidierte Gewinn- und Verlustrechnung (GuV)</h2>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
          <button
            onClick={() => setViewMode('before')}
            className={`button button-sm ${viewMode === 'before' ? 'button-primary' : 'button-secondary'}`}
          >
            Vor Konsolidierung
          </button>
          <button
            onClick={() => setViewMode('after')}
            className={`button button-sm ${viewMode === 'after' ? 'button-primary' : 'button-secondary'}`}
          >
            Nach Konsolidierung
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: 'var(--spacing-4)',
        marginBottom: 'var(--spacing-8)'
      }}>
        <div className="metric-card">
          <div className="metric-label">Konsolidierter Umsatz</div>
          <div className="metric-value" style={{ color: COLORS.revenue }}>
            {formatCurrency(incomeStatement.revenue.consolidated)}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--spacing-2)' }}>
            Eliminiert: {formatCurrency(incomeStatement.revenue.intercompanyEliminated)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Ergebnis vor Steuern</div>
          <div className="metric-value" style={{ color: incomeStatement.incomeBeforeTax >= 0 ? COLORS.netIncome : 'var(--color-error)' }}>
            {formatCurrency(incomeStatement.incomeBeforeTax)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Jahresüberschuss</div>
          <div className="metric-value" style={{ color: COLORS.netIncome }}>
            {formatCurrency(incomeStatement.netIncome.consolidated)}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Minderheitsanteile</div>
          <div className="metric-value" style={{ color: 'var(--color-error)' }}>
            {formatCurrency(incomeStatement.netIncome.minorityInterests)}
          </div>
        </div>
      </div>

      {/* Bar Chart */}
      <div style={{ marginBottom: '2rem' }}>
        <h3>GuV-Vergleich</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
            <YAxis tickFormatter={(value) => formatCurrency(value)} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {viewMode === 'before' ? (
              <Bar dataKey="vor" fill={COLORS.revenue} name="Vor Konsolidierung" />
            ) : (
              <>
                <Bar dataKey="nach" fill={COLORS.netIncome} name="Nach Konsolidierung" />
                {chartData.some(d => d.eliminated !== 0) && (
                  <Bar dataKey="eliminated" fill="#95a5a6" name="Eliminiert" />
                )}
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Net Income Allocation */}
      {pieData.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3>Aufteilung Jahresüberschuss</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Eliminations Summary */}
      <div className="card" style={{ marginTop: 'var(--spacing-8)', backgroundColor: 'var(--color-bg-tertiary)' }}>
        <h3 style={{ marginBottom: 'var(--spacing-4)' }}>Eliminierungen</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)' }}>
          <div>
            <strong>Zwischenumsätze:</strong> {formatCurrency(incomeStatement.eliminations.intercompanyRevenue)}
          </div>
          <div>
            <strong>Zwischenaufwendungen:</strong> {formatCurrency(incomeStatement.eliminations.intercompanyExpenses)}
          </div>
          <div>
            <strong>Zwischengewinne:</strong> {formatCurrency(incomeStatement.eliminations.intercompanyProfits)}
          </div>
          <div>
            <strong>Zwischenzinsen:</strong> {formatCurrency(incomeStatement.eliminations.intercompanyInterest)}
          </div>
          <div>
            <strong>Gesamt eliminiert:</strong> {formatCurrency(incomeStatement.eliminations.total)}
          </div>
        </div>
      </div>

      {/* Consolidation Summary */}
      <div className="card" style={{ marginTop: 'var(--spacing-4)', backgroundColor: 'rgba(15, 123, 15, 0.1)', border: '1px solid var(--color-success)' }}>
        <h3 style={{ marginBottom: 'var(--spacing-4)' }}>Konsolidierungszusammenfassung</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)' }}>
          <div>
            <strong>Einbezogene Unternehmen:</strong> {incomeStatement.consolidationSummary.companiesIncluded}
          </div>
          <div>
            <strong>Eliminierungen:</strong> {incomeStatement.consolidationSummary.eliminationsApplied}
          </div>
        </div>
      </div>
    </div>
  );
}

export default IncomeStatementVisualization;
