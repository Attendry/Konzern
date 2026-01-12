import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { financialStatementService } from '../services/financialStatementService';
import { FinancialStatement as FinancialStatementType, AccountBalance } from '../types';
import BalanceSheetVisualization from '../components/BalanceSheetVisualization';
import ErrorBoundary from '../components/ErrorBoundary';
import '../App.css';

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
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <span>Lade Jahresabschluss...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-header">
          <h2>Fehler</h2>
        </div>
        <div className="error-message">
          {error}
        </div>
        <button onClick={loadData} className="button button-primary" style={{ marginTop: 'var(--spacing-4)' }}>
          Erneut versuchen
        </button>
      </div>
    );
  }

  if (!statement) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-title">Jahresabschluss nicht gefunden</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>Jahresabschluss</h1>

      <div className="card">
        <div className="card-header">
          <h2>Details</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)' }}>
          <div>
            <div className="metric-label">Unternehmen</div>
            <div style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' }}>
              {statement.company?.name || 'Unbekannt'}
            </div>
          </div>
          <div>
            <div className="metric-label">Geschäftsjahr</div>
            <div style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' }}>
              {statement.fiscalYear}
            </div>
          </div>
          <div>
            <div className="metric-label">Von</div>
            <div style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' }}>
              {new Date(statement.periodStart).toLocaleDateString('de-DE')}
            </div>
          </div>
          <div>
            <div className="metric-label">Bis</div>
            <div style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' }}>
              {new Date(statement.periodEnd).toLocaleDateString('de-DE')}
            </div>
          </div>
          <div>
            <div className="metric-label">Status</div>
            <span className={`badge ${
              statement.status === 'consolidated' ? 'badge-success' : 
              statement.status === 'finalized' ? 'badge-warning' : 
              'badge-neutral'
            }`}>
              {statement.status}
            </span>
          </div>
        </div>
      </div>

      <ErrorBoundary>
        <BalanceSheetVisualization 
          financialStatementId={statement.id}
          financialStatement={statement}
          accountBalances={balances}
        />
      </ErrorBoundary>

      <div className="card">
        <div className="card-header">
          <h2>Kontensalden ({balances.length})</h2>
        </div>
        {balances.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">Keine Kontensalden vorhanden</div>
            <div className="empty-state-description">
              Importieren Sie Daten, um Kontensalden anzuzeigen.
            </div>
          </div>
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
