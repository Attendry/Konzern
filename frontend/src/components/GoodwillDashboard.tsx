import { useEffect, useState } from 'react';
import { goodwillService, GoodwillSchedule, GoodwillSummary, AmortizationEntry } from '../services/goodwillService';
import { companyService } from '../services/companyService';
import { Company } from '../types';
import { useToastContext } from '../contexts/ToastContext';

interface GoodwillDashboardProps {
  parentCompanyId: string;
  financialStatementId?: string;
  onClose?: () => void;
}

export function GoodwillDashboard({ parentCompanyId, financialStatementId, onClose }: GoodwillDashboardProps) {
  const { success, error: showError } = useToastContext();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<GoodwillSummary | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<GoodwillSchedule | null>(null);
  const [entries, setEntries] = useState<AmortizationEntry[]>([]);
  const [projection, setProjection] = useState<any[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImpairmentModal, setShowImpairmentModal] = useState(false);

  // Create form
  const [createForm, setCreateForm] = useState({
    subsidiaryCompanyId: '',
    initialGoodwill: '',
    acquisitionDate: '',
    usefulLifeYears: '10',
    amortizationMethod: 'linear' as GoodwillSchedule['amortizationMethod'],
    notes: '',
  });

  // Impairment form
  const [impairmentForm, setImpairmentForm] = useState({
    amount: '',
    reason: '',
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadData();
  }, [parentCompanyId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [summaryData, companiesData] = await Promise.all([
        goodwillService.getSummary(parentCompanyId),
        companyService.getAll(),
      ]);
      setSummary(summaryData);
      setCompanies(companiesData);
    } catch (err: any) {
      showError(`Fehler beim Laden: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadScheduleDetails = async (schedule: GoodwillSchedule) => {
    setSelectedSchedule(schedule);
    try {
      const [entriesData, projectionData] = await Promise.all([
        goodwillService.getEntriesBySchedule(schedule.id),
        goodwillService.getProjection(schedule.id),
      ]);
      setEntries(entriesData);
      setProjection(projectionData);
    } catch (err: any) {
      showError(`Fehler beim Laden der Details: ${err.message}`);
    }
  };

  const handleCreateSchedule = async () => {
    if (!createForm.subsidiaryCompanyId || !createForm.initialGoodwill) {
      showError('Bitte füllen Sie alle Pflichtfelder aus');
      return;
    }

    try {
      await goodwillService.createSchedule({
        subsidiaryCompanyId: createForm.subsidiaryCompanyId,
        parentCompanyId,
        initialGoodwill: parseFloat(createForm.initialGoodwill),
        acquisitionDate: createForm.acquisitionDate || undefined,
        usefulLifeYears: parseInt(createForm.usefulLifeYears),
        amortizationMethod: createForm.amortizationMethod,
        notes: createForm.notes || undefined,
      });
      setShowCreateModal(false);
      setCreateForm({
        subsidiaryCompanyId: '',
        initialGoodwill: '',
        acquisitionDate: '',
        usefulLifeYears: '10',
        amortizationMethod: 'linear',
        notes: '',
      });
      loadData();
      success('Abschreibungsplan erstellt');
    } catch (err: any) {
      showError(`Fehler beim Erstellen: ${err.message}`);
    }
  };

  const handleRecordImpairment = async () => {
    if (!selectedSchedule || !impairmentForm.amount || !impairmentForm.reason) {
      showError('Bitte füllen Sie alle Pflichtfelder aus');
      return;
    }

    try {
      await goodwillService.recordImpairment(
        selectedSchedule.id,
        parseFloat(impairmentForm.amount),
        impairmentForm.reason,
        impairmentForm.date,
      );
      setShowImpairmentModal(false);
      setImpairmentForm({ amount: '', reason: '', date: new Date().toISOString().split('T')[0] });
      loadData();
      loadScheduleDetails(selectedSchedule);
      success('Wertminderung erfasst');
    } catch (err: any) {
      showError(`Fehler beim Erfassen: ${err.message}`);
    }
  };

  const handleCreateEntry = async (schedule: GoodwillSchedule, fiscalYear: number) => {
    const yearStart = `${fiscalYear}-01-01`;
    const yearEnd = `${fiscalYear}-12-31`;

    try {
      await goodwillService.createEntry({
        scheduleId: schedule.id,
        financialStatementId,
        fiscalYear,
        periodStart: yearStart,
        periodEnd: yearEnd,
      });
      loadScheduleDetails(schedule);
      success(`Abschreibung für ${fiscalYear} erstellt`);
    } catch (err: any) {
      showError(`Fehler beim Erstellen: ${err.message}`);
    }
  };

  const handleBookEntry = async (entryId: string) => {
    if (!financialStatementId) {
      showError('Kein Jahresabschluss ausgewählt');
      return;
    }

    try {
      await goodwillService.bookEntry(entryId, financialStatementId);
      if (selectedSchedule) {
        loadScheduleDetails(selectedSchedule);
      }
      success('Abschreibung gebucht');
    } catch (err: any) {
      showError(`Fehler beim Buchen: ${err.message}`);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <span>Lade Goodwill-Übersicht...</span>
      </div>
    );
  }

  const subsidiaries = companies.filter(c => c.parentCompanyId === parentCompanyId);
  const currentYear = new Date().getFullYear();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-6)' }}>
        <h2>Goodwill-Abschreibung (§ 309 HGB)</h2>
        <div style={{ display: 'flex', gap: 'var(--spacing-3)' }}>
          <button className="button button-primary" onClick={() => setShowCreateModal(true)}>
            + Neuer Abschreibungsplan
          </button>
          {onClose && (
            <button className="button button-secondary" onClick={onClose}>
              Schließen
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-6)' }}>
          <div className="metric-card">
            <div className="metric-label">Ursprünglicher Goodwill</div>
            <div className="metric-value">{formatCurrency(summary.totalInitialGoodwill)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Kumulierte Abschreibung</div>
            <div className="metric-value" style={{ color: 'var(--color-warning)' }}>
              {formatCurrency(summary.totalAccumulatedAmortization)}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Wertminderungen</div>
            <div className="metric-value" style={{ color: 'var(--color-error)' }}>
              {formatCurrency(summary.totalImpairment)}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Verbleibender Goodwill</div>
            <div className="metric-value" style={{ color: 'var(--color-success)' }}>
              {formatCurrency(summary.totalRemainingGoodwill)}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selectedSchedule ? '1fr 1fr' : '1fr', gap: 'var(--spacing-6)' }}>
        {/* Schedules List */}
        <div className="card">
          <div className="card-header">
            <h3>Abschreibungspläne ({summary?.scheduleCount || 0})</h3>
          </div>
          {!summary?.schedules.length ? (
            <div className="empty-state">
              <div className="empty-state-title">Keine Abschreibungspläne</div>
              <div className="empty-state-description">
                Erstellen Sie einen neuen Abschreibungsplan für Goodwill aus Unternehmenserwerben.
              </div>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Tochtergesellschaft</th>
                  <th>Urspr. Goodwill</th>
                  <th>Verbleibend</th>
                  <th>Nutzungsdauer</th>
                  <th>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {summary.schedules.map(schedule => (
                  <tr 
                    key={schedule.id}
                    className={selectedSchedule?.id === schedule.id ? 'selected' : ''}
                    style={{ cursor: 'pointer' }}
                    onClick={() => loadScheduleDetails(schedule)}
                  >
                    <td>{schedule.subsidiaryCompanyName || schedule.subsidiaryCompanyId.slice(0, 8)}</td>
                    <td>{formatCurrency(schedule.initialGoodwill)}</td>
                    <td>
                      <span style={{ color: schedule.remainingGoodwill > 0 ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                        {formatCurrency(schedule.remainingGoodwill)}
                      </span>
                    </td>
                    <td>{schedule.usefulLifeYears} Jahre</td>
                    <td>
                      <button
                        className="button button-secondary button-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          loadScheduleDetails(schedule);
                        }}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Schedule Details */}
        {selectedSchedule && (
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>{selectedSchedule.subsidiaryCompanyName || 'Details'}</h3>
              <button
                className="button button-secondary button-sm"
                onClick={() => {
                  setShowImpairmentModal(true);
                }}
              >
                Wertminderung erfassen
              </button>
            </div>

            {/* Schedule Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)' }}>
              <div>
                <strong>Ursprünglicher Goodwill:</strong> {formatCurrency(selectedSchedule.initialGoodwill)}
              </div>
              <div>
                <strong>Jährliche Abschreibung:</strong> {formatCurrency(selectedSchedule.annualAmortization)}
              </div>
              <div>
                <strong>Nutzungsdauer:</strong> {selectedSchedule.usefulLifeYears} Jahre ({selectedSchedule.amortizationMethod})
              </div>
              <div>
                <strong>Verbleibend:</strong> 
                <span style={{ color: 'var(--color-success)', marginLeft: 'var(--spacing-2)' }}>
                  {formatCurrency(selectedSchedule.remainingGoodwill)}
                </span>
              </div>
            </div>

            {/* Entries */}
            <h4 style={{ marginTop: 'var(--spacing-4)', marginBottom: 'var(--spacing-2)' }}>Abschreibungsbuchungen</h4>
            {entries.length === 0 ? (
              <div>
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-3)' }}>
                  Noch keine Abschreibungen gebucht.
                </p>
                <button
                  className="button button-primary button-sm"
                  onClick={() => handleCreateEntry(selectedSchedule, currentYear)}
                >
                  Abschreibung {currentYear} erstellen
                </button>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Jahr</th>
                    <th>Eröffnung</th>
                    <th>Abschreibung</th>
                    <th>Schluss</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => (
                    <tr key={entry.id}>
                      <td>{entry.fiscalYear}</td>
                      <td>{formatCurrency(entry.openingBalance)}</td>
                      <td style={{ color: 'var(--color-warning)' }}>-{formatCurrency(entry.amortizationAmount)}</td>
                      <td>{formatCurrency(entry.closingBalance)}</td>
                      <td>
                        {entry.isBooked ? (
                          <span className="badge badge-success">Gebucht</span>
                        ) : (
                          <button
                            className="button button-primary button-sm"
                            onClick={() => handleBookEntry(entry.id)}
                            disabled={!financialStatementId}
                          >
                            Buchen
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Projection */}
            {projection.length > 0 && (
              <>
                <h4 style={{ marginTop: 'var(--spacing-4)', marginBottom: 'var(--spacing-2)' }}>Prognose</h4>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Jahr</th>
                        <th>Eröffnung</th>
                        <th>Abschreibung</th>
                        <th>Schluss</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projection.map((p, i) => (
                        <tr key={i} style={{ opacity: entries.some(e => e.fiscalYear === currentYear + p.year) ? 0.5 : 1 }}>
                          <td>{currentYear + p.year}</td>
                          <td>{formatCurrency(p.openingBalance)}</td>
                          <td style={{ color: 'var(--color-warning)' }}>-{formatCurrency(p.amortization)}</td>
                          <td>{formatCurrency(p.closingBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Neuer Abschreibungsplan</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Tochtergesellschaft *</label>
                <select
                  value={createForm.subsidiaryCompanyId}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, subsidiaryCompanyId: e.target.value }))}
                >
                  <option value="">-- Auswählen --</option>
                  {subsidiaries.map(company => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Ursprünglicher Goodwill (EUR) *</label>
                <input
                  type="number"
                  value={createForm.initialGoodwill}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, initialGoodwill: e.target.value }))}
                  placeholder="z.B. 500000"
                />
              </div>
              <div className="form-group">
                <label>Erwerbsdatum</label>
                <input
                  type="date"
                  value={createForm.acquisitionDate}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, acquisitionDate: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Nutzungsdauer (Jahre)</label>
                <select
                  value={createForm.usefulLifeYears}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, usefulLifeYears: e.target.value }))}
                >
                  {[5, 6, 7, 8, 9, 10].map(y => (
                    <option key={y} value={y}>{y} Jahre</option>
                  ))}
                </select>
                <small style={{ color: 'var(--color-text-secondary)' }}>
                  HGB § 253: Abschreibung über die voraussichtliche Nutzungsdauer (max. 10 Jahre)
                </small>
              </div>
              <div className="form-group">
                <label>Abschreibungsmethode</label>
                <select
                  value={createForm.amortizationMethod}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, amortizationMethod: e.target.value as any }))}
                >
                  <option value="linear">Linear</option>
                  <option value="declining">Degressiv</option>
                </select>
              </div>
              <div className="form-group">
                <label>Notizen</label>
                <textarea
                  value={createForm.notes}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="button button-secondary" onClick={() => setShowCreateModal(false)}>
                Abbrechen
              </button>
              <button className="button button-primary" onClick={handleCreateSchedule}>
                Erstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Impairment Modal */}
      {showImpairmentModal && selectedSchedule && (
        <div className="modal-overlay" onClick={() => setShowImpairmentModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Wertminderung erfassen</h2>
              <button className="modal-close" onClick={() => setShowImpairmentModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 'var(--spacing-4)' }}>
                Erfassen Sie eine außerplanmäßige Wertminderung für den Goodwill von{' '}
                <strong>{selectedSchedule.subsidiaryCompanyName}</strong>.
              </p>
              <div className="form-group">
                <label>Wertminderungsbetrag (EUR) *</label>
                <input
                  type="number"
                  value={impairmentForm.amount}
                  onChange={(e) => setImpairmentForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="z.B. 50000"
                  max={selectedSchedule.remainingGoodwill}
                />
                <small style={{ color: 'var(--color-text-secondary)' }}>
                  Maximal: {formatCurrency(selectedSchedule.remainingGoodwill)}
                </small>
              </div>
              <div className="form-group">
                <label>Begründung *</label>
                <textarea
                  value={impairmentForm.reason}
                  onChange={(e) => setImpairmentForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="z.B. Dauerhafte Wertminderung aufgrund von Marktveränderungen..."
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Datum</label>
                <input
                  type="date"
                  value={impairmentForm.date}
                  onChange={(e) => setImpairmentForm(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="button button-secondary" onClick={() => setShowImpairmentModal(false)}>
                Abbrechen
              </button>
              <button className="button button-primary" onClick={handleRecordImpairment}>
                Wertminderung erfassen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GoodwillDashboard;
