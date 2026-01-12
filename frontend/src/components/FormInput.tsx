import { useState, useRef, useEffect, InputHTMLAttributes } from 'react';
import '../App.css';

interface FormInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'placeholder'> {
  label: string;
  error?: string;
  helperText?: string;
  floatingLabel?: boolean;
  icon?: React.ReactNode;
  onIconClick?: () => void;
}

export function FormInput({
  label,
  error,
  helperText,
  floatingLabel = false,
  icon,
  onIconClick,
  className = '',
  value,
  ...props
}: FormInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [hasValue, setHasValue] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHasValue(!!(value || inputRef.current?.value));
  }, [value]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    props.onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    setHasValue(!!e.target.value);
    props.onBlur?.(e);
  };

  const inputId = props.id || `input-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const isFloating = floatingLabel && (isFocused || hasValue);

  return (
    <div className={`form-input-wrapper ${error ? 'has-error' : ''} ${className}`}>
      {!floatingLabel && (
        <label htmlFor={inputId} className="form-label">
          {label}
          {props.required && <span className="form-required">*</span>}
        </label>
      )}
      <div className="form-input-container">
        {icon && (
          <span className={`form-input-icon ${onIconClick ? 'clickable' : ''}`} onClick={onIconClick}>
            {icon}
          </span>
        )}
        <input
          {...props}
          ref={inputRef}
          id={inputId}
          value={value}
          className={`form-input ${floatingLabel ? 'floating-label' : ''} ${icon ? 'with-icon' : ''}`}
          onFocus={handleFocus}
          onBlur={handleBlur}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
        />
        {floatingLabel && (
          <label
            htmlFor={inputId}
            className={`form-label-floating ${isFloating ? 'floating' : ''}`}
          >
            {label}
            {props.required && <span className="form-required">*</span>}
          </label>
        )}
      </div>
      {error && (
        <div id={`${inputId}-error`} className="form-error" role="alert">
          {error}
        </div>
      )}
      {helperText && !error && (
        <div id={`${inputId}-helper`} className="form-helper">
          {helperText}
        </div>
      )}
    </div>
  );
}