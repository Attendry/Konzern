import { useState, useEffect } from 'react';
import { 
  ConsolidationEntry, 
  Account, 
  Company,
  AdjustmentType, 
  HgbReference,
  CreateConsolidationEntryRequest,
  UpdateConsolidationEntryRequest,
} from '../types';
import { Modal } from './Modal';
import '../App.css';

interface ManualEntryFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (entry: CreateConsolidationEntryRequest | UpdateConsolidationEntryRequest) => Promise<void>;
  financialStatementId: string;
  accounts: Account[];
  companies: Company[];
  editEntry?: ConsolidationEntry | null;
}

// Adjustment type options with German labels
const ADJUSTMENT_TYPE_OPTIONS: { value: AdjustmentType; label: string }[] = [
  { value: 'capital_consolidation', label: 'Kapitalkonsolidierung (§ 301 HGB)' },
  { value: 'debt_consolidation', label: 'Schuldenkonsolidierung (§ 303 HGB)' },
  { value: 'intercompany_profit', label: 'Zwischenergebniseliminierung (§ 304 HGB)' },
  { value: 'income_expense', label: 'Aufwands-/Ertragskonsolidierung (§ 305 HGB)' },
  { value: 'currency_translation', label: 'Währungsumrechnung (§ 308a HGB)' },
  { value: 'deferred_tax', label: 'Latente Steuern (§ 306 HGB)' },
  { value: 'minority_interest', label: 'Minderheitenanteile (§ 307 HGB)' },
  { value: 'elimination', label: 'Sonstige Eliminierung' },
  { value: 'reclassification', label: 'Umgliederung' },
  { value: 'other', label: 'Sonstige' },
];

// HGB reference options
const HGB_REFERENCE_OPTIONS: { value: HgbReference; label: string }[] = [
  { value: '§ 301 HGB', label: '§ 301 HGB - Kapitalkonsolidierung' },
  { value: '§ 303 HGB', label: '§ 303 HGB - Schuldenkonsolidierung' },
  { value: '§ 304 HGB', label: '§ 304 HGB - Zwischenergebniseliminierung' },
  { value: '§ 305 HGB', label: '§ 305 HGB - Aufwands-/Ertragskonsolidierung' },
  { value: '§ 306 HGB', label: '§ 306 HGB - Latente Steuern' },
  { value: '§ 307 HGB', label: '§ 307 HGB - Anteile anderer Gesellschafter' },
  { value: '§ 308 HGB', label: '§ 308 HGB - Einheitliche Bewertung' },
  { value: '§ 308a HGB', label: '§ 308a HGB - Währungsumrechnung' },
  { value: '§ 312 HGB', label: '§ 312 HGB - Equity-Methode' },
  { value: 'Sonstige', label: 'Sonstige' },
];

