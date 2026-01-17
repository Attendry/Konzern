import { useMemo } from 'react';
import { Company, FinancialStatement, AccountBalance } from '../types';
import { AdvancedTable, TableColumn } from './AdvancedTable';
import CompanyHierarchyTree from './CompanyHierarchyTree';
import '../App.css';

interface CompanyHierarchy {
  id: string;
  name: string;
  type: 'parent' | 'subsidiary' | 'standalone';
  parentCompanyId: string | null;
  children: CompanyHierarchy[];
  participationPercentage?: number;
}

interface CompanyGroupSectionProps {
  parentCompany: Company;
  companies: Company[];
  hierarchyData: CompanyHierarchy | null;
  companyData: Record<string, {
    financialStatements: FinancialStatement[];
    balances: Record<string, AccountBalance[]>;
    allBalances: AccountBalance[];
    loading: boolean;
  }>;
  expandedCompanyId: string | null;
  onToggleCompanyData: (companyId: string) => void;
  onEditCompany: (company: Company) => void;
  onDeleteCompany: (id: string) => void;
  onShowHgbCheck: (company: Company) => void;
  onLoadCompanyData: (companyId: string) => void;
  onNavigateToImport: (companyId: string, financialStatementId?: string) => void;
}

export function CompanyGroupSection({
  parentCompany,
  companies,
  hierarchyData,
  companyData,
  expandedCompanyId,
  onToggleCompanyData,
  onEditCompany,
  onDeleteCompany,
  onShowHgbCheck,
  onLoadCompanyData,
  onNavigateToImport,
}: CompanyGroupSectionProps) {

  const companyColumns: TableColumn<Company>[] = useMemo(() => [
    {
      id: 'name',
      header: 'Name',
      accessor: (row) => row.name,
      sortable: true,
    },
    {
      id: 'parentCompany',
      header: 'Mutterunternehmen',
      accessor: (row) => {
        if (row.id === parentCompany.id) return '-';
        const parent = companies.find((c) => c.id === row.parentCompanyId);
        return parent ? parent.name : '-';
      },
      sortable: true,
    },
    {
      id: 'taxId',
      header: 'Steuernummer',
      accessor: (row) => row.taxId || '-',
      sortable: true,
    },
    {
      id: 'legalForm',
      header: 'Rechtsform',
      accessor: (row) => row.legalForm || '-',
      sortable: true,
    },
    {
      id: 'isConsolidated',
      header: 'Konsolidiert',
      accessor: (row) => row.isConsolidated,
      sortable: true,
      align: 'center',
      render: (value) => (
        <span className={`badge ${value ? 'badge-success' : 'badge-neutral'}`}>
          {value ? 'Ja' : 'Nein'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Aktionen',
      accessor: () => '',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
          <button
            className="button button-secondary button-sm"
            onClick={(e) => {
              e.stopPropagation();
              onEditCompany(row);
            }}
          >
            Bearbeiten
          </button>
          <button
            className="button button-tertiary button-sm"
            onClick={(e) => {
              e.stopPropagation();
              onShowHgbCheck(row);
            }}
          >
            HGB-Prüfung
          </button>
          <button
            className="button button-danger button-sm"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteCompany(row.id);
            }}
          >
            Löschen
          </button>
        </div>
      ),
    },
  ], [companies, parentCompany.id, onEditCompany, onShowHgbCheck, onDeleteCompany]);

  // Calculate summary stats for this group
  const groupStats = useMemo(() => {
    let totalFinancialStatements = 0;
    let totalBalances = 0;
    
    companies.forEach(company => {
      const data = companyData[company.id];
      if (data) {
        totalFinancialStatements += data.financialStatements?.length || 0;
        totalBalances += data.allBalances?.length || 0;
      }
    });
    
    return { totalFinancialStatements, totalBalances };
  }, [companies, companyData]);

  return (
    <div className="card" style={{ marginBottom: 'var(--spacing-6)' }}>
      <div className="card-header" style={{ 
        backgroundColor: 'var(--color-bg-tertiary)',
        borderBottom: '2px solid var(--color-primary)',
        padding: 'var(--spacing-4)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
              <span style={{ fontSize: '1.2rem' }}>🏢</span>
              {parentCompany.name}
              <span className="badge badge-primary" style={{ marginLeft: 'var(--spacing-2)' }}>
                Mutterunternehmen
              </span>
            </h2>
            <div style={{ 
              fontSize: '0.875rem', 
              color: 'var(--color-text-secondary)', 
              marginTop: 'var(--spacing-1)' 
            }}>
              {companies.length} Unternehmen • {groupStats.totalFinancialStatements} Jahresabschlüsse • {groupStats.totalBalances} Kontensalden
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: 'var(--spacing-4)' }}>
        {/* Hierarchy Tree Section */}
        {hierarchyData && (
          <div style={{ marginBottom: 'var(--spacing-4)' }}>
            <h3 style={{ 
              fontSize: '1rem', 
              fontWeight: '600', 
              marginBottom: 'var(--spacing-2)',
              color: 'var(--color-text-primary)'
            }}>
              📊 Konzernstruktur
            </h3>
            <div style={{ 
              padding: 'var(--spacing-3)', 
              backgroundColor: 'var(--color-bg-secondary)', 
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)'
            }}>
              <CompanyHierarchyTree
                selectedCompanyId={null}
                parentCompanyId={parentCompany.id}
                compact={true}
                onCompanyClick={(companyId) => {
                  const company = companies.find(c => c.id === companyId);
                  if (company) {
                    onEditCompany(company);
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* Company Table Section */}
        <div style={{ marginBottom: 'var(--spacing-4)' }}>
          <h3 style={{ 
            fontSize: '1rem', 
            fontWeight: '600', 
            marginBottom: 'var(--spacing-2)',
            color: 'var(--color-text-primary)'
          }}>
            📋 Unternehmen in diesem Konzern ({companies.length})
          </h3>
          <AdvancedTable
            data={companies}
            columns={companyColumns}
            loading={false}
            emptyMessage="Keine Unternehmen in dieser Gruppe"
            onRowClick={(row) => onEditCompany(row)}
          />
        </div>

        {/* Imported Data Section */}
        <div>
          <h3 style={{ 
            fontSize: '1rem', 
            fontWeight: '600', 
            marginBottom: 'var(--spacing-2)',
            color: 'var(--color-text-primary)'
          }}>
            📊 Importierte Daten
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
            {companies.map((company) => {
              const isExpanded = expandedCompanyId === company.id;
              const data = companyData[company.id];
              const totalBalances = data?.allBalances?.length || 0;

              return (
                <div key={company.id} className="card" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      padding: 'var(--spacing-3)',
                    }}
                    onClick={() => onToggleCompanyData(company.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
                      <span style={{ fontSize: '1.2rem' }}>{isExpanded ? '▼' : '▶'}</span>
                      <div>
                        <strong>{company.name}</strong>
                        {company.id !== parentCompany.id && (
                          <span style={{ 
                            fontSize: '0.75rem', 
                            color: 'var(--color-text-secondary)', 
                            marginLeft: 'var(--spacing-2)' 
                          }}>
                            (Tochterunternehmen)
                          </span>
                        )}
                        {data && data.financialStatements && (
                          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
                            {data.financialStatements.length} Jahresabschluss{data.financialStatements.length !== 1 ? 'e' : ''}, {totalBalances} Kontensalden
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ padding: 'var(--spacing-4)', borderTop: '1px solid var(--color-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-3)' }}>
                        <div></div>
                        <button
                          className="button button-secondary button-sm"
                          onClick={() => onLoadCompanyData(company.id)}
                          disabled={data?.loading}
                        >
                          {data?.loading ? 'Lade...' : 'Aktualisieren'}
                        </button>
                      </div>
                      {data?.loading ? (
                        <div className="loading">
                          <div className="loading-spinner"></div>
                          <span>Lade Daten...</span>
                        </div>
                      ) : data ? (
                        <>
                          {data.allBalances && Array.isArray(data.allBalances) && data.allBalances.length > 0 ? (
                            <div>
                              <div style={{ marginBottom: 'var(--spacing-4)', padding: 'var(--spacing-3)', backgroundColor: 'var(--color-bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                                <strong>Audit-Ledger:</strong> Alle importierten Kontensalden für dieses Unternehmen ({data.allBalances.length} Einträge)
                                {data.financialStatements && data.financialStatements.length > 0 && (
                                  <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-2)' }}>
                                    {data.financialStatements.length} Jahresabschluss{data.financialStatements.length !== 1 ? 'e' : ''} gefunden
                                  </div>
                                )}
                              </div>
                              <div style={{ overflowX: 'auto' }}>
                                <table className="table" style={{ fontSize: '0.875rem' }}>
                                  <thead>
                                    <tr>
                                      <th>Kontonummer</th>
                                      <th>Kontoname</th>
                                      <th>Geschäftsjahr</th>
                                      <th>Soll</th>
                                      <th>Haben</th>
                                      <th>Saldo</th>
                                      <th>Zwischengesellschaft</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {data.allBalances.map((balance) => {
                                      const fs = data.financialStatements?.find(f => f.id === balance.financialStatementId);
                                      return (
                                        <tr key={balance.id}>
                                          <td>{balance.account?.accountNumber || balance.accountId?.substring(0, 8) || '-'}</td>
                                          <td>{balance.account?.name || 'Konto nicht gefunden'}</td>
                                          <td>
                                            {fs ? (
                                              <span>
                                                {fs.fiscalYear}
                                                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginLeft: '0.25rem' }}>
                                                  ({new Date(fs.periodStart).toLocaleDateString('de-DE')} - {new Date(fs.periodEnd).toLocaleDateString('de-DE')})
                                                </span>
                                              </span>
                                            ) : (
                                              <span style={{ color: 'var(--color-text-secondary)' }}>Unbekannt</span>
                                            )}
                                          </td>
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
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : (
                            <div className="empty-state" style={{ padding: 'var(--spacing-4)' }}>
                              <div className="empty-state-title">Keine Kontensalden vorhanden</div>
                              <div className="empty-state-description">
                                Für dieses Unternehmen wurden noch keine Kontensalden importiert.
                                {data.financialStatements && data.financialStatements.length > 0 && (
                                  <div style={{ marginTop: 'var(--spacing-2)', fontSize: '0.875rem' }}>
                                    {data.financialStatements.length} Jahresabschluss{data.financialStatements.length !== 1 ? 'e' : ''} vorhanden, aber keine Kontensalden.
                                  </div>
                                )}
                              </div>
                              <div style={{ marginTop: 'var(--spacing-4)', padding: 'var(--spacing-3)', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: '500', marginBottom: 'var(--spacing-1)' }}>
                                      Keine Daten vorhanden
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                                      Für dieses Unternehmen wurden noch keine Kontensalden importiert.
                                    </div>
                                  </div>
                                  <button
                                    className="button button-primary"
                                    onClick={() => {
                                      const params = new URLSearchParams({ companyId: company.id });
                                      if (data.financialStatements && data.financialStatements.length > 0) {
                                        params.set('financialStatementId', data.financialStatements[0].id);
                                      }
                                      onNavigateToImport(company.id, data.financialStatements?.[0]?.id);
                                    }}
                                  >
                                    Daten importieren
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="empty-state" style={{ padding: 'var(--spacing-4)' }}>
                          <div className="empty-state-title">Keine Daten vorhanden</div>
                          <div className="empty-state-description">
                            Für dieses Unternehmen wurden noch keine Jahresabschlüsse oder Kontensalden importiert.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
