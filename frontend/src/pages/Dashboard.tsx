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
    return <div className="card">Lade Daten...</div>;
  }

  return (
    <div>
      <h1>Dashboard</h1>
      
      <div className="card">
        <h2>Übersicht</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <h3>Unternehmen</h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3498db' }}>
              {companies.length}
            </p>
          </div>
          <div>
            <h3>Jahresabschlüsse</h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3498db' }}>
              {statements.length}
            </p>
          </div>
          <div>
            <h3>Konsolidiert</h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#27ae60' }}>
              {statements.filter(s => s.status === 'consolidated').length}
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Letzte Jahresabschlüsse</h2>
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
                </td>
                <td>
                  <Link to={`/financial-statements/${statement.id}`}>
                    Details
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CompanyHierarchyTree />
    </div>
  );
}

export default Dashboard;
