import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToastContext } from '../contexts/ToastContext';
import { uiAuditService } from '../services/uiAuditService';
import '../App.css';

export interface ErrorStateProps {
  /** Error message to display */
  error: string | Error;
  /** Retry handler function */
  onRetry?: () => void | Promise<void>;
  /** Help link URL */
  helpLink?: string;
  /** Alternative actions (e.g., "Go to Dashboard") */
  alternativeActions?: Array<{
    label: string;
    onClick: () => void;
  }>;
  /** Context information for audit logging */
  context?: {
    page: string;
    financialStatementId?: string;
    companyId?: string;
    userAction?: string;
  };
  /** Whether this is an HGB compliance error */
  isHGBError?: boolean;
  /** HGB section reference (e.g., "HGB § 301") */
  hgbReference?: string;
  /** Error severity */
  severity?: 'blocking' | 'warning' | 'info';
  /** Whether to preserve form state (for forms) */
  preserveFormState?: boolean;
  /** Form state to preserve */
  formState?: any;
  /** Callback when error is logged */
  onErrorLogged?: () => void;
}

/**
 * ErrorState component with audit logging and HGB compliance support
 * 
 * Features:
 * - Clear error display
 * - Retry functionality with logging
 * - HGB compliance error handling
 * - Exportable error reports
 * - Form state preservation
 */
