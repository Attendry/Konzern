import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { companyService } from '../services/companyService';
import { participationService } from '../services/participationService';
import { financialStatementService } from '../services/financialStatementService';
import { Company, FinancialStatement, AccountBalance } from '../types';
import ConsolidationObligationCheck from '../components/ConsolidationObligationCheck';
import { useToastContext } from '../contexts/ToastContext';
import { AdvancedTable, TableColumn } from '../components/AdvancedTable';
import { Modal } from '../components/Modal';
import { Tooltip } from '../components/Tooltip';
import { useContextMenu, ContextMenuItem, ContextMenu } from '../components/ContextMenu';
import { CompanyGroupSection } from '../components/CompanyGroupSection';
import '../App.css';

interface CompanyHierarchy {
  id: string;
  name: string;
  type: 'parent' | 'subsidiary' | 'standalone';
  parentCompanyId: string | null;
  children: CompanyHierarchy[];
  participationPercentage?: number;
}

function CompanyManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { success, error: showError } = useToastContext();
  const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Company> & { participationPercentage?: number }>({
    name: '',
    taxId: '',
    address: '',
    legalForm: '',
    parentCompanyId: null,
    participationPercentage: 100,
    isConsolidated: true,
  });
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);
  const [companyData, setCompanyData] = useState<Record<string, {
    financialStatements: FinancialStatement[];
    balances: Record<string, AccountBalance[]>;
    allBalances: AccountBalance[]; // All balances across all financial statements
    loading: boolean;
  }>>({});
  const [hierarchyData, setHierarchyData] = useState<CompanyHierarchy[]>([]);
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped'); // Default to grouped view

  useEffect(() => {
    loadCompanies();
    loadHierarchy();
    
    // Listen for command palette events
    const handleOpenForm = () => {
      setShowForm(true);
      setEditingCompany(null);
      setFormData({
        name: '',
        taxId: '',
        address: '',
        legalForm: '',
        parentCompanyId: null,
        participationPercentage: 100,
        isConsolidated: true,
      });
    };
    
    window.addEventListener('openCompanyForm', handleOpenForm);
    return () => window.removeEventListener('openCompanyForm', handleOpenForm);
  }, []);

  // Reload hierarchy when companies change
  useEffect(() => {
    if (companies.length > 0) {
      loadHierarchy();
    }
  }, [companies.length]);

  // Handle edit query parameter from URL (e.g., /companies?edit=companyId)
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && companies.length > 0) {
      const companyToEdit = companies.find(c => c.id === editId);
      if (companyToEdit) {
        handleEdit(companyToEdit);
        // Clear the query parameter after opening the form
        setSearchParams({});
      }
    }
  }, [searchParams, companies]);

  const loadCompanies = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await companyService.getAll();
      setCompanies(data);
    } catch (error: any) {
      console.error('Fehler beim Laden der Unternehmen:', error);
      setError(`Fehler beim Laden der Unternehmen: ${error.message || 'Unbekannter Fehler'}. Bitte prüfen Sie, ob das Backend läuft.`);
    } finally {
      setLoading(false);
    }
  };

  const loadHierarchy = async () => {
    try {
      const data = await companyService.getHierarchy();
      setHierarchyData(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Fehler beim Laden der Hierarchie:', error);
      // Don't show error to user, hierarchy is optional
    }
  };

  // Helper function to get all children of a company recursively
  const getAllChildren = (parentId: string, allCompanies: Company[]): Company[] => {
    const children = allCompanies.filter(c => c.parentCompanyId === parentId);
    const allDescendants = [...children];
    children.forEach(child => {
      allDescendants.push(...getAllChildren(child.id, allCompanies));
    });
    return allDescendants;
  };

  // Helper function to check if a company has children
  const hasChildren = (companyId: string, allCompanies: Company[]): boolean => {
    return allCompanies.some(c => c.parentCompanyId === companyId);
  };

  // Group companies by root parent
  const groupedCompanies = useMemo(() => {
    const groups: Record<string, Company[]> = {};
    const standalone: Company[] = [];
    
    // Group by parent companies from hierarchy
    hierarchyData.forEach(root => {
      if (root.type === 'parent' || root.children.length > 0) {
        const rootCompany = companies.find(c => c.id === root.id);
        if (rootCompany) {
          groups[root.id] = [rootCompany, ...getAllChildren(root.id, companies)];
        }
      }
    });
    
    // Find standalone companies (no parent and no children)
    companies.forEach(company => {
      if (!company.parentCompanyId && !hasChildren(company.id, companies)) {
        // Check if it's not already in a group
        const isInGroup = Object.values(groups).some(group => 
          group.some(c => c.id === company.id)
        );
        if (!isInGroup) {
          standalone.push(company);
        }
      }
    });
    
    return { groups, standalone };
  }, [hierarchyData, companies]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    
    console.log('Submitting company:', formData);
    
    try {
      let result;
      if (editingCompany) {
        console.log('Updating company:', editingCompany.id);
        result = await companyService.update(editingCompany.id, formData);
        console.log('Company updated:', result);
        success('Unternehmen erfolgreich aktualisiert');
      } else {
        console.log('Creating company:', formData);
        result = await companyService.create(formData);
        console.log('Company created:', result);
        success('Unternehmen erfolgreich erstellt');
      }
      
      setShowForm(false);
      setEditingCompany(null);
      setFormData({
        name: '',
        taxId: '',
        address: '',
        legalForm: '',
        parentCompanyId: null,
        participationPercentage: 100,
        isConsolidated: true,
      });
      await loadCompanies();
    } catch (error: any) {
      console.error('Fehler beim Speichern:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Unbekannter Fehler';
      setError(`Fehler beim Speichern: ${errorMessage}`);
      showError(`Fehler beim Speichern des Unternehmens: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (company: Company) => {
    setEditingCompany(company);
    
    // Load participation percentage if company has a parent
    let participationPercentage = 100; // Default
    if (company.parentCompanyId) {
      try {
        // Fetch participation data using the participationService
        const participations = await participationService.getBySubsidiaryCompany(company.id);
        if (participations && participations.length > 0) {
          participationPercentage = participations[0].participationPercentage || 100;
        }
      } catch (error) {
        console.warn('Could not load participation percentage, using default 100%:', error);
      }
    }
    
    setFormData({
      ...company,
      participationPercentage: participationPercentage,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Möchten Sie dieses Unternehmen wirklich löschen?')) {
      return;
    }
    try {
      await companyService.delete(id);
      success('Unternehmen erfolgreich gelöscht');
      loadCompanies();
    } catch (error: any) {
      console.error('Fehler beim Löschen:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Unbekannter Fehler';
      showError(`Fehler beim Löschen des Unternehmens: ${errorMessage}`);
    }
  };

  const companyColumns: TableColumn<Company>[] = [
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
          <Tooltip content="Unternehmen bearbeiten" position="top">
            <button
              className="button button-secondary button-sm"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(row);
              }}
            >
              Bearbeiten
            </button>
          </Tooltip>
          <Tooltip content="HGB-Prüfung durchführen" position="top">
            <button
              className="button button-tertiary button-sm"
              onClick={(e) => {
                e.stopPropagation();
                setEditingCompany(row);
                setShowModal(true);
              }}
            >
              HGB-Prüfung
            </button>
          </Tooltip>
          <Tooltip content="Unternehmen löschen" position="top">
            <button
              className="button button-danger button-sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row.id);
              }}
            >
              Löschen
            </button>
          </Tooltip>
        </div>
      ),
    },
  ];

  const handleRowContextMenu = (e: React.MouseEvent, company: Company) => {
    e.preventDefault();
    const items: ContextMenuItem[] = [
      {
        label: 'Bearbeiten',
        onClick: () => handleEdit(company),
      },
      {
        label: 'HGB-Prüfung',
        onClick: () => {
          setEditingCompany(company);
          setShowModal(true);
        },
      },
      { separator: true },
      {
        label: 'Löschen',
        onClick: () => handleDelete(company.id),
        variant: 'danger',
      },
    ];
    showContextMenu(items, e.clientX, e.clientY);
  };

  const loadCompanyData = async (companyId: string) => {
    if (companyData[companyId]?.loading) return;
    
    setCompanyData(prev => ({
      ...prev,
      [companyId]: { 
        financialStatements: prev[companyId]?.financialStatements || [],
        balances: prev[companyId]?.balances || {},
        allBalances: prev[companyId]?.allBalances || [],
        loading: true 
      }
    }));

    try {
      // Load all data in parallel
      const [financialStatements, allBalances] = await Promise.all([
        financialStatementService.getByCompanyId(companyId),
        financialStatementService.getBalancesByCompanyId(companyId)
      ]);
      
      console.log(`[CompanyManagement] Loaded data for company ${companyId}:`, {
        financialStatements: financialStatements.length,
        allBalances: allBalances.length,
        allBalancesType: typeof allBalances,
        allBalancesIsArray: Array.isArray(allBalances),
        balanceDetails: allBalances.slice(0, 3).map(b => ({
          id: b.id,
          accountNumber: b.account?.accountNumber,
          accountName: b.account?.name,
          balance: b.balance,
          hasAccount: !!b.account
        }))
      });
      
      const balances: Record<string, AccountBalance[]> = {};
      
      // Load balances for each financial statement (for organized view)
      for (const fs of financialStatements) {
        try {
          const fsBalances = await financialStatementService.getBalances(fs.id);
          balances[fs.id] = fsBalances;
        } catch (err) {
          console.error(`Error loading balances for financial statement ${fs.id}:`, err);
          balances[fs.id] = [];
        }
      }

      setCompanyData(prev => ({
        ...prev,
        [companyId]: {
          financialStatements,
          balances,
          allBalances: allBalances || [],
          loading: false
        }
      }));
    } catch (err: any) {
      console.error('Error loading company data:', err);
      console.error('Error details:', err.response?.data || err.message);
      setCompanyData(prev => ({
        ...prev,
        [companyId]: {
          financialStatements: [],
          balances: {},
          allBalances: [],
          loading: false
        }
      }));
    }
  };

  const handleToggleCompanyData = (companyId: string) => {
    if (expandedCompanyId === companyId) {
      setExpandedCompanyId(null);
    } else {
      setExpandedCompanyId(companyId);
      // Always reload data when expanding to ensure we have the latest data
      loadCompanyData(companyId);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-6)' }}>
        <h1>Unternehmensverwaltung</h1>
        <div style={{ display: 'flex', gap: 'var(--spacing-3)', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center' }}>
            <label style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Ansicht:</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as 'grouped' | 'flat')}
              className="button button-secondary button-sm"
              style={{ padding: 'var(--spacing-1) var(--spacing-2)' }}
            >
              <option value="grouped">Gruppiert</option>
              <option value="flat">Flach</option>
            </select>
          </div>
          <Tooltip content="Neues Unternehmen erstellen" position="bottom">
            <button
              className="button button-primary"
              onClick={() => {
                setShowForm(!showForm);
                setError(null);
                if (!showForm) {
                  setEditingCompany(null);
                  setFormData({
                    name: '',
                    taxId: '',
                    address: '',
                    legalForm: '',
                    parentCompanyId: null,
                    participationPercentage: 100,
                    isConsolidated: true,
                  });
                }
              }}
            >
              {showForm ? 'Abbrechen' : 'Neues Unternehmen'}
            </button>
          </Tooltip>
        </div>
      </div>

      {error && !loading && (
        <div className="error-message">
          <strong>Fehler:</strong> {error}
          <button
            onClick={loadCompanies}
            className="button button-tertiary button-sm"
            style={{ marginLeft: 'var(--spacing-3)' }}
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {showForm && editingCompany && (
        <ConsolidationObligationCheck
          companyId={editingCompany.id}
          companyName={editingCompany.name}
          onCheckComplete={(result) => {
            if (result.isObligatory && !formData.isConsolidated) {
              if (confirm(`Konsolidierungspflicht erkannt. Soll das Unternehmen als konsolidiert markiert werden?`)) {
                setFormData({ ...formData, isConsolidated: true });
              }
            }
          }}
        />
      )}

      {showForm && (
        <div className="card">
          <div className="card-header">
            <h2>{editingCompany ? 'Unternehmen bearbeiten' : 'Neues Unternehmen'}</h2>
          </div>
          <form onSubmit={handleSubmit}>
            {/* Form fields remain the same */}
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Steuernummer</label>
              <input
                type="text"
                value={formData.taxId || ''}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Adresse</label>
              <textarea
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={3}
              />
            </div>
            <div className="form-group">
              <label>Rechtsform</label>
              <input
                type="text"
                value={formData.legalForm || ''}
                onChange={(e) => setFormData({ ...formData, legalForm: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Mutterunternehmen (optional)</label>
              <select
                value={formData.parentCompanyId || ''}
                onChange={(e) => {
                  const newParentId = e.target.value || null;
                  setFormData({
                    ...formData,
                    parentCompanyId: newParentId,
                    participationPercentage: newParentId ? (formData.participationPercentage || 100) : undefined
                  });
                }}
              >
                <option value="">-- Kein Mutterunternehmen (Standalone) --</option>
                {companies
                  .filter((c) => {
                    // Exclude the company being edited
                    if (editingCompany && c.id === editingCompany.id) return false;
                    // Only show companies without a parent (potential parent companies)
                    // or companies marked as ultimate parent
                    return !c.parentCompanyId || c.isUltimateParent;
                  })
                  .map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name} {company.isUltimateParent ? '(Konzernmutter)' : ''}
                    </option>
                  ))}
              </select>
              <small style={{ color: '#666', fontSize: '0.9rem' }}>
                Wählen Sie ein Mutterunternehmen, wenn dies eine Tochtergesellschaft ist. Nur Unternehmen ohne übergeordnetes Unternehmen können als Mutterunternehmen ausgewählt werden.
              </small>
            </div>
            {formData.parentCompanyId && (
              <div className="form-group">
                <label>Beteiligungsquote (%) *</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.participationPercentage ?? 100}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setFormData({
                      ...formData,
                      participationPercentage: isNaN(value) ? 100 : Math.max(0, Math.min(100, value))
                    });
                  }}
                  required={!!formData.parentCompanyId}
                />
                <small style={{ color: '#666', fontSize: '0.9rem' }}>
                  Prozentuale Beteiligung des Mutterunternehmens an dieser Tochtergesellschaft (0-100%)
                </small>
              </div>
            )}
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.isConsolidated}
                  onChange={(e) => setFormData({ ...formData, isConsolidated: e.target.checked })}
                />
                Wird konsolidiert
              </label>
            </div>
            <button type="submit" className="button button-primary" disabled={saving}>
              {saving ? 'Speichere...' : editingCompany ? 'Aktualisieren' : 'Erstellen'}
            </button>
          </form>
        </div>
      )}

      {viewMode === 'grouped' ? (
        // Grouped View
        <>
          {Object.keys(groupedCompanies.groups).length === 0 && groupedCompanies.standalone.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <div className="empty-state-title">Keine Unternehmen vorhanden</div>
                <div className="empty-state-description">
                  Erstellen Sie ein Unternehmen, um zu beginnen.
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Render grouped sections */}
              {Object.entries(groupedCompanies.groups).map(([parentId, groupCompanies]) => {
                const parentCompany = companies.find(c => c.id === parentId);
                const hierarchyNode = hierarchyData.find(h => h.id === parentId);
                if (!parentCompany) return null;

                return (
                  <CompanyGroupSection
                    key={parentId}
                    parentCompany={parentCompany}
                    companies={groupCompanies}
                    hierarchyData={hierarchyNode || null}
                    companyData={companyData}
                    expandedCompanyId={expandedCompanyId}
                    onToggleCompanyData={handleToggleCompanyData}
                    onEditCompany={handleEdit}
                    onDeleteCompany={handleDelete}
                    onShowHgbCheck={(company) => {
                      setEditingCompany(company);
                      setShowModal(true);
                    }}
                    onLoadCompanyData={loadCompanyData}
                    onNavigateToImport={(companyId, financialStatementId) => {
                      const params = new URLSearchParams({ companyId });
                      if (financialStatementId) {
                        params.set('financialStatementId', financialStatementId);
                      }
                      navigate(`/import?${params.toString()}`);
                    }}
                  />
                );
              })}

              {/* Standalone companies section */}
              {groupedCompanies.standalone.length > 0 && (
                <div className="card" style={{ marginBottom: 'var(--spacing-6)' }}>
                  <div className="card-header" style={{ 
                    backgroundColor: 'var(--color-bg-tertiary)',
                    borderBottom: '2px solid var(--color-border)',
                    padding: 'var(--spacing-4)'
                  }}>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                      Standalone Unternehmen ({groupedCompanies.standalone.length})
                    </h2>
                  </div>
                  <div style={{ padding: 'var(--spacing-4)' }}>
                    <AdvancedTable
                      data={groupedCompanies.standalone}
                      columns={companyColumns}
                      loading={false}
                      emptyMessage="Keine standalone Unternehmen"
                      onRowClick={(row) => handleEdit(row)}
                      onRowContextMenu={handleRowContextMenu}
                    />
                    <div style={{ marginTop: 'var(--spacing-4)' }}>
                      <h3 style={{ 
                        fontSize: '1rem', 
                        fontWeight: '600', 
                        marginBottom: 'var(--spacing-2)',
                        color: 'var(--color-text-primary)'
                      }}>
                        Importierte Daten
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
                        {groupedCompanies.standalone.map((company) => {
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
                                onClick={() => handleToggleCompanyData(company.id)}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
                                  <span style={{ fontSize: '1.2rem' }}>{isExpanded ? '▼' : '▶'}</span>
                                  <div>
                                    <strong>{company.name}</strong>
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
                                      onClick={() => loadCompanyData(company.id)}
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
                                                  navigate(`/import?${params.toString()}`);
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
              )}
            </>
          )}
        </>
      ) : (
        // Flat View (Original)
        <>
          <div className="card">
            <div className="card-header">
              <h2>Unternehmen ({companies.length})</h2>
            </div>
            <AdvancedTable
              data={companies}
              columns={companyColumns}
              loading={loading}
              emptyMessage="Keine Unternehmen vorhanden"
              onRowClick={(row) => handleEdit(row)}
              onRowContextMenu={handleRowContextMenu}
            />
          </div>

          {/* Company Data Section */}
          <div className="card">
            <div className="card-header">
              <h2>Importierte Daten</h2>
            </div>
            {companies.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">Keine Unternehmen vorhanden</div>
                <div className="empty-state-description">
                  Erstellen Sie ein Unternehmen, um importierte Daten anzuzeigen.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
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
                    onClick={() => handleToggleCompanyData(company.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
                      <span style={{ fontSize: '1.2rem' }}>{isExpanded ? '▼' : '▶'}</span>
                      <div>
                        <strong>{company.name}</strong>
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
                          onClick={() => loadCompanyData(company.id)}
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
                                  // Find the financial statement for this balance
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
                            {/* Link to Data Import */}
                            <div style={{ marginTop: 'var(--spacing-4)', padding: 'var(--spacing-3)', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                              {data.allBalances && Array.isArray(data.allBalances) && data.allBalances.length === 0 ? (
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
                                      navigate(`/import?${params.toString()}`);
                                    }}
                                  >
                                    Daten importieren
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: '500', marginBottom: 'var(--spacing-1)' }}>
                                      Daten verwalten
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                                      Weitere Daten importieren oder vorhandene Daten aktualisieren.
                                    </div>
                                  </div>
                                  <button
                                    className="button button-secondary"
                                    onClick={() => {
                                      const params = new URLSearchParams({ companyId: company.id });
                                      if (data.financialStatements && data.financialStatements.length > 0) {
                                        params.set('financialStatementId', data.financialStatements[0].id);
                                      }
                                      navigate(`/import?${params.toString()}`);
                                    }}
                                  >
                                    Zu Datenimport
                                  </button>
                                </div>
                              )}
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
            )}
          </div>
        </>
      )}

      {showModal && editingCompany && (
        <Modal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setEditingCompany(null);
          }}
          title={`HGB-Prüfung: ${editingCompany.name}`}
          size="lg"
        >
          <ConsolidationObligationCheck
            companyId={editingCompany.id}
            companyName={editingCompany.name}
            onCheckComplete={(result) => {
              if (result.isObligatory) {
                success(`Konsolidierungspflicht erkannt für ${editingCompany.name}`);
              }
            }}
          />
        </Modal>
      )}

      {contextMenu && (
        <ContextMenu
          items={contextMenu.items}
          onClose={hideContextMenu}
          x={contextMenu.x}
          y={contextMenu.y}
        />
      )}
    </div>
  );
}

export default CompanyManagement;
