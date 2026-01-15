import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import aiService, { ChatMessage, ChatResponse } from '../services/aiService';

// ==========================================
// TYPES
// ==========================================

interface AIChatContextType {
  // State
  isOpen: boolean;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  financialStatementId: string | null;
  isAvailable: boolean;
  
  // Actions
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  sendMessage: (content: string) => Promise<ChatResponse | null>;
  clearHistory: () => void;
  setFinancialStatementId: (id: string | null) => void;
}

// ==========================================
// CONTEXT
// ==========================================

const AIChatContext = createContext<AIChatContextType | undefined>(undefined);

// ==========================================
// PROVIDER
// ==========================================

interface AIChatProviderProps {
  children: ReactNode;
}

export function AIChatProvider({ children }: AIChatProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [financialStatementId, setFinancialStatementId] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);

  // Check AI availability on mount
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const health = await aiService.checkHealth();
        setIsAvailable(health.available);
      } catch {
        setIsAvailable(false);
      }
    };
    checkAvailability();
  }, []);

  // Keyboard shortcut: Ctrl+K or Cmd+K to toggle chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K to toggle
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Actions
  const openChat = useCallback(() => setIsOpen(true), []);
  const closeChat = useCallback(() => setIsOpen(false), []);
  const toggleChat = useCallback(() => setIsOpen(prev => !prev), []);

  const sendMessage = useCallback(async (content: string): Promise<ChatResponse | null> => {
    if (!content.trim()) return null;
    
    setIsLoading(true);
    setError(null);

    // Add user message immediately
    const userMessage: ChatMessage = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await aiService.sendMessage(
        content,
        messages,
        financialStatementId || undefined,
      );

      // Add AI response
      const aiMessage: ChatMessage = { role: 'model', content: response.message };
      setMessages(prev => [...prev, aiMessage]);

      return response;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Fehler bei der Kommunikation mit dem AI-Service';
      setError(errorMessage);
      // Remove the user message if failed
      setMessages(prev => prev.slice(0, -1));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [messages, financialStatementId]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  // Context value
  const value: AIChatContextType = {
    isOpen,
    messages,
    isLoading,
    error,
    financialStatementId,
    isAvailable,
    openChat,
    closeChat,
    toggleChat,
    sendMessage,
    clearHistory,
    setFinancialStatementId,
  };

  return (
    <AIChatContext.Provider value={value}>
      {children}
    </AIChatContext.Provider>
  );
}

// ==========================================
// HOOK
// ==========================================

export function useAIChat(): AIChatContextType {
  const context = useContext(AIChatContext);
  if (context === undefined) {
    throw new Error('useAIChat must be used within an AIChatProvider');
  }
  return context;
}
