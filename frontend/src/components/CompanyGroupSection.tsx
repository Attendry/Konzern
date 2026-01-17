import { useMemo } from 'react';
import { Company, FinancialStatement, AccountBalance } from '../types';
import { AdvancedTable, TableColumn } from './AdvancedTable';
import CompanyHierarchyTree from './CompanyHierarchyTree';
import '../App.css';

// SVG Icon for parent company
const ParentCompanyIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18" />
    <path d="M5 21V7l8-4v18" />
    <path d="M19 21V11l-6-4" />
    <path d="M9 9v.01" />
    <path d="M9 12v.01" />
    <path d="M9 15v.01" />
  </svg>
);

// Chevron icon for expand/collapse
const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg 
    width="16" 
    height="16" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    style={{
      transition: 'transform 0.2s ease',
      transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
    }}
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

// Pin icon
const PinIcon = ({ filled }: { filled: boolean }) => (
  <svg 
    width="16" 
    height="16" 
    viewBox="0 0 24 24" 
    fill={filled ? 'currentColor' : 'none'} 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M12 17v5" />
    <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 7 15.66V7a6 6 0 0 1 6-6 6 6 0 0 1 6 6v8.66a2 2 0 0 0 .89 1.79l1.78.9a2 2 0 0 1 1.11 1.79V17" />
  </svg>
);

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
  isExpanded: boolean;
  isPinned: boolean;
  onToggle: () => void;
  onTogglePin: () => void;
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
  isExpanded,
  isPinned,
  onToggle,
  onTogglePin,
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
      <div 
        className="card-header" 
        style={{ 
          backgroundColor: isPinned ? 'var(--color-bg-tertiary)' : 'var(--color-bg-tertiary)',
          borderBottom: isPinned ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
          padding: 'var(--spacing-4)',
          cursor: 'pointer',
          transition: 'background-color 0.2s ease, border-color 0.2s ease',
        }}
        onClick={onToggle}
        onMouseEnter={(e) => {
          if (!isPinned) {
            e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = isPinned ? 'var(--color-bg-tertiary)' : 'var(--color-bg-tertiary)';
        }}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-controls={`group-content-${parentCompany.id}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', flex: 1 }}>
            <span style={{ 
              display: 'flex', 
              alignItems: 'center',
              color: 'var(--color-text-secondary)',
            }}>
              <ChevronIcon expanded={isExpanded} />
            </span>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                <span style={{ display: 'flex', alignItems: 'center', color: 'var(--color-primary)' }}>
                  {ParentCompanyIcon}
                </span>
                {parentCompany.name}
                <span className="badge badge-primary" style={{ marginLeft: 'var(--spacing-2)' }}>
                  Mutterunternehmen
                </span>
                {isPinned && (
                  <span className="badge" style={{ 
                    marginLeft: 'var(--spacing-2)',
                    backgroundColor: 'var(--color-primary)20',
                    color: 'var(--color-primary)',
                    fontSize: '0.75rem',
                    padding: 'var(--spacing-1) var(--spacing-2)',
                  }}>
                    Gepinnt
                  </span>
                )}
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
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent header toggle
              onTogglePin();
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 'var(--spacing-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isPinned ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              borderRadius: 'var(--radius-sm)',
              transition: 'background-color 0.2s ease, color 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title={isPinned ? 'Anheften aufheben' : 'Anheften'}
            aria-label={isPinned ? 'Anheften aufheben' : 'Anheften'}
          >
            <PinIcon filled={isPinned} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div 
          id={`group-content-${parentCompany.id}`}
          style={{ 
            padding: 'var(--spacing-4)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
        {/* Hierarchy Tree Section */}
        {hierarchyData && (
          <div style={{ marginBottom: 'var(--spacing-4)' }}>
            <h3 style={{ 
              fontSize: '1rem', 
              fontWeight: '600', 
              marginBottom: 'var(--spacing-2)',
              color: 'var(--color-text-primary)'
            }}>
              Konzernstruktur
            </h3>
            <div style={{ 
              padding: 'var(--spacing-3)', 
              backgroundColor: 'var(--color-bg-secondary)', 
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)'
            }}>
              <CompanyHierarchyTree
                selectedCompanyId={undefined}
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
              Unternehmen in diesem Konzern ({companies.length})
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
              Importierte Daten
            </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
            {companies.map((company) => {
              const isCompanyDataExpanded = expandedCompanyId === company.id;
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
                      <span style={{ fontSize: '1.2rem' }}>{isCompanyDataExpanded ? '▼' : '▶'}</span>
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

                  {isCompanyDataExpanded && (
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
      )}
    </div>
  );
}