export function ManualEntryForm({
  isOpen,
  onClose,
  onSubmit,
  financialStatementId,
  accounts,
  companies,
  editEntry,
}: ManualEntryFormProps) {
  const [debitAccountId, setDebitAccountId] = useState('');
  const [creditAccountId, setCreditAccountId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('other');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [hgbReference, setHgbReference] = useState<HgbReference | ''>('');
  const [affectedCompanyIds, setAffectedCompanyIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when opening/closing or when editEntry changes
  useEffect(() => {
    if (isOpen) {
      if (editEntry) {
        setDebitAccountId(editEntry.debitAccountId || '');
        setCreditAccountId(editEntry.creditAccountId || '');
        setAdjustmentType(editEntry.adjustmentType);
        setAmount(String(editEntry.amount));
        setDescription(editEntry.description || '');
        setHgbReference(editEntry.hgbReference || '');
        setAffectedCompanyIds(editEntry.affectedCompanyIds || []);
      } else {
        resetForm();
      }
    }
  }, [isOpen, editEntry]);

  const resetForm = () => {
    setDebitAccountId('');
    setCreditAccountId('');
    setAdjustmentType('other');
    setAmount('');
    setDescription('');
    setHgbReference('');
    setAffectedCompanyIds([]);
    setErrors({});
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!debitAccountId) {
      newErrors.debitAccountId = 'Soll-Konto ist erforderlich';
    }
    if (!creditAccountId) {
      newErrors.creditAccountId = 'Haben-Konto ist erforderlich';
    }
    if (debitAccountId && creditAccountId && debitAccountId === creditAccountId) {
      newErrors.creditAccountId = 'Soll- und Haben-Konto müssen unterschiedlich sein';
    }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      newErrors.amount = 'Gültiger Betrag > 0 erforderlich';
    }
    if (!adjustmentType) {
      newErrors.adjustmentType = 'Buchungsart ist erforderlich';
    }
    if (!description || description.trim().length < 10) {
      newErrors.description = 'Beschreibung (mind. 10 Zeichen) erforderlich';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (editEntry) {
        // Update existing entry
        const updateData: UpdateConsolidationEntryRequest = {
          debitAccountId,
          creditAccountId,
          adjustmentType,
          amount: parseFloat(amount),
          description,
          hgbReference: hgbReference || undefined,
          affectedCompanyIds: affectedCompanyIds.length > 0 ? affectedCompanyIds : undefined,
        };
        await onSubmit(updateData);
      } else {
        // Create new entry
        const createData: CreateConsolidationEntryRequest = {
          financialStatementId,
          debitAccountId,
          creditAccountId,
          adjustmentType,
          amount: parseFloat(amount),
          description,
          source: 'manual',
          hgbReference: hgbReference || undefined,
          affectedCompanyIds: affectedCompanyIds.length > 0 ? affectedCompanyIds : undefined,
        };
        await onSubmit(createData);
      }
      
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error submitting entry:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompanyToggle = (companyId: string) => {
    setAffectedCompanyIds(prev => 
      prev.includes(companyId) 
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId]
    );
  };

  // Group accounts by type for easier selection
  const groupedAccounts = accounts.reduce((groups, account) => {
    const type = account.accountType || 'other';
    if (!groups[type]) groups[type] = [];
    groups[type].push(account);
    return groups;
  }, {} as Record<string, Account[]>);

  const accountTypeLabels: Record<string, string> = {
    asset: 'Aktiva',
    liability: 'Passiva',
    equity: 'Eigenkapital',
    revenue: 'Erträge',
    expense: 'Aufwendungen',
    other: 'Sonstige',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editEntry ? 'Konsolidierungsbuchung bearbeiten' : 'Neue Konsolidierungsbuchung'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="manual-entry-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="adjustmentType">Buchungsart *</label>
            <select
              id="adjustmentType"
              value={adjustmentType}
              onChange={(e) => setAdjustmentType(e.target.value as AdjustmentType)}
              className={errors.adjustmentType ? 'error' : ''}
            >
              {ADJUSTMENT_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {errors.adjustmentType && <span className="error-text">{errors.adjustmentType}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="hgbReference">HGB-Referenz</label>
            <select
              id="hgbReference"
              value={hgbReference}
              onChange={(e) => setHgbReference(e.target.value as HgbReference)}
            >
              <option value="">-- Optional --</option>
              {HGB_REFERENCE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-section">
          <h4>Buchungssatz</h4>
          <div className="booking-entry">
            <div className="form-row">
              <div className="form-group flex-2">
                <label htmlFor="debitAccountId">Soll-Konto *</label>
                <select
                  id="debitAccountId"
                  value={debitAccountId}
                  onChange={(e) => setDebitAccountId(e.target.value)}
                  className={errors.debitAccountId ? 'error' : ''}
                >
                  <option value="">-- Konto auswählen --</option>
                  {Object.entries(groupedAccounts).map(([type, accts]) => (
                    <optgroup key={type} label={accountTypeLabels[type] || type}>
                      {accts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.accountNumber} - {account.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {errors.debitAccountId && <span className="error-text">{errors.debitAccountId}</span>}
              </div>

              <div className="form-group flex-1">
                <label htmlFor="amount">Betrag (EUR) *</label>
                <input
                  type="number"
                  id="amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="0.01"
                  step="0.01"
                  placeholder="0,00"
                  className={errors.amount ? 'error' : ''}
                />
                {errors.amount && <span className="error-text">{errors.amount}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group flex-2">
                <label htmlFor="creditAccountId">Haben-Konto *</label>
                <select
                  id="creditAccountId"
                  value={creditAccountId}
                  onChange={(e) => setCreditAccountId(e.target.value)}
                  className={errors.creditAccountId ? 'error' : ''}
                >
                  <option value="">-- Konto auswählen --</option>
                  {Object.entries(groupedAccounts).map(([type, accts]) => (
                    <optgroup key={type} label={accountTypeLabels[type] || type}>
                      {accts.map(account => (
                        <option key={account.id} value={account.id}>
                          {account.accountNumber} - {account.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {errors.creditAccountId && <span className="error-text">{errors.creditAccountId}</span>}
              </div>

              <div className="form-group flex-1">
                <label>&nbsp;</label>
                <div className="amount-preview">
                  {amount && !isNaN(parseFloat(amount)) && (
                    <span className="amount-value">
                      {parseFloat(amount).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="description">Beschreibung / Begründung *</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Beschreiben Sie den Grund für diese Buchung..."
            className={errors.description ? 'error' : ''}
          />
          {errors.description && <span className="error-text">{errors.description}</span>}
        </div>

        {companies.length > 0 && (
          <div className="form-group">
            <label>Betroffene Gesellschaften</label>
            <div className="company-checkboxes">
              {companies.map(company => (
                <label key={company.id} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={affectedCompanyIds.includes(company.id)}
                    onChange={() => handleCompanyToggle(company.id)}
                  />
                  <span>{company.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Abbrechen
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Speichern...' : editEntry ? 'Änderungen speichern' : 'Buchung erstellen'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
