import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { uiAuditService } from '../services/uiAuditService';
import { Tooltip } from './Tooltip';
import '../App.css';

export interface QuickAction {
  /** Unique identifier for the action */
  id: string;
  /** Label to display */
  label: string;
  /** Icon (emoji, SVG, or React node) */
  icon?: string | React.ReactNode;
  /** Click handler */
  onClick: () => void | Promise<void>;
  /** Required role(s) to access this action */
  requiredRoles?: string[];
  /** Required permission(s) */
  requiredPermissions?: string[];
  /** Whether this is a destructive action (requires confirmation) */
  destructive?: boolean;
  /** Confirmation message for destructive actions */
  confirmationMessage?: string;
  /** Whether action is disabled */
  disabled?: boolean;
  /** Tooltip text */
  tooltip?: string;
  /** Variant/style */
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger';
}

export interface QuickActionsProps {
  /** Array of actions to display */
  actions: QuickAction[];
  /** Position: 'floating' (FAB) or 'inline' (button group) */
  position?: 'floating' | 'inline';
  /** Whether to show as a menu (for many actions) */
  showAsMenu?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * QuickActions component for contextual actions with SoD compliance
 * 
 * Features:
 * - Role-based access control
 * - Permission checks
 * - Audit logging
 * - Confirmation dialogs for destructive actions
 * - Disabled state handling
 */
export function QuickActions({
  actions,
  position = 'inline',
  showAsMenu = false,
  className = '',
}: QuickActionsProps) {
  const { user } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (showMenu) {
      const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
          setShowMenu(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  // Check if user has required role
  const hasRequiredRole = (action: QuickAction): boolean => {
    if (!action.requiredRoles || action.requiredRoles.length === 0) {
      return true;
    }
    return user?.role ? action.requiredRoles.includes(user.role) : false;
  };

  // Check if user has required permission (placeholder - implement based on your permission system)
  const hasRequiredPermission = (action: QuickAction): boolean => {
    if (!action.requiredPermissions || action.requiredPermissions.length === 0) {
      return true;
    }
    // TODO: Implement permission checking based on your permission system
    return true;
  };

  // Check if action is accessible
  const isAccessible = (action: QuickAction): boolean => {
    return hasRequiredRole(action) && hasRequiredPermission(action) && !action.disabled;
  };

  // Filter accessible actions
  const accessibleActions = actions.filter(isAccessible);
  const hiddenActions = actions.filter(a => !isAccessible(a));

  // Log permission denial
  const logPermissionDenied = async (action: QuickAction) => {
    await uiAuditService.logPermissionDenied(
      {
        action: action.id,
        requiredRole: action.requiredRoles?.[0],
        requiredPermission: action.requiredPermissions?.[0],
        resource: 'quick_action',
      },
      user?.id
    );
  };

  // Handle action click
  const handleActionClick = async (action: QuickAction) => {
    // Check accessibility
    if (!isAccessible(action)) {
      await logPermissionDenied(action);
      return;
    }

    // Check if already processing
    if (processing.has(action.id)) {
      return;
    }

    // Handle destructive actions
    if (action.destructive) {
      const confirmed = window.confirm(
        action.confirmationMessage || `Sind Sie sicher, dass Sie "${action.label}" ausführen möchten?`
      );
      if (!confirmed) {
        return;
      }
    }

    // Set processing state
    setProcessing(prev => new Set(prev).add(action.id));
    setShowMenu(false);

    try {
      await action.onClick();
    } catch (error: any) {
      console.error(`Error executing action ${action.id}:`, error);
    } finally {
      // Clear processing state
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(action.id);
        return next;
      });
    }
  };

  // If no accessible actions, don't render
  if (accessibleActions.length === 0 && hiddenActions.length === 0) {
    return null;
  }

  // Inline button group
  if (position === 'inline') {
    return (
      <div className={`quick-actions inline ${className}`} style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
        {accessibleActions.map((action) => (
          <Tooltip key={action.id} content={action.tooltip || action.label}>
            <button
              className={`button button-${action.variant || 'secondary'}`}
              onClick={() => handleActionClick(action)}
              disabled={processing.has(action.id)}
              title={action.tooltip || action.label}
            >
              {action.icon && (
                <span style={{ marginRight: action.label ? 'var(--spacing-1)' : '0' }}>
                  {typeof action.icon === 'string' ? action.icon : action.icon}
                </span>
              )}
              {action.label}
              {processing.has(action.id) && '...'}
            </button>
          </Tooltip>
        ))}
      </div>
    );
  }

  // Floating action button (FAB) with menu
  return (
    <div className={`quick-actions floating ${className}`} ref={menuRef} style={{ position: 'relative' }}>
      {showAsMenu && accessibleActions.length > 1 ? (
        <>
          <button
            className="button button-primary"
            onClick={() => setShowMenu(!showMenu)}
            style={{
              position: 'fixed',
              bottom: 'var(--spacing-6)',
              right: 'var(--spacing-6)',
              borderRadius: '50%',
              width: '56px',
              height: '56px',
              padding: 0,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              zIndex: 1000,
            }}
            aria-label="Schnellaktionen"
          >
            <span style={{ fontSize: '1.5rem' }}>⚡</span>
          </button>
          {showMenu && (
            <div
              style={{
                position: 'fixed',
                bottom: 'calc(var(--spacing-6) + 64px)',
                right: 'var(--spacing-6)',
                backgroundColor: 'var(--color-bg-primary)',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                padding: 'var(--spacing-2)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-1)',
                minWidth: '200px',
                zIndex: 1001,
              }}
            >
              {accessibleActions.map((action) => (
                <button
                  key={action.id}
                  className={`button button-${action.variant || 'secondary'}`}
                  onClick={() => handleActionClick(action)}
                  disabled={processing.has(action.id)}
                  style={{ justifyContent: 'flex-start', width: '100%' }}
                >
                  {action.icon && (
                    <span style={{ marginRight: 'var(--spacing-2)' }}>
                      {typeof action.icon === 'string' ? action.icon : action.icon}
                    </span>
                  )}
                  {action.label}
                  {processing.has(action.id) && '...'}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        // Single FAB
        accessibleActions.length === 1 && (
          <Tooltip content={accessibleActions[0].tooltip || accessibleActions[0].label}>
            <button
              className="button button-primary"
              onClick={() => handleActionClick(accessibleActions[0])}
              disabled={processing.has(accessibleActions[0].id)}
              style={{
                position: 'fixed',
                bottom: 'var(--spacing-6)',
                right: 'var(--spacing-6)',
                borderRadius: '50%',
                width: '56px',
                height: '56px',
                padding: 0,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                zIndex: 1000,
              }}
              aria-label={accessibleActions[0].label}
            >
              {accessibleActions[0].icon ? (
                typeof accessibleActions[0].icon === 'string' ? (
                  <span style={{ fontSize: '1.5rem' }}>{accessibleActions[0].icon}</span>
                ) : (
                  accessibleActions[0].icon
                )
              ) : (
                <span style={{ fontSize: '1.5rem' }}>⚡</span>
              )}
            </button>
          </Tooltip>
        )
      )}
    </div>
  );
}

export default QuickActions;
