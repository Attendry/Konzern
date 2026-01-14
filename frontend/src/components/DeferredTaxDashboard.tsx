import React, { useState, useEffect } from 'react';
import { DeferredTax, DeferredTaxSummary, DeferredTaxSource } from '../types';
import deferredTaxService from '../services/deferredTaxService';
import { useToast } from '../contexts/ToastContext';

interface DeferredTaxDashboardProps {
  financialStatementId: string;
  onClose?: () => void;
}

const SOURCE_LABELS: Record<DeferredTaxSource, string> = {
  capital_consolidation: 'Kapitalkonsolidierung',
  debt_consolidation: 'Schuldenkonsolidierung',
  intercompany_profit: 'Zwischenergebniseliminierung',
  income_expense: 'Aufwands-/Ertragskonsolidierung',
  hidden_reserves: 'Stille Reserven',
  goodwill: 'Geschäfts-/Firmenwert',
  pension_provisions: 'Pensionsrückstellungen',
  valuation_adjustment: 'Bewertungsanpassung',
  other: 'Sonstige',
};

const DeferredTaxDashboard: React.FC<DeferredTaxDashboardProps> = ({
  financialStatementId,
  onClose,
}) => {
  const [deferredTaxes, setDeferredTaxes] = useState<DeferredTax[]>([]);
  const [summary, setSummary] = useState<DeferredTaxSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [taxRate, setTaxRate] = useState<number>(30);
  const { showToast } = useToast();

  useEffect(() => {
    loadData();
  }, [financialStatementId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [taxes, sum] = await Promise.all([
        deferredTaxService.getDeferredTaxes(financialStatementId),
        deferredTaxService.getSummary(financialStatementId),
      ]);
      setDeferredTaxes(taxes);
      setSummary(sum);
    } catch (error) {
      console.error('Error loading deferred taxes:', error);
      showToast('Fehler beim Laden der latenten Steuern', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = async () => {
    try {
      setCalculating(true);
      const result = await deferredTaxService.calculateDeferredTaxes(financialStatementId, taxRate);
      setDeferredTaxes(result.deferredTaxes);
      setSummary(result.summary);
      showToast(`${result.deferredTaxes.length} latente Steuerpositionen berechnet`, 'success');
    } catch (error) {
      console.error('Error calculating deferred taxes:', error);
      showToast('Fehler bei der Berechnung der latenten Steuern', 'error');
    } finally {
      setCalculating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Möchten Sie diese Position wirklich löschen?')) return;
    
    try {
      await deferredTaxService.delete(id);
      showToast('Position gelöscht', 'success');
      loadData();
    } catch (error) {
      console.error('Error deleting deferred tax:', error);
      showToast('Fehler beim Löschen', 'error');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);
  };

  if (loading) {
    return <div className="loading">Lade latente Steuern...</div>;
  }

  return (
    <div className="deferred-tax-dashboard">
      <div className="dashboard-header">
        <h2>Latente Steuern (§ 306 HGB)</h2>
        {onClose && (
          <button className="btn-close" onClick={onClose}>×</button>
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="summary-cards">
          <div className="summary-card positive">
            <h4>Aktive latente Steuern</h4>
            <p className="amount">{formatCurrency(summary.totalDeferredTaxAssets)}</p>
          </div>
          <div className="summary-card negative">
            <h4>Passive latente Steuern</h4>
            <p className="amount">{formatCurrency(summary.totalDeferredTaxLiabilities)}</p>
          </div>
          <div className="summary-card">
            <h4>Netto latente Steuern</h4>
            <p className={`amount ${summary.netDeferredTax >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(summary.netDeferredTax)}
            </p>
          </div>
          <div className="summary-card">
            <h4>Veränderung VJ</h4>
            <p className={`amount ${summary.changeFromPriorYear >= 0 ? 'positive' : 'negative'}`}>
              {summary.changeFromPriorYear >= 0 ? '+' : ''}{formatCurrency(summary.changeFromPriorYear)}
            </p>
          </div>
        </div>
      )}

      {/* Calculation Controls */}
      <div className="calculation-controls">
        <div className="tax-rate-input">
          <label>Steuersatz (%)</label>
          <input
            type="number"
            value={taxRate}
            onChange={(e) => setTaxRate(Number(e.target.value))}
            min={0}
            max={100}
            step={0.1}
          />
        </div>
        <button
          className="btn-primary"
          onClick={handleCalculate}
          disabled={calculating}
        >
          {calculating ? 'Berechne...' : 'Latente Steuern berechnen'}
        </button>
      </div>

      {/* By Source Breakdown */}
      {summary && summary.bySource.length > 0 && (
        <div className="source-breakdown">
          <h3>Aufgliederung nach Entstehungsgrund</h3>
          <table className="breakdown-table">
            <thead>
              <tr>
                <th>Quelle</th>
                <th className="text-right">Aktiv</th>
                <th className="text-right">Passiv</th>
                <th className="text-right">Netto</th>
              </tr>
            </thead>
            <tbody>
              {summary.bySource.map((item) => (
                <tr key={item.source}>
                  <td>{SOURCE_LABELS[item.source]}</td>
                  <td className="text-right positive">{formatCurrency(item.assets)}</td>
                  <td className="text-right negative">{formatCurrency(item.liabilities)}</td>
                  <td className={`text-right ${item.assets - item.liabilities >= 0 ? 'positive' : 'negative'}`}>
                    {formatCurrency(item.assets - item.liabilities)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detailed List */}
      <div className="deferred-tax-list">
        <h3>Detailaufstellung</h3>
        {deferredTaxes.length === 0 ? (
          <p className="empty-state">Keine latenten Steuern vorhanden. Klicken Sie auf "Latente Steuern berechnen", um die Berechnung durchzuführen.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Beschreibung</th>
                <th>Typ</th>
                <th>Quelle</th>
                <th className="text-right">Temp. Differenz</th>
                <th className="text-right">Steuersatz</th>
                <th className="text-right">Lat. Steuer</th>
                <th>Status</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {deferredTaxes.map((dt) => (
                <tr key={dt.id}>
                  <td title={dt.description}>{dt.description.substring(0, 50)}...</td>
                  <td>
                    <span className={`badge ${dt.differenceType === 'deductible' ? 'badge-success' : 'badge-warning'}`}>
                      {dt.differenceType === 'deductible' ? 'Aktiv' : 'Passiv'}
                    </span>
                  </td>
                  <td>{SOURCE_LABELS[dt.source]}</td>
                  <td className="text-right">{formatCurrency(dt.temporaryDifferenceAmount)}</td>
                  <td className="text-right">{dt.taxRate}%</td>
                  <td className="text-right">{formatCurrency(dt.deferredTaxAmount)}</td>
                  <td>
                    <span className={`badge ${dt.status === 'active' ? 'badge-success' : 'badge-secondary'}`}>
                      {dt.status === 'active' ? 'Aktiv' : dt.status === 'reversed' ? 'Aufgelöst' : 'Abgeschrieben'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn-icon"
                      onClick={() => handleDelete(dt.id)}
                      title="Löschen"
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

      {/* HGB Note */}
      <div className="hgb-note">
        <h4>§ 306 HGB - Latente Steuern</h4>
        <p>
          Für temporäre Differenzen aus Konsolidierungsmaßnahmen sind latente Steuern zu bilanzieren. 
          Der aktive Überhang darf nur angesetzt werden, wenn mit ausreichender Sicherheit davon 
          ausgegangen werden kann, dass er realisiert werden kann.
        </p>
      </div>
    </div>
  );
};

export default DeferredTaxDashboard;
