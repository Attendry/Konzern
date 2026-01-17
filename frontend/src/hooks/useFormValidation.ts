import { useState, useCallback } from 'react';
import { uiAuditService } from '../services/uiAuditService';
import { useAuth } from '../contexts/AuthContext';

export interface ValidationRule<T> {
  /** Field name */
  field: keyof T;
  /** Validation function - returns error message or null */
  validate: (value: any, formData: T) => string | null;
  /** When to validate: 'onBlur' | 'onChange' | 'onSubmit' */
  trigger?: 'onBlur' | 'onChange' | 'onSubmit';
}

export interface UseFormValidationOptions<T> {
  /** Validation rules */
  rules: ValidationRule<T>[];
  /** Whether to log validation failures */
  logFailures?: boolean;
  /** Page/context for logging */
  context?: string;
}

export interface UseFormValidationReturn<T> {
  /** Validation errors by field */
  errors: Partial<Record<keyof T, string>>;
  /** Whether form is valid */
  isValid: boolean;
  /** Validate single field */
  validateField: (field: keyof T, value: any, formData: T) => void;
  /** Validate all fields */
  validateAll: (formData: T) => boolean;
  /** Clear errors for a field */
  clearError: (field: keyof T) => void;
  /** Clear all errors */
  clearAll: () => void;
  /** Set error manually */
  setError: (field: keyof T, message: string) => void;
}

/**
 * Hook for form validation with audit logging
 * 
 * Features:
 * - Field-level validation
 * - Multiple validation triggers
 * - Audit logging for validation failures
 * - Financial data validation helpers
 */
export function useFormValidation<T extends Record<string, any>>(
  options: UseFormValidationOptions<T>
): UseFormValidationReturn<T> {
  const { rules, logFailures = true, context } = options;
  const { user } = useAuth();
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  const validateField = useCallback(
    (field: keyof T, value: any, formData: T) => {
      const rule = rules.find(r => r.field === field);
      if (!rule) return;

      const error = rule.validate(value, formData);
      
      if (error) {
        setErrors(prev => ({ ...prev, [field]: error }));
        
        // Log validation failure if enabled
        if (logFailures && context) {
          uiAuditService.logPermissionDenied(
            {
              action: 'form_validation_failed',
              requiredPermission: `validate_${String(field)}`,
              resource: 'form',
              resourceId: context,
            },
            user?.id
          ).catch(err => console.error('Failed to log validation failure:', err));
        }
      } else {
        setErrors(prev => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [rules, logFailures, context, user?.id]
  );

  const validateAll = useCallback(
    (formData: T): boolean => {
      const newErrors: Partial<Record<keyof T, string>> = {};
      
      rules.forEach(rule => {
        const value = formData[rule.field];
        const error = rule.validate(value, formData);
        if (error) {
          newErrors[rule.field] = error;
        }
      });

      setErrors(newErrors);
      
      // Log validation failures
      if (logFailures && context && Object.keys(newErrors).length > 0) {
        uiAuditService.logPermissionDenied(
          {
            action: 'form_validation_failed',
            requiredPermission: 'form_submission',
            resource: 'form',
            resourceId: context,
          },
          user?.id
        ).catch(err => console.error('Failed to log validation failure:', err));
      }

      return Object.keys(newErrors).length === 0;
    },
    [rules, logFailures, context, user?.id]
  );

  const clearError = useCallback((field: keyof T) => {
    setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setErrors({});
  }, []);

  const setError = useCallback((field: keyof T, message: string) => {
    setErrors(prev => ({ ...prev, [field]: message }));
  }, []);

  const isValid = Object.keys(errors).length === 0;

  return {
    errors,
    isValid,
    validateField,
    validateAll,
    clearError,
    clearAll,
    setError,
  };
}

/**
 * Helper functions for common validation rules
 */
export const validationHelpers = {
  /** Required field */
  required: (message = 'Dieses Feld ist erforderlich') => 
    (value: any) => (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) ? message : null,

  /** Minimum length */
  minLength: (min: number, message?: string) => 
    (value: string) => value && value.length < min ? (message || `Mindestens ${min} Zeichen erforderlich`) : null,

  /** Maximum length */
  maxLength: (max: number, message?: string) => 
    (value: string) => value && value.length > max ? (message || `Maximal ${max} Zeichen erlaubt`) : null,

  /** Email validation */
  email: (message = 'Ungültige E-Mail-Adresse') => 
    (value: string) => value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? message : null,

  /** Number validation */
  number: (message = 'Muss eine Zahl sein') => 
    (value: any) => value !== null && value !== undefined && value !== '' && isNaN(Number(value)) ? message : null,

  /** Positive number */
  positive: (message = 'Muss eine positive Zahl sein') => 
    (value: any) => {
      const num = Number(value);
      return value !== null && value !== undefined && value !== '' && (isNaN(num) || num <= 0) ? message : null;
    },

  /** Percentage (0-100) */
  percentage: (message = 'Muss zwischen 0 und 100 liegen') => 
    (value: any) => {
      const num = Number(value);
      return value !== null && value !== undefined && value !== '' && (isNaN(num) || num < 0 || num > 100) ? message : null;
    },

  /** Date validation */
  date: (message = 'Ungültiges Datum') => 
    (value: string) => value && isNaN(Date.parse(value)) ? message : null,

  /** Date range validation */
  dateRange: (startDate: string, endDate: string, message = 'Enddatum muss nach Startdatum liegen') => 
    (value: string, formData: any) => {
      if (!value || !startDate) return null;
      return new Date(value) < new Date(startDate) ? message : null;
    },
};
