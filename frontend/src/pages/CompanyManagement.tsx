import { useEffect, useState } from 'react';
import { companyService } from '../services/companyService';
import { Company } from '../types';
import ConsolidationObligationCheck from '../components/ConsolidationObligationCheck';
import { useToastContext } from '../contexts/ToastContext';
import { AdvancedTable, TableColumn } from '../components/AdvancedTable';
import { Modal } from '../components/Modal';
import { Tooltip } from '../components/Tooltip';
import { useContextMenu, ContextMenuItem, ContextMenu } from '../components/ContextMenu';
import '../App.css';

function CompanyManagement() {
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

  useEffect(() => {
    loadCompanies();
    
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
        // Fetch participation data from the API
        const response = await fetch(`/api/consolidation/participations/subsidiary/${company.id}`);
        if (response.ok) {
          const participations = await response.json();
          if (participations && participations.length > 0) {
            participationPercentage = participations[0].participationPercentage || 100;
          }
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-6)' }}>
        <h1>Unternehmensverwaltung</h1>
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
                isConsolidated: true,
              });
            }
          }}
        >
          {showForm ? 'Abbrechen' : 'Neues Unternehmen'}
        </button>
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
            // Optionally update isConsolidated based on check result
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
                    // Reset participation percentage if parent is removed
                    participationPercentage: newParentId ? (formData.participationPercentage || 100) : undefined
                  });
                }}
              >
                <option value="">-- Kein Mutterunternehmen (Standalone) --</option>
                {companies
                  .filter((c) => !editingCompany || c.id !== editingCompany.id) // Don't allow selecting self as parent
                  .map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
              </select>
              <small style={{ color: '#666', fontSize: '0.9rem' }}>
                Wählen Sie ein Mutterunternehmen, wenn dies eine Tochtergesellschaft ist
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-6)' }}>
        <h1>Unternehmensverwaltung</h1>
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
                  isConsolidated: true,
                });
              }
            }}
          >
            {showForm ? 'Abbrechen' : 'Neues Unternehmen'}
          </button>
        </Tooltip>
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
                  .filter((c) => !editingCompany || c.id !== editingCompany.id)
                  .map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
              </select>
              <small style={{ color: '#666', fontSize: '0.9rem' }}>
                Wählen Sie ein Mutterunternehmen, wenn dies eine Tochtergesellschaft ist
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
