import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { companyService } from '../services/companyService';
import { financialStatementService } from '../services/financialStatementService';
import { Company, FinancialStatement } from '../types';
import CompanyHierarchyTree from '../components/CompanyHierarchyTree';
import '../App.css';

function Dashboard() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [statements, setStatements] = useState<FinancialStatement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

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

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <span>Lade Daten...</span>
      </div>
    );
  }

  const consolidatedCount = statements.filter(s => s.status === 'consolidated').length;

  return (
    <div>
      <h1>Dashboard</h1>
      
      <div className="card">
        <div className="card-header">
          <h2>Übersicht</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)' }}>
          <div className="metric-card">
            <div className="metric-label">Unternehmen</div>
            <div className="metric-value" style={{ color: 'var(--color-accent-blue)' }}>
              {companies.length}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Jahresabschlüsse</div>
            <div className="metric-value" style={{ color: 'var(--color-accent-blue)' }}>
              {statements.length}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Konsolidiert</div>
            <div className="metric-value" style={{ color: 'var(--color-success)' }}>
              {consolidatedCount}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Letzte Jahresabschlüsse</h2>
        </div>
        {statements.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">Keine Jahresabschlüsse vorhanden</div>
            <div className="empty-state-description">
              Erstellen Sie einen neuen Jahresabschluss oder importieren Sie Daten.
            </div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Unternehmen</th>
                <th>Geschäftsjahr</th>
                <th>Status</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {statements.slice(0, 5).map((statement) => (
                <tr key={statement.id}>
                  <td>{statement.company?.name || 'Unbekannt'}</td>
                  <td>{statement.fiscalYear}</td>
                  <td>
                    <span className={`badge ${
                      statement.status === 'consolidated' ? 'badge-success' : 
                      statement.status === 'finalized' ? 'badge-warning' : 
                      'badge-neutral'
                    }`}>
                      {statement.status}
                    </span>
                  </td>
                  <td>
                    <Link to={`/financial-statements/${statement.id}`} className="button button-tertiary button-sm">
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CompanyHierarchyTree />
    </div>
  );
}

export default Dashboard;
