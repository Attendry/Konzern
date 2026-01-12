import { SelectHTMLAttributes, ReactNode } from 'react';
import '../App.css';

interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface FormSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label: string;
  options: SelectOption[];
  error?: string;
  helperText?: string;
  floatingLabel?: boolean;
  icon?: ReactNode;
}

export function FormSelect({
  label,
  options,
  error,
  helperText,
  floatingLabel = false,
  icon,
  className = '',
  value,
  ...props
}: FormSelectProps) {
  const selectId = props.id || `select-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const hasValue = !!value;
  const isFloating = floatingLabel && hasValue;

  return (
    <div className={`form-select-wrapper ${error ? 'has-error' : ''} ${className}`}>
      {!floatingLabel && (
        <label htmlFor={selectId} className="form-label">
          {label}
          {props.required && <span className="form-required">*</span>}
        </label>
      )}
      <div className="form-select-container">
        {icon && <span className="form-select-icon">{icon}</span>}
        <select
          {...props}
          id={selectId}
          value={value}
          className={`form-select ${floatingLabel ? 'floating-label' : ''} ${icon ? 'with-icon' : ''}`}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
        >
          {props.placeholder && (
            <option value="" disabled>
              {props.placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        {floatingLabel && (
          <label
            htmlFor={selectId}
            className={`form-label-floating ${isFloating ? 'floating' : ''}`}
          >
            {label}
            {props.required && <span className="form-required">*</span>}
          </label>
        )}
        <span className="form-select-arrow">▼</span>
      </div>
      {error && (
        <div id={`${selectId}-error`} className="form-error" role="alert">
          {error}
        </div>
      )}
      {helperText && !error && (
        <div id={`${selectId}-helper`} className="form-helper">
          {helperText}
        </div>
      )}
    </div>
  );
}