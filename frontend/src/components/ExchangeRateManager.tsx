import { useState, useEffect } from 'react';
import { 
  exchangeRateService, 
  COMMON_CURRENCIES,
} from '../services/exchangeRateService';
import { ExchangeRate, CreateExchangeRateRequest, RateType } from '../types';
import { Modal } from './Modal';
import { useToastContext } from '../contexts/ToastContext';
import '../App.css';

const RATE_TYPE_LABELS: Record<RateType, string> = {
  spot: 'Stichtagskurs',
  average: 'Durchschnittskurs',
  historical: 'Historischer Kurs',
};

export function ExchangeRateManager() {
  const { success, error: showError } = useToastContext();
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRate, setEditingRate] = useState<ExchangeRate | null>(null);
  const [showFetchModal, setShowFetchModal] = useState(false);
  
  // Filters
  const [filterCurrency, setFilterCurrency] = useState('');
  const [filterType, setFilterType] = useState<RateType | ''>('');
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());

  // Fetch settings
  const [fetchDate, setFetchDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [fetchYear, setFetchYear] = useState<number>(new Date().getFullYear());
  const [fetchMonth, setFetchMonth] = useState<number | ''>('');

  // Form state
  const [formData, setFormData] = useState<CreateExchangeRateRequest>({
    fromCurrency: 'USD',
    toCurrency: 'EUR',
    rateDate: new Date().toISOString().split('T')[0],
    rate: 1.0,
    rateType: 'spot',
    rateSource: 'manual',
  });

  useEffect(() => {
    loadRates();
  }, [filterCurrency, filterType, filterYear]);

  const loadRates = async () => {
    setLoading(true);
    try {
      const data = await exchangeRateService.getExchangeRates({
        fromCurrency: filterCurrency || undefined,
        rateType: filterType || undefined,
        fiscalYear: filterYear || undefined,
      });
      // Debug: log the actual data structure received
      console.log('Exchange rates data:', JSON.stringify(data.slice(0, 2), null, 2));
      setRates(data);
    } catch (error: any) {
      console.error('Error loading rates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await exchangeRateService.upsertRate(formData);
      success(editingRate ? 'Wechselkurs aktualisiert' : 'Wechselkurs erstellt');
      setShowAddModal(false);
      setEditingRate(null);
      resetForm();
      loadRates();
    } catch (error: any) {
      showError(`Fehler: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleEdit = (rate: ExchangeRate) => {
    setEditingRate(rate);
    setFormData({
      fromCurrency: rate.fromCurrency,
      toCurrency: rate.toCurrency,
      rateDate: rate.rateDate,
      rate: rate.rate,
      rateType: rate.rateType,
      rateSource: rate.rateSource,
      fiscalYear: rate.fiscalYear,
      fiscalMonth: rate.fiscalMonth,
      notes: rate.notes,
    });
    setShowAddModal(true);
  };

  const handleDelete = async (rateId: string) => {
    if (!confirm('Möchten Sie diesen Wechselkurs löschen?')) return;
    
    try {
      await exchangeRateService.deleteRate(rateId);
      success('Wechselkurs gelöscht');
      loadRates();
    } catch (error: any) {
      showError(`Fehler: ${error.response?.data?.message || error.message}`);
    }
  };

  const resetForm = () => {
    setFormData({
      fromCurrency: 'USD',
      toCurrency: 'EUR',
      rateDate: new Date().toISOString().split('T')[0],
      rate: 1.0,
      rateType: 'spot',
      rateSource: 'manual',
    });
  };

  // ECB Fetch Functions
  const handleFetchLatestRates = async () => {
    setFetching(true);
    try {
      const result = await exchangeRateService.fetchLatestRates();
      success(`${result.success} Kurse von EZB aktualisiert`);
      loadRates();
    } catch (error: any) {
      showError(`Fehler beim Abrufen: ${error.response?.data?.message || error.message}`);
    } finally {
      setFetching(false);
    }
  };

  const handleFetchDateRates = async () => {
    if (!fetchDate) return;
    setFetching(true);
    try {
      const result = await exchangeRateService.fetchRatesForDate(fetchDate);
      success(`Stichtagskurse für ${fetchDate} abgerufen: ${result.success} Kurse`);
      loadRates();
    } catch (error: any) {
      showError(`Fehler beim Abrufen: ${error.response?.data?.message || error.message}`);
    } finally {
      setFetching(false);
    }
  };

  const handleCalculateAverageRates = async () => {
    setFetching(true);
    try {
      const result = await exchangeRateService.calculateAverageRates(
        fetchYear, 
        fetchMonth ? Number(fetchMonth) : undefined
      );
      success(`Durchschnittskurse berechnet: ${result.success} Währungen`);
      loadRates();
    } catch (error: any) {
      showError(`Fehler bei Berechnung: ${error.response?.data?.message || error.message}`);
    } finally {
      setFetching(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);
  const months = [
    { value: 1, label: 'Januar' },
    { value: 2, label: 'Februar' },
    { value: 3, label: 'März' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mai' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Dezember' },
  ];

  return (
    <div className="exchange-rate-manager">
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Wechselkurse (§ 308a HGB)</h2>
          <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
            <button
              className="button button-secondary"
              onClick={() => setShowFetchModal(true)}
              disabled={fetching}
              title="Kurse von EZB abrufen"
            >
              🌐 EZB-Kurse
            </button>
            <button
              className="button button-secondary"
              onClick={handleFetchLatestRates}
              disabled={fetching}
              title="Aktuelle Tageskurse abrufen"
            >
              {fetching ? '...' : '↻ Aktualisieren'}
            </button>
            <button
              className="button button-primary"
              onClick={() => {
                resetForm();
                setEditingRate(null);
                setShowAddModal(true);
              }}
            >
              + Manuell hinzufügen
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Währung</label>
            <select
              value={filterCurrency}
              onChange={(e) => setFilterCurrency(e.target.value)}
            >
              <option value="">Alle Währungen</option>
              {COMMON_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Kurstyp</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as RateType | '')}
            >
              <option value="">Alle Typen</option>
              <option value="spot">Stichtagskurs</option>
              <option value="average">Durchschnittskurs</option>
              <option value="historical">Historischer Kurs</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Geschäftsjahr</label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(parseInt(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Rates Table */}
        {loading ? (
          <div className="loading">
            <div className="loading-spinner"></div>
            <span>Lade Wechselkurse...</span>
          </div>
        ) : rates.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">Keine Wechselkurse vorhanden</div>
            <div className="empty-state-description">
              Fügen Sie Wechselkurse hinzu, um Währungsumrechnungen durchzuführen.
            </div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Von</th>
                <th>Nach</th>
                <th>Datum</th>
                <th>Kurs</th>
                <th>Typ</th>
                <th>Quelle</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((rate: any) => {
                // Handle both camelCase and snake_case field names
                const fromCurrency = rate.fromCurrency || rate.from_currency || '—';
                const toCurrency = rate.toCurrency || rate.to_currency || '—';
                const rateDate = rate.rateDate || rate.rate_date;
                const rateType = rate.rateType || rate.rate_type;
                const rateSource = rate.rateSource || rate.rate_source || '—';
                const rateValue = typeof rate.rate === 'number' ? rate.rate : parseFloat(rate.rate) || 0;
                
                // Format date safely
                let formattedDate = '—';
                if (rateDate) {
                  const dateObj = new Date(rateDate);
                  if (!isNaN(dateObj.getTime())) {
                    formattedDate = dateObj.toLocaleDateString('de-DE');
                  }
                }
                
                return (
                <tr key={rate.id}>
                  <td style={{ fontWeight: 'var(--font-weight-medium)', fontFamily: 'var(--font-family-mono)' }}>
                    {fromCurrency}
                  </td>
                  <td style={{ fontWeight: 'var(--font-weight-medium)', fontFamily: 'var(--font-family-mono)' }}>
                    {toCurrency}
                  </td>
                  <td>{formattedDate}</td>
                  <td style={{ fontFamily: 'var(--font-family-mono)' }}>
                    {rateValue.toFixed(6)}
                  </td>
                  <td>
                    <span className="badge badge-info">
                      {RATE_TYPE_LABELS[rateType as RateType] || rateType || '—'}
                    </span>
                  </td>
                  <td style={{ textTransform: 'capitalize' }}>{rateSource}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                      <button
                        className="button button-secondary"
                        onClick={() => handleEdit(rate)}
                        style={{ padding: 'var(--spacing-1) var(--spacing-2)' }}
                      >
                        ✏️
                      </button>
                      <button
                        className="button button-secondary"
                        onClick={() => handleDelete(rate.id)}
                        style={{ padding: 'var(--spacing-1) var(--spacing-2)' }}
                      >
                        🗑️
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

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingRate(null);
        }}
        title={editingRate ? 'Wechselkurs bearbeiten' : 'Neuer Wechselkurs'}
        size="md"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-row" style={{ display: 'flex', gap: 'var(--spacing-4)' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="fromCurrency">Von Währung *</label>
              <select
                id="fromCurrency"
                value={formData.fromCurrency}
                onChange={(e) => setFormData({ ...formData, fromCurrency: e.target.value })}
                required
              >
                {COMMON_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="toCurrency">Nach Währung *</label>
              <select
                id="toCurrency"
                value={formData.toCurrency}
                onChange={(e) => setFormData({ ...formData, toCurrency: e.target.value })}
                required
              >
                {COMMON_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row" style={{ display: 'flex', gap: 'var(--spacing-4)' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="rateDate">Datum *</label>
              <input
                type="date"
                id="rateDate"
                value={formData.rateDate}
                onChange={(e) => setFormData({ ...formData, rateDate: e.target.value })}
                required
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="rate">Kurs *</label>
              <input
                type="number"
                id="rate"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) })}
                step="0.000001"
                min="0"
                required
              />
            </div>
          </div>

          <div className="form-row" style={{ display: 'flex', gap: 'var(--spacing-4)' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="rateType">Kurstyp *</label>
              <select
                id="rateType"
                value={formData.rateType}
                onChange={(e) => setFormData({ ...formData, rateType: e.target.value as RateType })}
                required
              >
                <option value="spot">Stichtagskurs (Bilanz)</option>
                <option value="average">Durchschnittskurs (GuV)</option>
                <option value="historical">Historischer Kurs (Eigenkapital)</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="fiscalYear">Geschäftsjahr</label>
              <input
                type="number"
                id="fiscalYear"
                value={formData.fiscalYear || ''}
                onChange={(e) => setFormData({ ...formData, fiscalYear: parseInt(e.target.value) || undefined })}
                placeholder="z.B. 2026"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notizen</label>
            <textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Optionale Notizen zum Wechselkurs..."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-3)', marginTop: 'var(--spacing-4)' }}>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                setShowAddModal(false);
                setEditingRate(null);
              }}
            >
              Abbrechen
            </button>
            <button type="submit" className="button button-primary">
              {editingRate ? 'Speichern' : 'Erstellen'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ECB Fetch Modal */}
      <Modal
        isOpen={showFetchModal}
        onClose={() => setShowFetchModal(false)}
        title="EZB-Kurse abrufen"
        size="md"
      >
        <div style={{ marginBottom: 'var(--spacing-6)' }}>
          <div style={{ 
            padding: 'var(--spacing-4)', 
            background: 'rgba(11, 140, 238, 0.1)', 
            borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--spacing-4)',
          }}>
            <h4 style={{ margin: '0 0 var(--spacing-2) 0', color: 'var(--color-accent-blue)' }}>
              ℹ️ Automatische Kurspflege
            </h4>
            <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              Die Wechselkurse werden automatisch von der Europäischen Zentralbank (EZB) abgerufen. 
              Für HGB § 308a werden Stichtagskurse (Bilanz) und Durchschnittskurse (GuV) benötigt.
            </p>
          </div>

          {/* Fetch Latest Rates */}
          <div className="card" style={{ marginBottom: 'var(--spacing-4)', padding: 'var(--spacing-4)' }}>
            <h4 style={{ marginTop: 0 }}>Aktuelle Tageskurse (Spot)</h4>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              Ruft die aktuellen Tageskurse von der EZB ab. Ideal für laufende Bilanzierung.
            </p>
            <button
              className="button button-primary"
              onClick={handleFetchLatestRates}
              disabled={fetching}
            >
              {fetching ? 'Lädt...' : 'Aktuelle Kurse abrufen'}
            </button>
          </div>

          {/* Fetch Balance Sheet Date Rates */}
          <div className="card" style={{ marginBottom: 'var(--spacing-4)', padding: 'var(--spacing-4)' }}>
            <h4 style={{ marginTop: 0 }}>Stichtagskurse (Bilanzstichtag)</h4>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              Ruft Kurse für einen bestimmten Stichtag ab (z.B. Quartalsende, Jahresende).
            </p>
            <div style={{ display: 'flex', gap: 'var(--spacing-3)', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label>Stichtag</label>
                <input
                  type="date"
                  value={fetchDate}
                  onChange={(e) => setFetchDate(e.target.value)}
                />
              </div>
              <button
                className="button button-primary"
                onClick={handleFetchDateRates}
                disabled={fetching || !fetchDate}
              >
                {fetching ? 'Lädt...' : 'Stichtagskurse abrufen'}
              </button>
            </div>
          </div>

          {/* Calculate Average Rates */}
          <div className="card" style={{ padding: 'var(--spacing-4)' }}>
            <h4 style={{ marginTop: 0 }}>Durchschnittskurse berechnen</h4>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              Berechnet den Durchschnitt aller Tageskurse für einen Zeitraum (GuV-Umrechnung).
            </p>
            <div style={{ display: 'flex', gap: 'var(--spacing-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ minWidth: '120px', marginBottom: 0 }}>
                <label>Jahr</label>
                <select
                  value={fetchYear}
                  onChange={(e) => setFetchYear(parseInt(e.target.value))}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ minWidth: '150px', marginBottom: 0 }}>
                <label>Monat (optional)</label>
                <select
                  value={fetchMonth}
                  onChange={(e) => setFetchMonth(e.target.value ? parseInt(e.target.value) : '')}
                >
                  <option value="">Gesamtes Jahr</option>
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <button
                className="button button-primary"
                onClick={handleCalculateAverageRates}
                disabled={fetching}
              >
                {fetching ? 'Berechnet...' : 'Durchschnitt berechnen'}
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="button button-secondary"
            onClick={() => setShowFetchModal(false)}
          >
            Schließen
          </button>
        </div>
      </Modal>
    </div>
  );
}
