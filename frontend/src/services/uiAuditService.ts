import api from './api';
import { AuditLog, AuditAction, AuditEntityType } from '../types';

/**
 * UI-specific audit action types
 * These extend the base AuditAction type for UI events
 */
export type UIAuditAction = 
  | 'ui_error_handled'
  | 'retry_attempt'
  | 'permission_denied'
  | 'navigation_with_unsaved_changes'
  | 'draft_saved'
  | 'draft_loaded';

export interface UIErrorContext {
  page: string;
  errorType: string;
  errorMessage: string;
  financialStatementId?: string;
  companyId?: string;
  userAction?: string;
  stackTrace?: string;
}

export interface RetryAttemptContext {
  page: string;
  operation: string;
  retryCount: number;
  success: boolean;
  financialStatementId?: string;
  companyId?: string;
  errorMessage?: string;
}

export interface PermissionDeniedContext {
  action: string;
  requiredRole?: string;
  requiredPermission?: string;
  resource?: string;
  resourceId?: string;
}

/**
 * Service for logging UI events to the audit trail
 * Coordinates with backend to avoid duplicate logging
 */
export const uiAuditService = {
  /**
   * Log a UI error occurrence
   * Only logs if backend hasn't already logged it
   */
  async logUIError(
    error: Error,
    context: UIErrorContext,
    userId?: string
  ): Promise<void> {
    try {
      // Check if this error was already logged by backend
      // (Backend logs API errors, we only log user-facing UI errors)
      const errorId = `${context.page}-${Date.now()}`;
      
      await api.post('/audit/logs', {
        action: 'ui_error_handled' as AuditAction,
        entityType: 'system' as AuditEntityType,
        description: `UI Error on ${context.page}: ${error.message}`,
        metadata: {
          uiEvent: true,
          page: context.page,
          errorType: context.errorType,
          errorMessage: context.errorMessage,
          errorName: error.name,
          stackTrace: context.stackTrace || error.stack,
          financialStatementId: context.financialStatementId,
          companyId: context.companyId,
          userAction: context.userAction,
          errorId,
        },
        userId,
      });
    } catch (err) {
      // Don't throw - audit logging failures shouldn't break the UI
      console.error('Failed to log UI error to audit trail:', err);
    }
  },

  /**
   * Log a retry attempt
   */
  async logRetryAttempt(
    context: RetryAttemptContext,
    userId?: string
  ): Promise<void> {
    try {
      await api.post('/audit/logs', {
        action: 'retry_attempt' as AuditAction,
        entityType: 'system' as AuditEntityType,
        description: `Retry attempt ${context.retryCount} for ${context.operation} on ${context.page}`,
        metadata: {
          uiEvent: true,
          page: context.page,
          operation: context.operation,
          retryCount: context.retryCount,
          success: context.success,
          financialStatementId: context.financialStatementId,
          companyId: context.companyId,
          errorMessage: context.errorMessage,
        },
        userId,
      });
    } catch (err) {
      console.error('Failed to log retry attempt to audit trail:', err);
    }
  },

  /**
   * Log a permission-denied action
   */
  async logPermissionDenied(
    context: PermissionDeniedContext,
    userId?: string
  ): Promise<void> {
    try {
      await api.post('/audit/logs', {
        action: 'permission_denied' as AuditAction,
        entityType: context.resource as AuditEntityType || 'system' as AuditEntityType,
        entityId: context.resourceId,
        description: `Permission denied for action: ${context.action}`,
        metadata: {
          uiEvent: true,
          action: context.action,
          requiredRole: context.requiredRole,
          requiredPermission: context.requiredPermission,
          resource: context.resource,
          resourceId: context.resourceId,
        },
        userId,
      });
    } catch (err) {
      console.error('Failed to log permission denied to audit trail:', err);
    }
  },

  /**
   * Log navigation with unsaved changes (warning only)
   */
  async logNavigationWithUnsavedChanges(
    page: string,
    targetPage: string,
    userId?: string
  ): Promise<void> {
    try {
      await api.post('/audit/logs', {
        action: 'navigation_with_unsaved_changes' as AuditAction,
        entityType: 'system' as AuditEntityType,
        description: `Navigation from ${page} to ${targetPage} with unsaved changes`,
        metadata: {
          uiEvent: true,
          fromPage: page,
          toPage: targetPage,
          warning: true, // This is a warning, not an error
        },
        userId,
      });
    } catch (err) {
      console.error('Failed to log navigation warning to audit trail:', err);
    }
  },

  /**
   * Log draft save
   */
  async logDraftSave(
    formKey: string,
    entityType: string,
    entityId?: string,
    userId?: string
  ): Promise<void> {
    try {
      await api.post('/audit/logs', {
        action: 'draft_saved' as AuditAction,
        entityType: entityType as AuditEntityType,
        entityId,
        description: `Draft saved for ${formKey}`,
        metadata: {
          uiEvent: true,
          formKey,
          entityType,
          entityId,
        },
        userId,
      });
    } catch (err) {
      console.error('Failed to log draft save to audit trail:', err);
    }
  },
};

export default uiAuditService;
