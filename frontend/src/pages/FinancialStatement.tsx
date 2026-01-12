import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { financialStatementService } from '../services/financialStatementService';
import { FinancialStatement as FinancialStatementType, AccountBalance } from '../types';
import ErrorBoundary from '../components/ErrorBoundary';
import '../App.css';

// Lazy load BalanceSheetVisualization to avoid initialization issues
const BalanceSheetVisualization = lazy(() => import('../components/BalanceSheetVisualization'));

function FinancialStatement() {
  const { id } = useParams<{ id: string }>();
  const [statement, setStatement] = useState<FinancialStatementType | null>(null);
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const [statementData, balancesData] = await Promise.all([
        financialStatementService.getById(id),
        financialStatementService.getBalances(id),
      ]);
      setStatement(statementData);
      setBalances(balancesData);
    } catch (err: any) {
      console.error('Fehler beim Laden der Daten:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Fehler beim Laden der Daten';
      setError(errorMessage);
      // If it's a 404, we can show a more specific message
      if (err.response?.status === 404) {
        setError('Jahresabschluss nicht gefunden');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id, loadData]);

  if (loading) {
    return <div className="card">Lade Jahresabschluss...</div>;
  }

  if (error) {
    return (
      <div className="card">
        <h2>Fehler</h2>
        <p>{error}</p>
        <button onClick={loadData} style={{ marginTop: '1rem' }}>
          Erneut versuchen
        </button>
      </div>
    );
  }

  if (!statement) {
    return <div className="card">Jahresabschluss nicht gefunden</div>;
  }

  return (
    <div>
      <h1>Jahresabschluss</h1>

      <div className="card">
        <h2>Details</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <strong>Unternehmen:</strong> {statement.company?.name || 'Unbekannt'}
          </div>
          <div>
            <strong>Geschäftsjahr:</strong> {statement.fiscalYear}
          </div>
          <div>
            <strong>Von:</strong> {new Date(statement.periodStart).toLocaleDateString('de-DE')}
          </div>
          <div>
            <strong>Bis:</strong> {new Date(statement.periodEnd).toLocaleDateString('de-DE')}
          </div>
          <div>
            <strong>Status:</strong>{' '}
            <span style={{
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              backgroundColor: statement.status === 'consolidated' ? '#27ae60' : 
                             statement.status === 'finalized' ? '#f39c12' : '#95a5a6',
              color: 'white',
              fontSize: '0.875rem'
            }}>
              {statement.status}
            </span>
          </div>
        </div>
      </div>

      <ErrorBoundary>
        <Suspense fallback={<div className="card">Lade Visualisierung...</div>}>
          <BalanceSheetVisualization 
            financialStatementId={statement.id}
            financialStatement={statement}
            accountBalances={balances}
          />
        </Suspense>
      </ErrorBoundary>

      <div className="card">
        <h2>Kontensalden ({balances.length})</h2>
        {balances.length === 0 ? (
          <p>Keine Kontensalden vorhanden.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Kontonummer</th>
                <th>Kontoname</th>
                <th>Soll</th>
                <th>Haben</th>
                <th>Saldo</th>
                <th>Zwischengesellschaft</th>
              </tr>
            </thead>
            <tbody>
              {balances.map((balance) => (
                <tr key={balance.id}>
                  <td>{balance.account?.accountNumber || '-'}</td>
                  <td>{balance.account?.name || '-'}</td>
                  <td>{Number(balance.debit).toLocaleString('de-DE', {
                    style: 'currency',
                    currency: 'EUR'
                  })}</td>
                  <td>{Number(balance.credit).toLocaleString('de-DE', {
                    style: 'currency',
                    currency: 'EUR'
                  })}</td>
                  <td style={{ fontWeight: 'bold' }}>
                    {Number(balance.balance).toLocaleString('de-DE', {
                      style: 'currency',
                      currency: 'EUR'
                    })}
                  </td>
                  <td>{balance.isIntercompany ? 'Ja' : 'Nein'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default FinancialStatement;
