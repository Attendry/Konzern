import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { financialStatementService } from '../services/financialStatementService';
import { FinancialStatement as FinancialStatementType, AccountBalance } from '../types';
import BalanceSheetVisualization from '../components/BalanceSheetVisualization';
import ErrorBoundary from '../components/ErrorBoundary';
import { useAIChat } from '../contexts/AIChatContext';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { QuickActions } from '../components/QuickActions';
import { RelatedLinks } from '../components/RelatedLinks';
import { useAuth } from '../contexts/AuthContext';
import '../App.css';

function FinancialStatement() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setFinancialStatementId } = useAIChat();
  const [statement, setStatement] = useState<FinancialStatementType | null>(null);
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Set AI chatbot context when viewing a financial statement
  useEffect(() => {
    if (id) {
      setFinancialStatementId(id);
    }
    return () => setFinancialStatementId(null); // Cleanup on unmount
  }, [id, setFinancialStatementId]);

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
      <div>
        <Breadcrumbs
          items={[
            { label: 'Dashboard', to: '/' },
            { label: 'Jahresabschlüsse', to: '/financial-statements' },
            { label: 'Lade...' }
          ]}
        />
        <LoadingState type="card" count={3} message="Lade Jahresabschluss..." />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Breadcrumbs
          items={[
            { label: 'Dashboard', to: '/' },
            { label: 'Jahresabschlüsse', to: '/financial-statements' },
            { label: 'Fehler' }
          ]}
        />
        <ErrorState
          error={error}
          onRetry={loadData}
          context={{
            page: 'FinancialStatement',
            financialStatementId: id || undefined,
          }}
          alternativeActions={[
            {
              label: 'Zum Dashboard',
              onClick: () => navigate('/')
            }
          ]}
        />
      </div>
    );
  }

  if (!statement) {
    return (
      <div>
        <Breadcrumbs
          items={[
            { label: 'Dashboard', to: '/' },
            { label: 'Jahresabschlüsse', to: '/financial-statements' },
            { label: 'Nicht gefunden' }
          ]}
        />
        <EmptyState
          icon="📄"
          title="Jahresabschluss nicht gefunden"
          description="Der angeforderte Jahresabschluss konnte nicht gefunden werden."
          primaryAction={{
            label: "Zum Dashboard",
            onClick: () => navigate('/')
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/' },
          { label: 'Jahresabschlüsse', to: '/financial-statements' },
          { label: `${statement.company?.name || 'Unbekannt'} - ${statement.fiscalYear}` }
        ]}
      />
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

      {/* Quick Actions */}
      {statement && (
        <QuickActions
          actions={[
            {
              id: 'consolidate',
              label: 'Konsolidieren',
              icon: '🔄',
              onClick: () => navigate(`/consolidation?statementId=${statement.id}`),
              requiredRoles: ['admin', 'editor'],
              tooltip: 'Konsolidierung für diesen Jahresabschluss durchführen',
            },
            {
              id: 'export',
              label: 'Exportieren',
              icon: '📥',
              onClick: async () => {
                // TODO: Implement export functionality
                console.log('Export functionality to be implemented');
              },
              tooltip: 'Jahresabschluss exportieren',
            },
            {
              id: 'view-notes',
              label: 'Konzernanhang',
              icon: '📄',
              onClick: () => navigate(`/consolidated-notes/${statement.id}`),
              tooltip: 'Konzernanhang anzeigen',
            },
            {
              id: 'view-lineage',
              label: 'Prüfpfad',
              icon: '🔗',
              onClick: () => navigate(`/data-lineage/${statement.id}`),
              tooltip: 'Datenherkunft und Prüfpfad anzeigen',
            },
          ]}
          position="inline"
          className="quick-actions-section"
        />
      )}

      {/* Related Links */}
      {statement && (
        <RelatedLinks
          links={[
            {
              label: 'Unternehmensverwaltung',
              to: `/companies?edit=${statement.companyId}`,
              icon: '🏢',
              description: 'Unternehmensdetails anzeigen',
            },
            {
              label: 'Konsolidierung',
              to: `/consolidation?statementId=${statement.id}`,
              icon: '🔄',
              description: 'Zur Konsolidierung',
            },
            {
              label: 'Konzernanhang',
              to: `/consolidated-notes/${statement.id}`,
              icon: '📄',
              description: 'Konzernanhang anzeigen',
            },
            {
              label: 'Plausibilitätsprüfungen',
              to: `/plausibility-checks/${statement.id}`,
              icon: '✅',
              description: 'Prüfungen für diesen Jahresabschluss',
              requiredRoles: ['admin', 'auditor'],
            },
            {
              label: 'Datenherkunft',
              to: `/data-lineage/${statement.id}`,
              icon: '🔗',
              description: 'Prüfpfad anzeigen',
            },
          ]}
        />
      )}
    </div>
  );
}

export default FinancialStatement;
