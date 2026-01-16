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

  // Check AI service health on startup
  useEffect(() => {
    aiService.checkHealth()
      .then(health => {
        setIsAvailable(health.available);
      })
      .catch(() => {
        // Service unavailable but we still show the button
        // Errors will be shown in chat panel when user tries to send
        setIsAvailable(false);
      });
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

  // Helper function to send message with retry logic
  const sendMessageWithRetry = useCallback(async (
    content: string,
    currentMessages: ChatMessage[],
    statementId: string | undefined,
    retries = 2,
    delay = 1000
  ): Promise<ChatResponse> => {
    try {
      return await aiService.sendMessage(content, currentMessages, statementId);
    } catch (err: any) {
      // Retry on network timeout errors
      if (retries > 0 && (err.code === 'ECONNABORTED' || err.message?.includes('timeout'))) {
        await new Promise(resolve => setTimeout(resolve, delay));
        // Exponential backoff
        return sendMessageWithRetry(content, currentMessages, statementId, retries - 1, delay * 2);
      }
      throw err;
    }
  }, []);

  const sendMessage = useCallback(async (content: string): Promise<ChatResponse | null> => {
    if (!content.trim()) return null;
    
    setIsLoading(true);
    setError(null);

    // Add user message immediately
    const userMessage: ChatMessage = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await sendMessageWithRetry(
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
  }, [messages, financialStatementId, sendMessageWithRetry]);

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
