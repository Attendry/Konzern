import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { companyService } from '../services/companyService';
import { financialStatementService } from '../services/financialStatementService';
import { Company, FinancialStatement } from '../types';
import CompanyHierarchyTree from '../components/CompanyHierarchyTree';
import { MetricCard } from '../components/MetricCard';
import { MetricCardSkeleton } from '../components/Skeleton';
import { AdvancedTable, TableColumn } from '../components/AdvancedTable';
import { Tooltip } from '../components/Tooltip';
import { SmartSuggestions, useSmartSuggestions } from '../components/SmartSuggestions';
import { ContextualHelp } from '../components/ContextualHelp';
import { ConsolidationStatusDashboard } from '../components/ConsolidationStatusDashboard';
import '../App.css';

function Dashboard() {
  const navigate = useNavigate();
  const { suggestions, addSuggestion, removeSuggestion } = useSmartSuggestions();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [statements, setStatements] = useState<FinancialStatement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  // Add smart suggestions based on data state
  useEffect(() => {
    if (!loading) {
      // Clear existing suggestions
      const currentSuggestions = [...suggestions];
      currentSuggestions.forEach(s => removeSuggestion(s.id));

      // Add contextual suggestions
      if (companies.length === 0) {
        addSuggestion({
          id: 'no-companies',
          message: 'Sie haben noch keine Unternehmen erstellt. Erstellen Sie Ihr erstes Unternehmen, um zu beginnen.',
          type: 'tip',
          action: {
            label: 'Unternehmen erstellen',
            onClick: () => navigate('/companies'),
          },
        });
      }

      if (statements.length === 0 && companies.length > 0) {
        addSuggestion({
          id: 'no-statements',
          message: 'Sie haben noch keine Jahresabschlüsse. Importieren Sie Daten oder erstellen Sie einen neuen Jahresabschluss.',
          type: 'info',
          action: {
            label: 'Daten importieren',
            onClick: () => navigate('/import'),
          },
        });
      }

      if (statements.length > 0) {
        const unconsolidated = statements.filter(s => s.status !== 'consolidated');
        if (unconsolidated.length > 0) {
          addSuggestion({
            id: 'unconsolidated',
            message: `${unconsolidated.length} Jahresabschluss${unconsolidated.length > 1 ? 'se' : ''} ${unconsolidated.length > 1 ? 'sind' : 'ist'} noch nicht konsolidiert.`,
            type: 'info',
            action: {
              label: 'Zur Konsolidierung',
              onClick: () => navigate('/consolidation'),
            },
          });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, companies.length, statements.length]);

  const loadData = async () => {
    try {
      const [companiesData, statementsData] = await Promise.all([
        companyService.getAll(),
        financialStatementService.getAll(),
      ]);
      setCompanies(companiesData);
      setStatements(statementsData);
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
    } finally {
      setLoading(false);
    }
  };

  const consolidatedCount = statements.filter(s => s.status === 'consolidated').length;

  const statementColumns: TableColumn<FinancialStatement>[] = [
    {
      id: 'company',
      header: 'Unternehmen',
      accessor: (row) => row.company?.name || 'Unbekannt',
      sortable: true,
    },
    {
      id: 'fiscalYear',
      header: 'Geschäftsjahr',
      accessor: (row) => row.fiscalYear,
      sortable: true,
      align: 'center',
    },
    {
      id: 'status',
      header: 'Status',
      accessor: (row) => row.status,
      sortable: true,
      render: (value, row) => {
        const statusClass =
          value === 'consolidated' ? 'badge-success' :
          value === 'finalized' ? 'badge-warning' :
          'badge-neutral';
        const statusLabels: Record<string, string> = {
          consolidated: 'Konsolidiert',
          finalized: 'Abgeschlossen',
          draft: 'Entwurf',
          imported: 'Importiert',
        };
        const tooltipContent: Record<string, string> = {
          consolidated: 'Konzernabschluss anzeigen',
          finalized: 'Zur Konsolidierung',
          draft: 'Daten vervollstaendigen',
          imported: 'Zur Konsolidierung',
        };
        const handleStatusClick = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (value === 'consolidated') {
            navigate(`/konzernabschluss/${row.id}`);
          } else {
            navigate('/consolidation');
          }
        };
        return (
          <Tooltip content={tooltipContent[value] || 'Details anzeigen'} position="top">
            <span 
              className={`badge ${statusClass} badge-clickable`}
              onClick={handleStatusClick}
              style={{ cursor: 'pointer' }}
            >
              {statusLabels[value] || value}
            </span>
          </Tooltip>
        );
      },
    },
    {
      id: 'actions',
      header: 'Aktionen',
      accessor: () => '',
      render: (_, row) => (
        <Tooltip content="Details anzeigen" position="top">
          <button
            className="button button-tertiary button-sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/financial-statements/${row.id}`);
            }}
          >
            Details
          </button>
        </Tooltip>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-6)' }}>
        <h1>Dashboard</h1>
        <ContextualHelp
          helpId="dashboard-overview"
          title="Dashboard Übersicht"
          content="Das Dashboard zeigt eine Übersicht über alle Unternehmen, Jahresabschlüsse und den Konsolidierungsstatus. Verwenden Sie Cmd+K (Mac) oder Ctrl+K (Windows/Linux) für schnelle Navigation."
        >
          <span></span>
        </ContextualHelp>
      </div>

      <SmartSuggestions suggestions={suggestions} maxVisible={3} autoDismiss={false} />
      
      <div className="card">
        <div className="card-header">
          <h2>Übersicht</h2>
        </div>
        {loading ? (
          <MetricCardSkeleton count={3} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)' }}>
            <MetricCard
              label="Unternehmen"
              value={companies.length}
              color="var(--color-accent-blue)"
              onClick={() => navigate('/companies')}
              subtitle="Unternehmensverwaltung"
            />
            <MetricCard
              label="Jahresabschluesse"
              value={statements.length}
              color="var(--color-accent-blue)"
              onClick={() => navigate('/import')}
              subtitle="Daten importieren"
            />
            <MetricCard
              label="Konsolidiert"
              value={consolidatedCount}
              color="var(--color-success)"
              onClick={() => navigate('/consolidation')}
              subtitle="Konsolidierung anzeigen"
            />
          </div>
        )}
      </div>

      {/* Consolidation Status Dashboard */}
      {companies.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>Konsolidierungsstatus</h2>
          </div>
          <ConsolidationStatusDashboard />
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2>Letzte Jahresabschlüsse</h2>
        </div>
        <AdvancedTable
          data={statements.slice(0, 10)}
          columns={statementColumns}
          loading={loading}
          emptyMessage="Keine Jahresabschlüsse vorhanden"
          onRowClick={(row) => navigate(`/financial-statements/${row.id}`)}
        />
      </div>

      <CompanyHierarchyTree 
        onCompanyClick={(companyId) => navigate(`/companies?edit=${companyId}`)}
      />
    </div>
  );
}

export default Dashboard;
