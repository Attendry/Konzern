import { useEffect, useState } from 'react';
import { exchangeRateService } from '../services/exchangeRateService';
import { ExchangeRate, Company } from '../types';
import { companyService } from '../services/companyService';
import { useToastContext } from '../contexts/ToastContext';
import '../App.css';

function CurrencyTranslation() {
  const { success, error: showError } = useToastContext();

  const [loading, setLoading] = useState(true);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [foreignCompanies, setForeignCompanies] = useState<Company[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [fetchingRate, setFetchingRate] = useState(false);

  // Add rate form
  const [rateForm, setRateForm] = useState({
    fromCurrency: 'USD',
    toCurrency: 'EUR',
    rate: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    source: 'manual' as 'ecb' | 'bundesbank' | 'manual',
    isClosingRate: true,
    isAverageRate: false,
  });

  const currencies = ['USD', 'GBP', 'CHF', 'JPY', 'CNY', 'PLN', 'CZK', 'HUF', 'SEK', 'NOK', 'DKK'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ratesData, companiesData] = await Promise.all([
        exchangeRateService.getExchangeRates(),
        companyService.getAll(),
      ]);
      
      setExchangeRates(ratesData);
      
      // Filter companies with foreign currency
      const foreign = companiesData.filter(c => c.functionalCurrency && c.functionalCurrency !== 'EUR');
      setForeignCompanies(foreign);
    } catch (err: any) {
      showError(`Fehler beim Laden: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchRateFromECB = async () => {
    setFetchingRate(true);
    try {
      const result = await exchangeRateService.getRate(
        rateForm.fromCurrency,
        rateForm.toCurrency,
        rateForm.effectiveDate,
        'spot',
      );
      setRateForm(prev => ({ ...prev, rate: result.rate.toString(), source: 'ecb' }));
      success('Kurs abgerufen');
    } catch (err: any) {
      // Try to fetch latest rates first
      try {
        await exchangeRateService.fetchRatesForDate(rateForm.effectiveDate);
        const result = await exchangeRateService.getRate(
          rateForm.fromCurrency,
          rateForm.toCurrency,
          rateForm.effectiveDate,
          'spot',
        );
        setRateForm(prev => ({ ...prev, rate: result.rate.toString(), source: 'ecb' }));
        success('Kurs von EZB abgerufen');
      } catch (innerErr: any) {
        showError(`Fehler beim Abrufen: ${innerErr.message || err.message}`);
      }
    } finally {
      setFetchingRate(false);
    }
  };

  const handleAddRate = async () => {
    if (!rateForm.rate) {
      showError('Bitte geben Sie einen Kurs ein');
      return;
    }

    try {
      const newRate = await exchangeRateService.upsertRate({
        fromCurrency: rateForm.fromCurrency,
        toCurrency: rateForm.toCurrency,
        rate: parseFloat(rateForm.rate),
        rateDate: rateForm.effectiveDate,
        rateType: rateForm.isAverageRate ? 'average' : 'spot',
        rateSource: rateForm.source,
      });
      setExchangeRates([newRate, ...exchangeRates]);
      setShowAddModal(false);
      setRateForm({
        fromCurrency: 'USD',
        toCurrency: 'EUR',
        rate: '',
        effectiveDate: new Date().toISOString().split('T')[0],
        source: 'manual',
        isClosingRate: true,
        isAverageRate: false,
      });
      success('Wechselkurs hinzugefügt');
    } catch (err: any) {
      showError(`Fehler beim Hinzufügen: ${err.message}`);
    }
  };

  const handleDeleteRate = async (id: string) => {
    if (!confirm('Möchten Sie diesen Wechselkurs wirklich löschen?')) return;

    try {
      await exchangeRateService.deleteRate(id);
      setExchangeRates(exchangeRates.filter(r => r.id !== id));
      success('Wechselkurs gelöscht');
    } catch (err: any) {
      showError(`Fehler beim Löschen: ${err.message}`);
    }
  };

  const getLatestRatesForDate = (date: string) => {
    const dateRates = exchangeRates.filter(r => r.rateDate === date);
    const rateMap = new Map<string, ExchangeRate>();
    
    dateRates.forEach(rate => {
      const key = `${rate.fromCurrency}-${rate.toCurrency}`;
      const existing = rateMap.get(key);
      if (!existing || (rate.createdAt && existing.createdAt && new Date(rate.createdAt) > new Date(existing.createdAt))) {
        rateMap.set(key, rate);
      }
    });

    return Array.from(rateMap.values());
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
        <span>Lade Währungsinformationen...</span>
      </div>
    );
  }

  const latestRates = getLatestRatesForDate(selectedDate);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-6)' }}>
        <h1>Währungsumrechnung (§ 308a HGB)</h1>
        <button className="button button-primary" onClick={() => setShowAddModal(true)}>
          + Wechselkurs hinzufügen
        </button>
      </div>

      {/* Foreign Companies Overview */}
      <div className="card">
        <div className="card-header">
          <h2>Tochtergesellschaften mit Fremdwährung</h2>
        </div>
        {foreignCompanies.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">Keine Fremdwährungsgesellschaften</div>
            <div className="empty-state-description">
              Alle Tochtergesellschaften verwenden EUR als Berichtswährung.
            </div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Unternehmen</th>
                <th>Währung</th>
                <th>Aktueller Kurs</th>
                <th>Umrechnungsmethode</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {foreignCompanies.map(company => {
                const rate = latestRates.find(r => r.fromCurrency === company.functionalCurrency && r.toCurrency === 'EUR');
                return (
                  <tr key={company.id}>
                    <td>{company.name}</td>
                    <td><span className="badge">{company.functionalCurrency}</span></td>
                    <td>
                      {rate ? (
                        <span>1 {company.functionalCurrency} = {(rate.rate || 0).toFixed(4)} EUR</span>
                      ) : (
                        <span className="badge badge-warning">Kein Kurs</span>
                      )}
                    </td>
                    <td>Stichtagskurs (§ 308a HGB)</td>
                    <td>
                      {rate ? (
                        <span className="badge badge-success">Bereit</span>
                      ) : (
                        <span className="badge badge-error">Kurs fehlt</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Exchange Rates */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Wechselkurse</h2>
          <div className="form-group" style={{ margin: 0, minWidth: '200px' }}>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>
        
        {/* Quick Actions */}
        <div style={{ display: 'flex', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-4)', flexWrap: 'wrap' }}>
          {currencies.slice(0, 5).map(currency => (
            <button
              key={currency}
              className="button button-secondary button-sm"
              onClick={() => {
                setRateForm(prev => ({
                  ...prev,
                  fromCurrency: currency,
                  effectiveDate: selectedDate,
                }));
                setShowAddModal(true);
              }}
            >
              + {currency}/EUR
            </button>
          ))}
        </div>

        {latestRates.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">Keine Kurse für {new Date(selectedDate).toLocaleDateString('de-DE')}</div>
            <div className="empty-state-description">
              Fügen Sie Wechselkurse hinzu oder wählen Sie ein anderes Datum.
            </div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Von</th>
                <th>Nach</th>
                <th>Kurs</th>
                <th>Typ</th>
                <th>Quelle</th>
                <th>Datum</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {latestRates.map(rate => (
                <tr key={rate.id}>
                  <td><span className="badge">{rate.fromCurrency}</span></td>
                  <td><span className="badge">{rate.toCurrency}</span></td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {(rate.rate || 0).toFixed(6)}
                  </td>
                  <td>
                    <span className={`badge ${rate.rateType === 'spot' ? 'badge-info' : 'badge-neutral'}`}>
                      {rate.rateType === 'spot' ? 'Stichtag' : rate.rateType === 'average' ? 'Durchschnitt' : rate.rateType}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${rate.rateSource === 'ecb' ? 'badge-success' : rate.rateSource === 'bundesbank' ? 'badge-info' : 'badge-neutral'}`}>
                      {rate.rateSource === 'ecb' ? 'EZB' : rate.rateSource === 'bundesbank' ? 'Bundesbank' : 'Manuell'}
                    </span>
                  </td>
                  <td>{new Date(rate.rateDate).toLocaleDateString('de-DE')}</td>
                  <td>
                    <button
                      className="button button-secondary button-sm"
                      onClick={() => handleDeleteRate(rate.id)}
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* All Rates History */}
      <div className="card">
        <div className="card-header">
          <h2>Kursverlauf</h2>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Währungspaar</th>
              <th>Kurs</th>
              <th>Quelle</th>
              <th>Typ</th>
            </tr>
          </thead>
          <tbody>
            {exchangeRates.slice(0, 20).map(rate => (
              <tr key={rate.id}>
                <td>{new Date(rate.rateDate).toLocaleDateString('de-DE')}</td>
                <td>{rate.fromCurrency}/{rate.toCurrency}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{(rate.rate || 0).toFixed(6)}</td>
                <td>
                  <span className={`badge ${rate.rateSource === 'ecb' ? 'badge-success' : 'badge-neutral'}`}>
                    {rate.rateSource === 'ecb' ? 'EZB' : 'Manuell'}
                  </span>
                </td>
                <td>
                  {rate.rateType === 'spot' && 'Stichtag'}
                  {rate.rateType === 'average' && 'Durchschnitt'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Rate Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Wechselkurs hinzufügen</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)' }}>
                <div className="form-group">
                  <label>Von Währung</label>
                  <select
                    value={rateForm.fromCurrency}
                    onChange={(e) => setRateForm(prev => ({ ...prev, fromCurrency: e.target.value }))}
                  >
                    {currencies.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Nach Währung</label>
                  <select
                    value={rateForm.toCurrency}
                    onChange={(e) => setRateForm(prev => ({ ...prev, toCurrency: e.target.value }))}
                  >
                    <option value="EUR">EUR</option>
                    {currencies.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Kurs</label>
                <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                  <input
                    type="number"
                    step="0.000001"
                    value={rateForm.rate}
                    onChange={(e) => setRateForm(prev => ({ ...prev, rate: e.target.value }))}
                    placeholder="z.B. 0.920500"
                  />
                  <button
                    className="button button-secondary"
                    onClick={fetchRateFromECB}
                    disabled={fetchingRate}
                  >
                    {fetchingRate ? 'Lade...' : 'Von EZB abrufen'}
                  </button>
                </div>
                <small style={{ color: 'var(--color-text-secondary)' }}>
                  1 {rateForm.fromCurrency} = ? {rateForm.toCurrency}
                </small>
              </div>

              <div className="form-group">
                <label>Stichtag</label>
                <input
                  type="date"
                  value={rateForm.effectiveDate}
                  onChange={(e) => setRateForm(prev => ({ ...prev, effectiveDate: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label>Quelle</label>
                <select
                  value={rateForm.source}
                  onChange={(e) => setRateForm(prev => ({ ...prev, source: e.target.value as any }))}
                >
                  <option value="manual">Manuell</option>
                  <option value="ecb">EZB</option>
                  <option value="bundesbank">Bundesbank</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 'var(--spacing-4)' }}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={rateForm.isClosingRate}
                    onChange={(e) => setRateForm(prev => ({ ...prev, isClosingRate: e.target.checked }))}
                  />
                  Stichtagskurs
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={rateForm.isAverageRate}
                    onChange={(e) => setRateForm(prev => ({ ...prev, isAverageRate: e.target.checked }))}
                  />
                  Durchschnittskurs
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="button button-secondary" onClick={() => setShowAddModal(false)}>
                Abbrechen
              </button>
              <button className="button button-primary" onClick={handleAddRate}>
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CurrencyTranslation;