export function ErrorState({
  error,
  onRetry,
  helpLink,
  alternativeActions = [],
  context,
  isHGBError = false,
  hgbReference,
  severity = 'blocking',
  preserveFormState = false,
  formState,
  onErrorLogged,
}: ErrorStateProps) {
  const { user } = useAuth();
  const { error: showErrorToast } = useToastContext();
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  // Extract error message
  const errorMessage = error instanceof Error ? error.message : error;
  const errorName = error instanceof Error ? error.name : 'Error';
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Log error to audit trail on mount
  useEffect(() => {
    const logError = async () => {
      if (!context) return;

      try {
        await uiAuditService.logUIError(
          error instanceof Error ? error : new Error(errorMessage),
          {
            page: context.page,
            errorType: errorName,
            errorMessage,
            financialStatementId: context.financialStatementId,
            companyId: context.companyId,
            userAction: context.userAction,
            stackTrace: errorStack,
          },
          user?.id
        );
        onErrorLogged?.();
      } catch (err) {
        console.error('Failed to log error to audit trail:', err);
      }
    };

    logError();
  }, []); // Only log once on mount

  // Generate error report
  const generateErrorReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      error: {
        name: errorName,
        message: errorMessage,
        stack: errorStack,
      },
      context: context || {},
      user: {
        id: user?.id,
        email: user?.email,
        role: user?.role,
      },
      hgb: isHGBError ? {
        isHGBError: true,
        reference: hgbReference,
        severity,
      } : null,
      retryCount,
      formState: preserveFormState && formState ? formState : null,
    };

    return JSON.stringify(report, null, 2);
  };

  const handleExportErrorReport = () => {
    const report = generateErrorReport();

    // Create downloadable file
    const blob = new Blob([report], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `error-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRetry = async () => {
    if (!onRetry) return;

    setIsRetrying(true);
    const newRetryCount = retryCount + 1;

    try {
      // Log retry attempt
      if (context) {
        await uiAuditService.logRetryAttempt(
          {
            page: context.page,
            operation: 'retry',
            retryCount: newRetryCount,
            success: false, // Will be updated after retry
            financialStatementId: context.financialStatementId,
            companyId: context.companyId,
            errorMessage,
          },
          user?.id
        );
      }

      await onRetry();

      // Log successful retry
      if (context) {
        await uiAuditService.logRetryAttempt(
          {
            page: context.page,
            operation: 'retry',
            retryCount: newRetryCount,
            success: true,
            financialStatementId: context.financialStatementId,
            companyId: context.companyId,
          },
          user?.id
        );
      }

      setRetryCount(newRetryCount);
    } catch (err: any) {
      showErrorToast(`Wiederholung fehlgeschlagen: ${err.message || 'Unbekannter Fehler'}`);
      
      // Log failed retry
      if (context) {
        await uiAuditService.logRetryAttempt(
          {
            page: context.page,
            operation: 'retry',
            retryCount: newRetryCount,
            success: false,
            financialStatementId: context.financialStatementId,
            companyId: context.companyId,
            errorMessage: err.message,
          },
          user?.id
        );
      }
    } finally {
      setIsRetrying(false);
    }
  };

  const severityClass = severity === 'blocking' ? 'error' : severity === 'warning' ? 'warning' : 'info';
  const severityIcon = severity === 'blocking' ? '❌' : severity === 'warning' ? '⚠️' : 'ℹ️';

  return (
    <div className="card" style={{ 
      border: `2px solid var(--color-${severityClass})`,
      backgroundColor: severity === 'blocking' 
        ? 'var(--color-bg-error, #fee)' 
        : severity === 'warning'
        ? 'var(--color-bg-warning, #fffbeb)'
        : 'var(--color-bg-info, #eff6ff)'
    }}>
      <div className="card-header">
        <h2 style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 'var(--spacing-2)',
          color: `var(--color-${severityClass})`
        }}>
          <span>{severityIcon}</span>
          {isHGBError ? 'HGB-Compliance Fehler' : 'Fehler'}
        </h2>
      </div>

      <div className="error-message" style={{ 
        padding: 'var(--spacing-4)',
        fontSize: 'var(--font-size-base)'
      }}>
        <div style={{ marginBottom: 'var(--spacing-3)' }}>
          <strong>{errorMessage}</strong>
        </div>

        {isHGBError && hgbReference && (
          <div style={{ 
            marginTop: 'var(--spacing-3)',
            padding: 'var(--spacing-3)',
            backgroundColor: 'var(--color-bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            borderLeft: '4px solid var(--color-warning)'
          }}>
            <div style={{ fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--spacing-2)' }}>
              HGB-Referenz: {hgbReference}
            </div>
            {helpLink && (
              <a 
                href={helpLink} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ 
                  color: 'var(--color-primary)',
                  textDecoration: 'underline'
                }}
              >
                Weitere Informationen zu {hgbReference} →
              </a>
            )}
          </div>
        )}

        {errorStack && process.env.NODE_ENV === 'development' && (
          <details style={{ marginTop: 'var(--spacing-3)' }}>
            <summary style={{ cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
              Technische Details anzeigen
            </summary>
            <pre style={{ 
              marginTop: 'var(--spacing-2)',
              padding: 'var(--spacing-3)',
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              overflow: 'auto'
            }}>
              {errorStack}
            </pre>
          </details>
        )}
      </div>

      <div style={{ 
        padding: 'var(--spacing-4)',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        gap: 'var(--spacing-3)',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        {onRetry && (
          <button
            className="button button-primary"
            onClick={handleRetry}
            disabled={isRetrying}
          >
            {isRetrying ? 'Wiederhole...' : 'Erneut versuchen'}
            {retryCount > 0 && ` (${retryCount})`}
          </button>
        )}

        {helpLink && (
          <a
            href={helpLink}
            target="_blank"
            rel="noopener noreferrer"
            className="button button-secondary"
            style={{ textDecoration: 'none' }}
          >
            Hilfe anzeigen
          </a>
        )}

        <button
          className="button button-secondary"
          onClick={handleExportErrorReport}
          title="Fehlerbericht für Audit-Zwecke exportieren"
        >
          Fehlerbericht exportieren
        </button>

        {alternativeActions.map((action, index) => (
          <button
            key={index}
            className="button button-tertiary"
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ))}
      </div>

      {preserveFormState && formState && (
        <div style={{ 
          padding: 'var(--spacing-3)',
          backgroundColor: 'var(--color-bg-tertiary)',
          borderRadius: 'var(--radius-md)',
          marginTop: 'var(--spacing-4)',
          fontSize: 'var(--font-size-sm)'
        }}>
          <strong>Hinweis:</strong> Ihre Formulardaten wurden gespeichert und bleiben erhalten.
        </div>
      )}
    </div>
  );
}

export default ErrorState;
