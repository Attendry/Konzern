import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ConsolidationEntry } from '../types';
import '../App.css';

interface ConsolidationImpactDashboardProps {
  entries: ConsolidationEntry[];
  summary: any;
}

const ELIMINATION_COLORS: { [key: string]: string } = {
  elimination: '#e74c3c',
  reclassification: '#f39c12',
  capital_consolidation: '#3498db',
  debt_consolidation: '#2ecc71',
  other: '#95a5a6',
};

const ELIMINATION_LABELS: { [key: string]: string } = {
  elimination: 'Eliminierung',
  reclassification: 'Umgliederung',
  capital_consolidation: 'Kapitalkonsolidierung',
  debt_consolidation: 'Schuldenkonsolidierung',
  other: 'Sonstiges',
};

function ConsolidationImpactDashboard({ entries, summary }: ConsolidationImpactDashboardProps) {
  const [chartData, setChartData] = useState<any[]>([]);
  const [barChartData, setBarChartData] = useState<any[]>([]);

  useEffect(() => {
    if (entries && entries.length > 0) {
      processData();
    }
  }, [entries]);

  const processData = () => {
    // Group entries by adjustment type
    const grouped = entries.reduce((acc, entry) => {
      const type = entry.adjustmentType;
      if (!acc[type]) {
        acc[type] = {
          count: 0,
          totalAmount: 0,
          entries: [],
        };
      }
      acc[type].count++;
      acc[type].totalAmount += Math.abs(entry.amount);
      acc[type].entries.push(entry);
      return acc;
    }, {} as Record<string, { count: number; totalAmount: number; entries: ConsolidationEntry[] }>);

    // Prepare pie chart data
    const pieData = Object.entries(grouped).map(([type, data]) => ({
      name: ELIMINATION_LABELS[type] || type,
      value: data.totalAmount,
      count: data.count,
      type: type,
    }));

    // Prepare bar chart data
    const barData = Object.entries(grouped).map(([type, data]) => ({
      name: ELIMINATION_LABELS[type] || type,
      amount: data.totalAmount,
      count: data.count,
      type: type,
    }));

    setChartData(pieData);
    setBarChartData(barData);
  };

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
      const data = payload[0].payload;
      return (
        <div style={{
          backgroundColor: 'white',
          padding: '10px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{data.name}</p>
          <p style={{ margin: '5px 0 0 0', color: payload[0].color }}>
            Betrag: {formatCurrency(data.value || data.amount)}
          </p>
          <p style={{ margin: '5px 0 0 0', fontSize: '0.875rem', color: '#666' }}>
            Anzahl: {data.count}
          </p>
          {summary && (
            <p style={{ margin: '5px 0 0 0', fontSize: '0.875rem', color: '#666' }}>
              Anteil: {((data.value || data.amount) / (summary.totalAmount || 1) * 100).toFixed(1)}%
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (!entries || entries.length === 0) {
    return (
      <div className="card">
        <p>Keine Konsolidierungsbuchungen vorhanden.</p>
      </div>
    );
  }

  const totalAmount = entries.reduce((sum, entry) => sum + Math.abs(entry.amount), 0);

  return (
    <div className="card">
      <h2>Konsolidierungsauswirkungen</h2>

      {/* Summary Cards */}
      {summary && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
            <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Gesamt Buchungen</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3498db' }}>
              {summary.totalEntries || entries.length}
            </div>
          </div>
          <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
            <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Gesamtbetrag</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#27ae60' }}>
              {formatCurrency(summary.totalAmount || totalAmount)}
            </div>
          </div>
          <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
            <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Eliminierungen</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#e74c3c' }}>
              {summary.intercompanyEliminations || 0}
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>
        {/* Pie Chart */}
        <div>
          <h3 style={{ textAlign: 'center', marginBottom: '1rem' }}>Verteilung nach Typ</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={ELIMINATION_COLORS[entry.type] || '#95a5a6'} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart */}
        <div>
          <h3 style={{ textAlign: 'center', marginBottom: '1rem' }}>Beträge nach Typ</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis tickFormatter={(value) => formatCurrency(value)} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="amount" fill="#3498db">
                {barChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={ELIMINATION_COLORS[entry.type] || '#95a5a6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div style={{ marginTop: '2rem' }}>
        <h3>Detaillierte Aufschlüsselung</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          {chartData.map((item) => {
            const percentage = summary ? ((item.value / summary.totalAmount) * 100) : 0;
            return (
              <div
                key={item.type}
                style={{
                  padding: '1rem',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '4px',
                  borderLeft: `4px solid ${ELIMINATION_COLORS[item.type] || '#95a5a6'}`,
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>{item.name}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: ELIMINATION_COLORS[item.type] || '#95a5a6' }}>
                  {formatCurrency(item.value)}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
                  {item.count} Buchungen • {percentage.toFixed(1)}% des Gesamtbetrags
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Eliminations */}
      <div style={{ marginTop: '2rem' }}>
        <h3>Größte Eliminierungen</h3>
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          <table className="table" style={{ fontSize: '0.875rem' }}>
            <thead>
              <tr>
                <th>Konto</th>
                <th>Typ</th>
                <th>Betrag</th>
                <th>Beschreibung</th>
              </tr>
            </thead>
            <tbody>
              {entries
                .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                .slice(0, 10)
                .map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.account?.accountNumber || entry.accountId}</td>
                    <td>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        backgroundColor: ELIMINATION_COLORS[entry.adjustmentType] || '#95a5a6',
                        color: 'white',
                        fontSize: '0.75rem',
                      }}>
                        {ELIMINATION_LABELS[entry.adjustmentType] || entry.adjustmentType}
                      </span>
                    </td>
                    <td style={{ 
                      color: entry.amount < 0 ? '#e74c3c' : '#27ae60',
                      fontWeight: 'bold'
                    }}>
                      {formatCurrency(entry.amount)}
                    </td>
                    <td>{entry.description || '-'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ConsolidationImpactDashboard;
