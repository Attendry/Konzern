import React, { useState } from 'react';
import { Callout } from './Callout';
import './GoodwillCalculator.css';

export function GoodwillCalculator() {
  const [kaufpreis, setKaufpreis] = useState<string>('');
  const [zeitwertEigenkapital, setZeitwertEigenkapital] = useState<string>('');
  const [beteiligung, setBeteiligung] = useState<string>('100');

  const kaufpreisNum = parseFloat(kaufpreis) || 0;
  const zeitwertNum = parseFloat(zeitwertEigenkapital) || 0;
  const beteiligungNum = parseFloat(beteiligung) || 100;
  const anteiligerZeitwert = (zeitwertNum * beteiligungNum) / 100;
  const goodwill = kaufpreisNum - anteiligerZeitwert;
  const minderheitenanteil = zeitwertNum - anteiligerZeitwert;

  return (
    <div className="goodwill-calculator">
      <h3 className="calculator-title">Goodwill-Rechner</h3>
      <p className="calculator-description">
        Berechnen Sie den Goodwill bei Erstkonsolidierung nach HGB.
      </p>

      <div className="calculator-form">
        <div className="calculator-field">
          <label htmlFor="kaufpreis">Kaufpreis (EUR)</label>
          <input
            id="kaufpreis"
            type="number"
            value={kaufpreis}
            onChange={(e) => setKaufpreis(e.target.value)}
            placeholder="z.B. 1000000"
            step="0.01"
          />
        </div>

        <div className="calculator-field">
          <label htmlFor="zeitwert">Zeitwert Eigenkapital (EUR)</label>
          <input
            id="zeitwert"
            type="number"
            value={zeitwertEigenkapital}
            onChange={(e) => setZeitwertEigenkapital(e.target.value)}
            placeholder="z.B. 800000"
            step="0.01"
          />
        </div>

        <div className="calculator-field">
          <label htmlFor="beteiligung">Beteiligungsquote (%)</label>
          <input
            id="beteiligung"
            type="number"
            value={beteiligung}
            onChange={(e) => setBeteiligung(e.target.value)}
            placeholder="100"
            min="0"
            max="100"
            step="0.1"
          />
        </div>
      </div>

      {(kaufpreisNum > 0 || zeitwertNum > 0) && (
        <div className="calculator-results">
          <div className="result-item">
            <span className="result-label">Anteiliger Zeitwert:</span>
            <span className="result-value">
              {anteiligerZeitwert.toLocaleString('de-DE', { 
                style: 'currency', 
                currency: 'EUR',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </span>
          </div>

          <div className="result-item highlight">
            <span className="result-label">Goodwill:</span>
            <span className={`result-value ${goodwill < 0 ? 'negative' : ''}`}>
              {goodwill.toLocaleString('de-DE', { 
                style: 'currency', 
                currency: 'EUR',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </span>
          </div>

          {beteiligungNum < 100 && (
            <div className="result-item">
              <span className="result-label">Minderheitenanteil:</span>
              <span className="result-value">
                {minderheitenanteil.toLocaleString('de-DE', { 
                  style: 'currency', 
                  currency: 'EUR',
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </span>
            </div>
          )}

          {goodwill < 0 && (
            <Callout type="warning">
              <strong>Negativer Goodwill:</strong> Der Kaufpreis liegt unter dem anteiligen Zeitwert. 
              Dies kann auf einen günstigen Kaufpreis oder versteckte Verbindlichkeiten hinweisen. 
              Prüfen Sie die Bewertung der Vermögensgegenstände und Schulden.
            </Callout>
          )}
        </div>
      )}

      <Callout type="info">
        <strong>Formel:</strong> Goodwill = Kaufpreis - (Zeitwert Eigenkapital × Beteiligungsquote / 100)
      </Callout>
    </div>
  );
}
