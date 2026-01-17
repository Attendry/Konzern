import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseUnsavedChangesOptions {
  /** Auto-save interval in milliseconds (default: 30000 = 30 seconds) */
  autoSaveInterval?: number;
  /** Whether to enable auto-save (default: true) */
  enableAutoSave?: boolean;
  /** Custom serialization function */
  serialize?: (data: any) => string;
  /** Custom deserialization function */
  deserialize?: (data: string) => any;
}

export interface UseUnsavedChangesReturn<T> {
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Save current data as draft */
  saveDraft: () => void;
  /** Load draft data */
  loadDraft: () => T | null;
  /** Clear draft data */
  clearDraft: () => void;
  /** Mark data as saved (clears unsaved changes flag) */
  markSaved: () => void;
  /** Get draft data without loading */
  getDraft: () => T | null;
}

/**
 * Hook to detect and manage unsaved changes in forms
 * Provides auto-save functionality and unsaved changes detection
 * 
 * @param formData - Current form data
 * @param formKey - Unique key for this form (e.g., 'company-form-123')
 * @param options - Configuration options
 * @returns Object with unsaved changes state and methods
 */
export function useUnsavedChanges<T>(
  formData: T,
  formKey: string,
  options: UseUnsavedChangesOptions = {}
): UseUnsavedChangesReturn<T> {
  const {
    autoSaveInterval = 30000, // 30 seconds
    enableAutoSave = true,
    serialize = JSON.stringify,
    deserialize = JSON.parse,
  } = options;

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const previousDataRef = useRef<string>('');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  const storageKey = `draft-${formKey}`;

  // Serialize current form data
  const serializeData = useCallback((data: T): string => {
    try {
      return serialize(data);
    } catch (error) {
      console.error('Error serializing form data:', error);
      return '';
    }
  }, [serialize]);

  // Save draft to localStorage
  const saveDraft = useCallback(() => {
    try {
      const serialized = serializeData(formData);
      if (serialized) {
        localStorage.setItem(storageKey, serialized);
        // Also store timestamp for cleanup
        localStorage.setItem(`${storageKey}-timestamp`, Date.now().toString());
      }
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  }, [formData, storageKey, serializeData]);

  // Load draft from localStorage
  const loadDraft = useCallback((): T | null => {
    try {
      const draft = localStorage.getItem(storageKey);
      if (draft) {
        return deserialize(draft);
      }
    } catch (error) {
      console.error('Error loading draft:', error);
    }
    return null;
  }, [storageKey, deserialize]);

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(`${storageKey}-timestamp`);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error clearing draft:', error);
    }
  }, [storageKey]);

  // Get draft without deserializing
  const getDraft = useCallback((): T | null => {
    return loadDraft();
  }, [loadDraft]);

  // Mark data as saved
  const markSaved = useCallback(() => {
    clearDraft();
    previousDataRef.current = serializeData(formData);
    setHasUnsavedChanges(false);
  }, [clearDraft, formData, serializeData]);

  // Detect changes
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      // Load existing draft on mount
      const existingDraft = loadDraft();
      if (existingDraft) {
        // Check if draft is different from current data
        const currentSerialized = serializeData(formData);
        const draftSerialized = serializeData(existingDraft);
        if (currentSerialized !== draftSerialized) {
          setHasUnsavedChanges(true);
        }
      }
      previousDataRef.current = serializeData(formData);
      return;
    }

    const currentSerialized = serializeData(formData);
    const hasChanges = currentSerialized !== previousDataRef.current && currentSerialized !== '';

    setHasUnsavedChanges(hasChanges);

    // Auto-save if enabled and there are changes
    if (enableAutoSave && hasChanges) {
      // Clear existing timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // Set new timer
      autoSaveTimerRef.current = setTimeout(() => {
        saveDraft();
      }, autoSaveInterval);
    }

    // Update previous data ref
    previousDataRef.current = currentSerialized;

    // Cleanup timer on unmount or when formData changes
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [formData, enableAutoSave, autoSaveInterval, saveDraft, serializeData, loadDraft]);

  // Set up beforeunload handler to warn about unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers ignore custom messages, but we still need to set returnValue
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  return {
    hasUnsavedChanges,
    saveDraft,
    loadDraft,
    clearDraft,
    markSaved,
    getDraft,
  };
}
