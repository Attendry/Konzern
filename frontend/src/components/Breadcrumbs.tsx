import { Link, useLocation } from 'react-router-dom';
import '../App.css';

export interface BreadcrumbItem {
  /** Label to display */
  label: string;
  /** Route to navigate to (if not provided, item is not clickable) */
  to?: string;
  /** Whether this item shows compliance context */
  showComplianceContext?: boolean;
  /** Approval status to show (if applicable) */
  approvalStatus?: 'pending' | 'approved' | 'rejected';
}

export interface BreadcrumbsProps {
  /** Array of breadcrumb items */
  items: BreadcrumbItem[];
  /** Separator between items (default: '>') */
  separator?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Breadcrumbs component for hierarchical navigation
 * 
 * Features:
 * - Clickable segments (except last)
 * - Compliance context support
 * - Approval status display
 * - Responsive design
 */
export function Breadcrumbs({
  items,
  separator = '>',
  className = '',
}: BreadcrumbsProps) {
  const location = useLocation();

  if (items.length === 0) {
    return null;
  }

  const getStatusBadge = (status: 'pending' | 'approved' | 'rejected') => {
    const statusConfig = {
      pending: { label: 'Zur Prüfung', class: 'badge-warning' },
      approved: { label: 'Freigegeben', class: 'badge-success' },
      rejected: { label: 'Abgelehnt', class: 'badge-danger' },
    };

    const config = statusConfig[status];
    return (
      <span className={`badge ${config.class}`} style={{ marginLeft: 'var(--spacing-2)' }}>
        {config.label}
      </span>
    );
  };

  return (
    <nav 
      className={`breadcrumbs ${className}`}
      aria-label="Breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-2)',
        flexWrap: 'wrap',
        marginBottom: 'var(--spacing-4)',
        fontSize: 'var(--font-size-sm)',
      }}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isActive = item.to === location.pathname;

        return (
          <span
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-2)',
            }}
          >
            {isLast ? (
              <span
                style={{
                  color: 'var(--color-text-primary)',
                  fontWeight: 'var(--font-weight-medium)',
                }}
                aria-current="page"
              >
                {item.label}
                {item.approvalStatus && getStatusBadge(item.approvalStatus)}
              </span>
            ) : item.to ? (
              <Link
                to={item.to}
                style={{
                  color: isActive 
                    ? 'var(--color-primary)' 
                    : 'var(--color-text-secondary)',
                  textDecoration: 'none',
                  transition: 'color var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--color-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                  }
                }}
              >
                {item.label}
              </Link>
            ) : (
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {item.label}
              </span>
            )}

            {!isLast && (
              <span
                style={{
                  color: 'var(--color-text-tertiary)',
                  margin: '0 var(--spacing-1)',
                }}
                aria-hidden="true"
              >
                {separator}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export default Breadcrumbs;
