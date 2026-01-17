import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { uiAuditService } from '../services/uiAuditService';
import '../App.css';

export interface RelatedLink {
  /** Label to display */
  label: string;
  /** Route to navigate to */
  to: string;
  /** Icon (emoji, SVG, or React node) */
  icon?: string | React.ReactNode;
  /** Required role(s) to access this link */
  requiredRoles?: string[];
  /** Required permission(s) */
  requiredPermissions?: string[];
  /** Description/tooltip */
  description?: string;
}

export interface RelatedLinksProps {
  /** Array of related links */
  links: RelatedLink[];
  /** Title for the section (default: "Verwandte Seiten") */
  title?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * RelatedLinks component for contextual navigation with access control
 * 
 * Features:
 * - Role-based access control
 * - Permission checks
 * - Audit logging for access attempts
 * - Hides restricted links
 */
export function RelatedLinks({
  links,
  title = 'Verwandte Seiten',
  className = '',
}: RelatedLinksProps) {
  const { user } = useAuth();

  // Check if user has required role
  const hasRequiredRole = (link: RelatedLink): boolean => {
    if (!link.requiredRoles || link.requiredRoles.length === 0) {
      return true;
    }
    return user?.role ? link.requiredRoles.includes(user.role) : false;
  };

  // Check if user has required permission
  const hasRequiredPermission = (link: RelatedLink): boolean => {
    if (!link.requiredPermissions || link.requiredPermissions.length === 0) {
      return true;
    }
    // TODO: Implement permission checking based on your permission system
    return true;
  };

  // Filter accessible links
  const accessibleLinks = links.filter(link => hasRequiredRole(link) && hasRequiredPermission(link));
  const hiddenLinks = links.filter(link => !hasRequiredRole(link) || !hasRequiredPermission(link));

  // Log access attempt for restricted links (if user tries to access)
  const handleLinkClick = async (link: RelatedLink) => {
    if (!hasRequiredRole(link) || !hasRequiredPermission(link)) {
      await uiAuditService.logPermissionDenied(
        {
          action: 'navigate',
          requiredRole: link.requiredRoles?.[0],
          requiredPermission: link.requiredPermissions?.[0],
          resource: 'page',
          resourceId: link.to,
        },
        user?.id
      );
    }
  };

  if (accessibleLinks.length === 0) {
    return null;
  }

  return (
    <div className={`related-links ${className}`} style={{ marginTop: 'var(--spacing-6)' }}>
      <div className="card" style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
        <div className="card-header">
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-medium)' }}>
            {title}
          </h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
          {accessibleLinks.map((link, index) => (
            <Link
              key={index}
              to={link.to}
              onClick={() => handleLinkClick(link)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-2)',
                padding: 'var(--spacing-2)',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                color: 'var(--color-text-primary)',
                transition: 'background-color var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title={link.description || link.label}
            >
              {link.icon && (
                <span>
                  {typeof link.icon === 'string' ? link.icon : link.icon}
                </span>
              )}
              <span>{link.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default RelatedLinks;
