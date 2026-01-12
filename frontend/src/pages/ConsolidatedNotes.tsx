import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { consolidatedNotesService, ConsolidatedNotes } from '../services/consolidatedNotesService';
import '../App.css';

function ConsolidatedNotesPage() {
  const { id } = useParams<{ id: string }>();
  const [notes, setNotes] = useState<ConsolidatedNotes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (id) {
      loadNotes();
    }
  }, [id]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await consolidatedNotesService.get(id!);
      setNotes(data);
    } catch (err: any) {
      console.error('Error loading consolidated notes:', err);
      setError(err.response?.data?.message || err.message || 'Fehler beim Laden des Konzernanhangs');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'json' | 'text') => {
    if (!id) return;
    try {
      setExporting(true);
      const blob = format === 'json'
        ? await consolidatedNotesService.exportJson(id)
        : await consolidatedNotesService.exportText(id);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `konzernanhang_${notes?.fiscalYear || 'export'}.${format === 'json' ? 'json' : 'txt'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Error exporting notes:', err);
      // Error handling - could add toast here if needed
      console.error('Fehler beim Export:', err);
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="card">
        <p>Lade Konzernanhang...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ backgroundColor: '#fee', border: '1px solid #fcc' }}>
        <p style={{ color: '#c33' }}>Fehler: {error}</p>
        <button onClick={loadNotes} style={{ marginTop: '1rem' }}>
          Erneut laden
        </button>
      </div>
    );
  }

  if (!notes) {
    return (
      <div className="card">
        <p>Keine Konzernanhang-Daten verfügbar.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>Konzernanhang</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => handleExport('text')}
            disabled={exporting}
            className="button"
          >
            {exporting ? 'Exportiere...' : 'Als Text exportieren'}
          </button>
          <button
            onClick={() => handleExport('json')}
            disabled={exporting}
            className="button"
          >
            {exporting ? 'Exportiere...' : 'Als JSON exportieren'}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Grundlagen</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <strong>Geschäftsjahr:</strong> {notes.fiscalYear}
          </div>
          <div>
            <strong>Zeitraum:</strong> {new Date(notes.periodStart).toLocaleDateString('de-DE')} - {new Date(notes.periodEnd).toLocaleDateString('de-DE')}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>1. Konsolidierungsmethoden</h2>
        {notes.consolidationMethods.map((method, index) => (
          <div key={index} style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
            <h3>{method.method === 'full_consolidation' ? 'Vollkonsolidierung' : method.method}</h3>
            <p>{method.description}</p>
            <p style={{ fontSize: '0.875rem', color: '#666' }}>HGB-Referenz: {method.hgbReference}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>2. Konsolidierungskreis</h2>
        <div style={{ marginBottom: '1rem' }}>
          <strong>Mutterunternehmen:</strong> {notes.consolidationScope.parentCompany.name}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <strong>Anzahl konsolidierter Unternehmen:</strong> {notes.consolidationScope.consolidatedCompanies}
          </div>
          <div>
            <strong>Anzahl ausgeschlossener Unternehmen:</strong> {notes.consolidationScope.excludedCompanies}
          </div>
        </div>
        <h3>Tochtergesellschaften</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Beteiligungsquote</th>
              <th>Konsolidierungsmethode</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {notes.consolidationScope.subsidiaries.map((subsidiary) => (
              <tr key={subsidiary.id}>
                <td>{subsidiary.name}</td>
                <td>{subsidiary.participationPercentage.toFixed(2)}%</td>
                <td>{subsidiary.consolidationMethod}</td>
                <td>
                  {subsidiary.excludedFrom ? (
                    <span style={{ color: '#e74c3c' }}>
                      Ausgeschlossen: {subsidiary.exclusionReason}
                    </span>
                  ) : (
                    <span style={{ color: '#27ae60' }}>Einbezogen</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>3. Goodwill-Aufschlüsselung</h2>
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <strong>Gesamt:</strong> {formatCurrency(notes.goodwillBreakdown.total)}
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Tochtergesellschaft</th>
              <th>Goodwill</th>
              <th>Passivischer Unterschiedsbetrag</th>
              <th>Erwerbskosten</th>
              <th>Erwerbsdatum</th>
            </tr>
          </thead>
          <tbody>
            {notes.goodwillBreakdown.breakdown.map((item) => (
              <tr key={item.subsidiaryCompanyId}>
                <td>{item.subsidiaryCompanyName}</td>
                <td>{formatCurrency(item.goodwill)}</td>
                <td>{item.negativeGoodwill > 0 ? formatCurrency(item.negativeGoodwill) : '-'}</td>
                <td>{item.acquisitionCost ? formatCurrency(item.acquisitionCost) : '-'}</td>
                <td>{item.acquisitionDate ? new Date(item.acquisitionDate).toLocaleDateString('de-DE') : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>4. Minderheitsanteile</h2>
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <strong>Gesamt:</strong> {formatCurrency(notes.minorityInterestsBreakdown.total)}
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Tochtergesellschaft</th>
              <th>Minderheitsanteil</th>
              <th>Minderheitsanteile Eigenkapital</th>
              <th>Minderheitsanteile Ergebnis</th>
            </tr>
          </thead>
          <tbody>
            {notes.minorityInterestsBreakdown.breakdown.map((item) => (
              <tr key={item.subsidiaryCompanyId}>
                <td>{item.subsidiaryCompanyName}</td>
                <td>{item.minorityPercentage.toFixed(2)}%</td>
                <td>{formatCurrency(item.minorityEquity)}</td>
                <td>{formatCurrency(item.minorityResult)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>5. Zwischengesellschaftsgeschäfte</h2>
        {notes.intercompanyTransactions.length === 0 ? (
          <p>Keine Zwischengesellschaftsgeschäfte vorhanden.</p>
        ) : (
          notes.intercompanyTransactions.map((transaction, index) => (
            <div key={index} style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <h3>{transaction.description}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <strong>Gesamtbetrag:</strong> {formatCurrency(transaction.totalAmount)}
                </div>
                <div>
                  <strong>Eliminiert:</strong> {formatCurrency(transaction.eliminatedAmount)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <h2>6. Bilanzierungs- und Bewertungsmethoden</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <strong>Konsolidierungsmethode:</strong> {notes.accountingPolicies.consolidationMethod}
          </div>
          <div>
            <strong>Währung:</strong> {notes.accountingPolicies.currency}
          </div>
          <div>
            <strong>Geschäftsjahresende:</strong> {notes.accountingPolicies.fiscalYearEnd}
          </div>
          <div>
            <strong>Bewertungsmethoden:</strong>
            <ul>
              {notes.accountingPolicies.valuationMethods.map((method, index) => (
                <li key={index}>{method}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {notes.significantEvents.length > 0 && (
        <div className="card">
          <h2>7. Wesentliche Ereignisse</h2>
          <ul>
            {notes.significantEvents.map((event, index) => (
              <li key={index}>{event}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2>HGB-Referenzen</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {notes.hgbReferences.map((ref, index) => (
            <span
              key={index}
              style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: '#e9ecef',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            >
              {ref}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ConsolidatedNotesPage;
