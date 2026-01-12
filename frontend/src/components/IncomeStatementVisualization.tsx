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
        <p>Lade GuV-Daten...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ backgroundColor: '#fee', border: '1px solid #fcc' }}>
        <p style={{ color: '#c33' }}>Fehler: {error}</p>
        <button onClick={loadIncomeStatement} style={{ marginTop: '1rem' }}>
          Erneut laden
        </button>
      </div>
    );
  }

  if (!incomeStatement) {
    return (
      <div className="card">
        <p>Keine GuV-Daten verfügbar.</p>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2>Konsolidierte Gewinn- und Verlustrechnung (GuV)</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setViewMode('before')}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: viewMode === 'before' ? '#f39c12' : 'white',
              color: viewMode === 'before' ? 'white' : '#333',
              cursor: 'pointer',
            }}
          >
            Vor Konsolidierung
          </button>
          <button
            onClick={() => setViewMode('after')}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: viewMode === 'after' ? '#27ae60' : 'white',
              color: viewMode === 'after' ? 'white' : '#333',
              cursor: 'pointer',
            }}
          >
            Nach Konsolidierung
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Konsolidierter Umsatz</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: COLORS.revenue }}>
            {formatCurrency(incomeStatement.revenue.consolidated)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
            Eliminiert: {formatCurrency(incomeStatement.revenue.intercompanyEliminated)}
          </div>
        </div>
        <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Ergebnis vor Steuern</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: incomeStatement.incomeBeforeTax >= 0 ? COLORS.netIncome : '#e74c3c' }}>
            {formatCurrency(incomeStatement.incomeBeforeTax)}
          </div>
        </div>
        <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Jahresüberschuss</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: COLORS.netIncome }}>
            {formatCurrency(incomeStatement.netIncome.consolidated)}
          </div>
        </div>
        <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Minderheitsanteile</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#e74c3c' }}>
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
      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
        <h3>Eliminierungen</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
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
      <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#e8f5e9', borderRadius: '4px' }}>
        <h3>Konsolidierungszusammenfassung</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
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
