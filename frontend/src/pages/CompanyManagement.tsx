import { useEffect, useState } from 'react';
import { companyService } from '../services/companyService';
import { Company } from '../types';
import ConsolidationObligationCheck from '../components/ConsolidationObligationCheck';
import '../App.css';

function CompanyManagement() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
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
        alert('Unternehmen erfolgreich aktualisiert');
      } else {
        console.log('Creating company:', formData);
        result = await companyService.create(formData);
        console.log('Company created:', result);
        alert('Unternehmen erfolgreich erstellt');
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
      alert(`Fehler beim Speichern des Unternehmens: ${errorMessage}`);
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
      loadCompanies();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert('Fehler beim Löschen des Unternehmens');
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

      {loading && (
        <div className="loading">
          <div className="loading-spinner"></div>
          <span>Lade Unternehmen...</span>
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

      {!loading && (
        <div className="card">
          <div className="card-header">
            <h2>Unternehmen ({companies.length})</h2>
          </div>
          {companies.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Keine Unternehmen vorhanden</div>
              <div className="empty-state-description">
                Klicken Sie auf "Neues Unternehmen", um eines zu erstellen.
              </div>
            </div>
          ) : (
            <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Mutterunternehmen</th>
              <th>Steuernummer</th>
              <th>Rechtsform</th>
              <th>Konsolidiert</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => {
              const parentCompany = companies.find((c) => c.id === company.parentCompanyId);
              return (
                <tr key={company.id}>
                  <td>{company.name}</td>
                  <td>{parentCompany ? parentCompany.name : '-'}</td>
                  <td>{company.taxId || '-'}</td>
                  <td>{company.legalForm || '-'}</td>
                  <td>
                    <span className={`badge ${company.isConsolidated ? 'badge-success' : 'badge-neutral'}`}>
                      {company.isConsolidated ? 'Ja' : 'Nein'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
                      <button
                        className="button button-secondary button-sm"
                        onClick={() => handleEdit(company)}
                      >
                        Bearbeiten
                      </button>
                      <button
                        className="button button-tertiary button-sm"
                        onClick={() => {
                          // Show consolidation check in a modal or separate section
                          const checkWindow = window.open('', '_blank', 'width=800,height=600');
                          if (checkWindow) {
                            checkWindow.document.write(`
                              <html>
                                <head><title>Konsolidierungspflicht-Prüfung - ${company.name}</title></head>
                                <body>
                                  <h1>Konsolidierungspflicht-Prüfung: ${company.name}</h1>
                                  <p>Diese Funktion wird in der Hauptansicht verfügbar sein.</p>
                                  <p>Unternehmen-ID: ${company.id}</p>
                                  <button onclick="window.close()">Schließen</button>
                                </body>
                              </html>
                            `);
                          }
                        }}
                        title="Konsolidierungspflicht prüfen (HGB § 290-292)"
                      >
                        HGB-Prüfung
                      </button>
                      <button
                        className="button button-danger button-sm"
                        onClick={() => handleDelete(company.id)}
                      >
                        Löschen
                      </button>
                    </div>
                  </td>
              </tr>
              );
            })}
          </tbody>
        </table>
          )}
        </div>
      )}
    </div>
  );
}

export default CompanyManagement;
