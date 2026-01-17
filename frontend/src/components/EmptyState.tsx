import { ReactNode } from 'react';
import '../App.css';

export interface EmptyStateProps {
  /** Icon to display (emoji, SVG, or React node) */
  icon?: string | ReactNode;
  /** Title text */
  title: string;
  /** Description text */
  description: string;
  /** Primary action button */
  primaryAction?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'tertiary';
  };
  /** Secondary action button (optional) */
  secondaryAction?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'tertiary';
  };
  /** Whether this is a compliance-related empty state */
  isComplianceRelated?: boolean;
  /** What's missing and why it's required (for compliance) */
  complianceContext?: {
    missingItem: string;
    reason: string;
    deadline?: string;
    urgency?: 'high' | 'medium' | 'low';
  };
  /** Link to compliance documentation */
  complianceDocumentationLink?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * EmptyState component for displaying empty states with actionable CTAs
 * 
 * Features:
 * - Flexible icon support
 * - Primary and secondary actions
 * - Compliance context support
 * - Consistent styling
 */
export function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  isComplianceRelated = false,
  complianceContext,
  complianceDocumentationLink,
  className = '',
}: EmptyStateProps) {
  const urgencyColors = {
    high: 'var(--color-error)',
    medium: 'var(--color-warning)',
    low: 'var(--color-info)',
  };

  const urgencyIcons = {
    high: '🔴',
    medium: '🟠',
    low: '🟡',
  };

  return (
    <div className={`empty-state ${className}`} style={{ 
      textAlign: 'center',
      padding: 'var(--spacing-8) var(--spacing-4)'
    }}>
      {icon && (
        <div className="empty-state-icon" style={{ 
          fontSize: '4rem',
          marginBottom: 'var(--spacing-4)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          {typeof icon === 'string' ? <span>{icon}</span> : icon}
        </div>
      )}

      <div className="empty-state-title" style={{ 
        fontSize: 'var(--font-size-xl)',
        fontWeight: 'var(--font-weight-bold)',
        marginBottom: 'var(--spacing-2)',
        color: 'var(--color-text-primary)'
      }}>
        {title}
      </div>

      <div className="empty-state-description" style={{ 
        fontSize: 'var(--font-size-base)',
        color: 'var(--color-text-secondary)',
        marginBottom: 'var(--spacing-6)',
        maxWidth: '600px',
        margin: '0 auto var(--spacing-6)'
      }}>
        {description}
      </div>

      {/* Compliance Context */}
      {isComplianceRelated && complianceContext && (
        <div style={{ 
          marginBottom: 'var(--spacing-6)',
          padding: 'var(--spacing-4)',
          backgroundColor: 'var(--color-bg-tertiary)',
          borderRadius: 'var(--radius-md)',
          borderLeft: `4px solid ${complianceContext.urgency ? urgencyColors[complianceContext.urgency] : 'var(--color-warning)'}`,
          maxWidth: '600px',
          margin: '0 auto var(--spacing-6)',
          textAlign: 'left'
        }}>
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-2)',
            marginBottom: 'var(--spacing-2)',
            fontWeight: 'var(--font-weight-medium)'
          }}>
            {complianceContext.urgency && (
              <span>{urgencyIcons[complianceContext.urgency]}</span>
            )}
            <span>Fehlende Angabe: {complianceContext.missingItem}</span>
          </div>
          <div style={{ 
            marginBottom: 'var(--spacing-2)',
            color: 'var(--color-text-secondary)'
          }}>
            {complianceContext.reason}
          </div>
          {complianceContext.deadline && (
            <div style={{ 
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              fontStyle: 'italic'
            }}>
              Frist: {complianceContext.deadline}
            </div>
          )}
          {complianceDocumentationLink && (
            <div style={{ marginTop: 'var(--spacing-3)' }}>
              <a
                href={complianceDocumentationLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{ 
                  color: 'var(--color-primary)',
                  textDecoration: 'underline',
                  fontSize: 'var(--font-size-sm)'
                }}
              >
                Compliance-Dokumentation anzeigen →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ 
        display: 'flex',
        gap: 'var(--spacing-3)',
        justifyContent: 'center',
        flexWrap: 'wrap'
      }}>
        {primaryAction && (
          <button
            className={`button button-${primaryAction.variant || 'primary'}`}
            onClick={primaryAction.onClick}
          >
            {primaryAction.label}
          </button>
        )}

        {secondaryAction && (
          <button
            className={`button button-${secondaryAction.variant || 'secondary'}`}
            onClick={secondaryAction.onClick}
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
}

export default EmptyState;
