import { useState, useEffect, useMemo } from 'react';
import { Company, Participation, ConsolidationType, ExclusionReason } from '../types';
import { companyService } from '../services/companyService';
import { participationService } from '../services/participationService';
import { MetricCard } from './MetricCard';
import { Modal } from './Modal';
import { FirstConsolidationWizard } from './FirstConsolidationWizard';
import { DeconsolidationModal } from './DeconsolidationModal';
import { useToastContext } from '../contexts/ToastContext';
import '../App.css';

interface ConsolidationCircleProps {
  onRefresh?: () => void;
}

export function ConsolidationCircle({ onRefresh }: ConsolidationCircleProps) {
  const { success, error: showError } = useToastContext();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showFirstConsolidation, setShowFirstConsolidation] = useState(false);
  const [showDeconsolidation, setShowDeconsolidation] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedParticipation, setSelectedParticipation] = useState<Participation | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    consolidationType: 'full' as ConsolidationType,
    exclusionReason: '' as ExclusionReason | '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [companiesData, participationsData] = await Promise.all([
        companyService.getAll(),
        participationService.getAll(),
      ]);
      setCompanies(companiesData);
      setParticipations(participationsData);
    } catch (error: any) {
      console.error('Error loading data:', error);
      showError(`Fehler beim Laden: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Organize companies by their consolidation status
  const { parentCompany, fullConsolidation, proportional, equityMethod, excluded } = useMemo(() => {
    const parent = companies.find(c => c.isUltimateParent || !c.parentCompanyId);
    const full = companies.filter(c => c.consolidationType === 'full' && !c.isUltimateParent);
    const prop = companies.filter(c => c.consolidationType === 'proportional');
    const equity = companies.filter(c => c.consolidationType === 'equity');
    const excl = companies.filter(c => c.consolidationType === 'none' || c.exclusionReason);
    
    return {
      parentCompany: parent,
      fullConsolidation: full,
      proportional: prop,
      equityMethod: equity,
      excluded: excl,
    };
  }, [companies]);

  // Calculate totals
  const totals = useMemo(() => ({
    total: companies.length,
    consolidated: companies.filter(c => c.isConsolidated).length,
    fullCount: fullConsolidation.length + (parentCompany ? 1 : 0),
    proportionalCount: proportional.length,
    equityCount: equityMethod.length,
    excludedCount: excluded.length,
  }), [companies, fullConsolidation, proportional, equityMethod, excluded, parentCompany]);

  const getParticipation = (companyId: string) => {
    return participations.find(p => p.subsidiaryCompanyId === companyId && p.isActive);
  };

  const handleEditCompany = (company: Company) => {
    setSelectedCompany(company);
    setEditForm({
      consolidationType: company.consolidationType || 'full',
      exclusionReason: company.exclusionReason || '',
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedCompany) return;
    
    try {
      await companyService.update(selectedCompany.id, {
        consolidationType: editForm.consolidationType,
        exclusionReason: editForm.exclusionReason || null,
        isConsolidated: editForm.consolidationType !== 'none',
      });
      success('Unternehmen aktualisiert');
      setShowEditModal(false);
      loadData();
      onRefresh?.();
    } catch (error: any) {
      showError(`Fehler: ${error.message}`);
    }
  };

  const handleStartDeconsolidation = (company: Company) => {
    const participation = getParticipation(company.id);
    setSelectedCompany(company);
    setSelectedParticipation(participation || null);
    setShowDeconsolidation(true);
  };

  const formatCurrency = (value: number) => {
    return (value || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  };

  const formatPercent = (value: number) => {
    return (value || 0).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + '%';
  };

  const renderCompanyCard = (company: Company, participation?: Participation) => (
    <div 
      key={company.id}
      className="company-card"
      style={{
        background: 'var(--color-bg-primary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-2)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h4 style={{ margin: 0 }}>{company.name}</h4>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            {company.legalForm} {company.countryCode && `• ${company.countryCode}`}
          </div>
        </div>
        {participation && (
          <div style={{
            background: 'var(--color-accent-blue)',
            color: 'white',
            padding: 'var(--spacing-1) var(--spacing-2)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-semibold)',
          }}>
            {formatPercent(participation.participationPercentage)}
          </div>
        )}
      </div>

      {participation && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: 'var(--spacing-2)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-secondary)',
        }}>
          <div>Erworben:</div>
          <div>{participation.acquisitionDate ? new Date(participation.acquisitionDate).toLocaleDateString('de-DE') : '-'}</div>
          
          {(participation.goodwill || 0) > 0 && (
            <>
              <div>Goodwill:</div>
              <div>{formatCurrency(participation.goodwill || 0)}</div>
            </>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-2)' }}>
        <button
          className="button button-secondary"
          style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--spacing-1) var(--spacing-2)' }}
          onClick={() => handleEditCompany(company)}
        >
          Bearbeiten
        </button>
        {company.isConsolidated && company.consolidationType !== 'none' && (
          <button
            className="button"
            style={{ 
              fontSize: 'var(--font-size-xs)', 
              padding: 'var(--spacing-1) var(--spacing-2)',
              background: 'var(--color-error)',
              color: 'white',
            }}
            onClick={() => handleStartDeconsolidation(company)}
          >
            Entkonsolidieren
          </button>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <span>Lade Konsolidierungskreis...</span>
      </div>
    );
  }

  return (
    <div className="consolidation-circle">
      {/* Summary Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
        gap: 'var(--spacing-4)',
        marginBottom: 'var(--spacing-6)',
      }}>
        <MetricCard label="Unternehmen gesamt" value={totals.total} />
        <MetricCard label="Voll konsolidiert" value={totals.fullCount} />
        <MetricCard label="Quotenkonsolidierung" value={totals.proportionalCount} />
        <MetricCard label="At-Equity" value={totals.equityCount} />
        <MetricCard label="Nicht konsolidiert" value={totals.excludedCount} />
      </div>

      {/* Parent Company */}
      {parentCompany && (
        <div className="card" style={{ marginBottom: 'var(--spacing-4)' }}>
          <div className="card-header" style={{ background: 'var(--color-accent-blue)', color: 'white' }}>
            <h3 style={{ margin: 0 }}>Mutterunternehmen</h3>
          </div>
          <div style={{ padding: 'var(--spacing-4)' }}>
            {renderCompanyCard(parentCompany)}
          </div>
        </div>
      )}

      {/* Full Consolidation */}
      <div className="card" style={{ marginBottom: 'var(--spacing-4)' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Vollkonsolidierung (§ 300-309 HGB)</h3>
          <button
            className="button button-primary"
            onClick={() => setShowFirstConsolidation(true)}
          >
            + Erstkonsolidierung
          </button>
        </div>
        <div style={{ 
          padding: 'var(--spacing-4)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 'var(--spacing-4)',
        }}>
          {fullConsolidation.length === 0 ? (
            <p style={{ color: 'var(--color-text-secondary)', gridColumn: '1/-1' }}>
              Keine voll konsolidierten Tochterunternehmen vorhanden.
            </p>
          ) : (
            fullConsolidation.map(company => renderCompanyCard(company, getParticipation(company.id)))
          )}
        </div>
      </div>

      {/* Proportional Consolidation */}
      <div className="card" style={{ marginBottom: 'var(--spacing-4)' }}>
        <div className="card-header">
          <h3 style={{ margin: 0 }}>Quotenkonsolidierung (§ 310 HGB)</h3>
        </div>
        <div style={{ 
          padding: 'var(--spacing-4)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 'var(--spacing-4)',
        }}>
          {proportional.length === 0 ? (
            <p style={{ color: 'var(--color-text-secondary)', gridColumn: '1/-1' }}>
              Keine quotal konsolidierten Gemeinschaftsunternehmen vorhanden.
            </p>
          ) : (
            proportional.map(company => renderCompanyCard(company, getParticipation(company.id)))
          )}
        </div>
      </div>

      {/* Equity Method */}
      <div className="card" style={{ marginBottom: 'var(--spacing-4)' }}>
        <div className="card-header">
          <h3 style={{ margin: 0 }}>At-Equity (§ 311-312 HGB)</h3>
        </div>
        <div style={{ 
          padding: 'var(--spacing-4)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 'var(--spacing-4)',
        }}>
          {equityMethod.length === 0 ? (
            <p style={{ color: 'var(--color-text-secondary)', gridColumn: '1/-1' }}>
              Keine at-equity bewerteten assoziierten Unternehmen vorhanden.
            </p>
          ) : (
            equityMethod.map(company => renderCompanyCard(company, getParticipation(company.id)))
          )}
        </div>
      </div>

      {/* Excluded Companies */}
      {excluded.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--spacing-4)' }}>
          <div className="card-header" style={{ background: 'var(--color-bg-tertiary)' }}>
            <h3 style={{ margin: 0 }}>Nicht einbezogen (§ 296 HGB)</h3>
          </div>
          <div style={{ 
            padding: 'var(--spacing-4)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 'var(--spacing-4)',
          }}>
            {excluded.map(company => {
              const reasonLabels: Record<string, string> = {
                materiality: 'Unwesentlichkeit',
                temporary_control: 'Vorübergehende Beherrschung',
                severe_restrictions: 'Erhebliche Beschränkungen',
                disproportionate_cost: 'Unverhältnismäßige Kosten',
                different_activity: 'Abweichende Tätigkeit',
              };
              
              return (
                <div key={company.id} style={{ position: 'relative' }}>
                  {renderCompanyCard(company, getParticipation(company.id))}
                  {company.exclusionReason && (
                    <div style={{
                      position: 'absolute',
                      top: 'var(--spacing-2)',
                      right: 'var(--spacing-2)',
                      background: 'var(--color-warning)',
                      color: 'var(--color-bg-primary)',
                      padding: 'var(--spacing-1) var(--spacing-2)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--font-size-xs)',
                    }}>
                      {reasonLabels[company.exclusionReason] || company.exclusionReason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`Konsolidierungsart: ${selectedCompany?.name}`}
        size="sm"
      >
        <div className="form-group">
          <label>Konsolidierungsart</label>
          <select
            value={editForm.consolidationType}
            onChange={(e) => setEditForm({ ...editForm, consolidationType: e.target.value as ConsolidationType })}
          >
            <option value="full">Vollkonsolidierung</option>
            <option value="proportional">Quotenkonsolidierung</option>
            <option value="equity">At-Equity</option>
            <option value="none">Nicht konsolidiert</option>
          </select>
        </div>

        {editForm.consolidationType === 'none' && (
          <div className="form-group">
            <label>Ausschlussgrund (§ 296 HGB)</label>
            <select
              value={editForm.exclusionReason}
              onChange={(e) => setEditForm({ ...editForm, exclusionReason: e.target.value as ExclusionReason })}
            >
              <option value="">-- Auswählen --</option>
              <option value="materiality">Unwesentlichkeit</option>
              <option value="temporary_control">Vorübergehende Beherrschung</option>
              <option value="severe_restrictions">Erhebliche Beschränkungen</option>
              <option value="disproportionate_cost">Unverhältnismäßige Kosten</option>
              <option value="different_activity">Abweichende Tätigkeit</option>
            </select>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-3)', marginTop: 'var(--spacing-6)' }}>
          <button className="button button-secondary" onClick={() => setShowEditModal(false)}>
            Abbrechen
          </button>
          <button className="button button-primary" onClick={handleSaveEdit}>
            Speichern
          </button>
        </div>
      </Modal>

      {/* First Consolidation Wizard */}
      <FirstConsolidationWizard
        isOpen={showFirstConsolidation}
        onClose={() => setShowFirstConsolidation(false)}
        onComplete={() => {
          setShowFirstConsolidation(false);
          loadData();
          onRefresh?.();
        }}
      />

      {/* Deconsolidation Modal */}
      <DeconsolidationModal
        isOpen={showDeconsolidation}
        onClose={() => setShowDeconsolidation(false)}
        onComplete={() => {
          setShowDeconsolidation(false);
          loadData();
          onRefresh?.();
        }}
        participation={selectedParticipation}
        subsidiary={selectedCompany}
      />
    </div>
  );
}
