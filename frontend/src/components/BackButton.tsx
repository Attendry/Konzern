import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Modal } from './Modal';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { uiAuditService } from '../services/uiAuditService';
import '../App.css';

export interface BackButtonProps {
  /** Explicit route to navigate to (overrides history back) */
  to?: string;
  /** Fallback route if history back is not available (default: '/') */
  fallback?: string;
  /** Label for the button (default: 'Zurück') */
  label?: string;
  /** Check for unsaved changes before navigation */
  checkUnsaved?: boolean;
  /** Form key for unsaved changes detection */
  formKey?: string;
  /** Form data for unsaved changes detection */
  formData?: any;
  /** Role restrictions - users with these roles cannot use back button */
  restrictedRoles?: string[];
  /** Custom onClick handler (overrides default navigation) */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * BackButton component with smart navigation and unsaved changes detection
 * 
 * Features:
 * - Smart navigation (history back with fallback)
 * - Unsaved changes detection
 * - Role-based restrictions
 * - Audit logging for navigation warnings
 */
export function BackButton({
  to,
  fallback = '/',
  label = 'Zurück',
  checkUnsaved = false,
  formKey,
  formData,
  restrictedRoles = [],
  onClick,
  className = '',
}: BackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // Unsaved changes detection (if enabled)
  const unsavedChanges = useUnsavedChanges(
    formData || {},
    formKey || `form-${location.pathname}`,
    { enableAutoSave: !!formKey && !!formData }
  );

  // Check if user role is restricted
  const isRestricted = restrictedRoles.length > 0 && user?.role && restrictedRoles.includes(user.role);

  const handleBack = () => {
    // If custom onClick provided, use it
    if (onClick) {
      onClick();
      return;
    }

    // Check role restrictions
    if (isRestricted) {
      console.warn(`User with role ${user?.role} is restricted from using back button on this page`);
      return;
    }

    // Check for unsaved changes
    if (checkUnsaved && unsavedChanges.hasUnsavedChanges) {
      // Determine target route
      const targetRoute = to || (window.history.length > 1 ? undefined : fallback);
      setPendingNavigation(targetRoute || fallback);
      setShowConfirmDialog(true);
      
      // Log navigation warning
      uiAuditService.logNavigationWithUnsavedChanges(
        location.pathname,
        targetRoute || fallback,
        user?.id
      ).catch(err => console.error('Failed to log navigation warning:', err));
      
      return;
    }

    // Perform navigation
    performNavigation();
  };

  const performNavigation = () => {
    if (to) {
      navigate(to);
    } else {
      // Try history back, fallback to dashboard if not available
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate(fallback);
      }
    }
  };

  const handleConfirmNavigation = () => {
    setShowConfirmDialog(false);
    const target = pendingNavigation || fallback;
    setPendingNavigation(null);
    
    // Clear unsaved changes flag (user confirmed they want to leave)
    if (checkUnsaved) {
      unsavedChanges.clearDraft();
    }
    
    if (target) {
      navigate(target);
    } else {
      performNavigation();
    }
  };

  const handleCancelNavigation = () => {
    setShowConfirmDialog(false);
    setPendingNavigation(null);
  };

  // Don't render if role is restricted
  if (isRestricted) {
    return null;
  }

  return (
    <>
      <button
        className={`button button-tertiary ${className}`}
        onClick={handleBack}
        aria-label={label}
        title={label}
      >
        ← {label}
      </button>

      {/* Confirmation dialog for unsaved changes */}
      {showConfirmDialog && (
        <Modal
          isOpen={showConfirmDialog}
          onClose={handleCancelNavigation}
          title="Ungespeicherte Änderungen"
          size="md"
        >
          <div style={{ padding: 'var(--spacing-4)' }}>
            <p style={{ marginBottom: 'var(--spacing-4)' }}>
              Sie haben ungespeicherte Änderungen. Möchten Sie diese Seite wirklich verlassen?
            </p>
            <div style={{ 
              padding: 'var(--spacing-3)', 
              backgroundColor: 'var(--color-bg-tertiary)', 
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--spacing-4)'
            }}>
              <strong>Hinweis:</strong> Ihre Änderungen wurden als Entwurf gespeichert und können später wiederhergestellt werden.
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-3)', justifyContent: 'flex-end' }}>
              <button
                className="button button-secondary"
                onClick={handleCancelNavigation}
              >
                Abbrechen
              </button>
              <button
                className="button button-primary"
                onClick={handleConfirmNavigation}
              >
                Seite verlassen
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default BackButton;
