import { useState, useRef, useEffect } from 'react';
import { useAIChat } from '../../contexts/AIChatContext';
import './ai-chat.css';

/**
 * AIChatPanel - The main chat interface
 * 
 * This component is rendered by GlobalAIChat and appears when the user
 * clicks the floating chat button or presses Ctrl+K.
 */
export const AIChatPanel = () => {
  const { 
    isOpen, 
    closeChat, 
    messages, 
    isLoading, 
    error, 
    sendMessage, 
    clearHistory,
    financialStatementId,
  } = useAIChat();
  
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const message = input;
    setInput('');
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestions = [
    'Zeige IC-Differenzen',
    'Konzern-Goodwill?',
    'Konsolidierungsstatus',
    'Welche Gesellschaften?',
  ];

  if (!isOpen) return null;

  return (
    <div className="ai-chat-panel">
      {/* Header */}
      <div className="ai-chat-header">
        <div className="ai-chat-header-left">
          <div className="ai-chat-avatar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/>
              <path d="M12 16v-4"/>
              <path d="M12 8h.01"/>
            </svg>
          </div>
          <div>
            <div className="ai-chat-title">Konzern Assistent</div>
            <div className="ai-chat-subtitle">
              {financialStatementId ? 'Daten geladen' : 'Allgemeine Fragen'}
            </div>
          </div>
        </div>
        <div className="ai-chat-header-actions">
          <button 
            onClick={clearHistory}
            className="ai-chat-btn-icon"
            title="Neuer Chat"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
          <button 
            onClick={closeChat}
            className="ai-chat-btn-icon"
            aria-label="Schließen"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="ai-chat-messages">
        {messages.length === 0 && (
          <div>
            <p className="ai-chat-welcome">
              Wie kann ich helfen? Fragen Sie mich zu Konsolidierungsdaten, 
              IC-Differenzen oder HGB-Themen.
            </p>
            <p className="ai-chat-suggestions-label">Vorschläge</p>
            <div className="ai-chat-suggestions">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setInput(s)}
                  className="ai-chat-suggestion"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`ai-chat-message ${msg.role === 'user' ? 'user' : 'assistant'}`}
          >
            <div className="ai-chat-bubble">
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="ai-chat-loading">
            <div className="ai-chat-loading-dots">
              <div className="ai-chat-loading-dot" />
              <div className="ai-chat-loading-dot" />
              <div className="ai-chat-loading-dot" />
            </div>
            <span>Denkt nach...</span>
          </div>
        )}

        {error && (
          <div className="ai-chat-error">
            <strong>Fehler:</strong> {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="ai-chat-input-area">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Frage stellen..."
          disabled={isLoading}
          className="ai-chat-input"
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="ai-chat-send-btn"
          aria-label="Senden"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default AIChatPanel;
