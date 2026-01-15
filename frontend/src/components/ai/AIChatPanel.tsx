import { useState, useRef, useEffect } from 'react';
import { useAIChat } from '../../contexts/AIChatContext';

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
    'Zeige alle offenen IC-Differenzen',
    'Wie hoch ist der Konzern-Goodwill?',
    'Zusammenfassung der Konsolidierung',
    'Welche Gesellschaften sind konsolidiert?',
  ];

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      right: 24,
      bottom: 24,
      width: 420,
      height: 580,
      backgroundColor: 'white',
      borderRadius: 16,
      boxShadow: '0 8px 40px rgba(0, 0, 0, 0.2)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      zIndex: 9999,
      animation: 'slideUp 0.25s ease-out',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        background: 'linear-gradient(135deg, #1a73e8 0%, #1557b0 100%)',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>🤖</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Konzern AI Assistent</div>
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
              {financialStatementId ? '● Daten geladen' : '○ Allgemeine Fragen'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button 
            onClick={clearHistory}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              padding: '6px 10px',
              borderRadius: 6,
              fontSize: 12,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            title="Chat leeren"
          >
            Neu
          </button>
          <button 
            onClick={closeChat} 
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: 26,
              cursor: 'pointer',
              lineHeight: 1,
              padding: '0 4px',
            }}
            aria-label="Schließen"
          >
            ×
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 20,
        backgroundColor: '#f8f9fa',
      }}>
        {messages.length === 0 && (
          <div>
            <p style={{ color: '#555', marginBottom: 16, fontSize: 14, lineHeight: 1.5 }}>
              Wie kann ich Ihnen helfen? Fragen Sie mich zu Konsolidierungsdaten, 
              IC-Differenzen oder HGB-Themen.
            </p>
            <p style={{ color: '#888', fontSize: 12, marginBottom: 12 }}>
              Vorschläge:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setInput(s)}
                  style={{
                    padding: '8px 14px',
                    fontSize: 12,
                    backgroundColor: 'white',
                    border: '1px solid #ddd',
                    borderRadius: 20,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    color: '#333',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#1a73e8';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.borderColor = '#1a73e8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.color = '#333';
                    e.currentTarget.style.borderColor = '#ddd';
                  }}
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
            style={{
              marginBottom: 14,
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div style={{
              maxWidth: '85%',
              padding: '12px 16px',
              borderRadius: msg.role === 'user' 
                ? '18px 18px 4px 18px' 
                : '18px 18px 18px 4px',
              backgroundColor: msg.role === 'user' ? '#1a73e8' : 'white',
              color: msg.role === 'user' ? 'white' : '#333',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              whiteSpace: 'pre-wrap',
              fontSize: 14,
              lineHeight: 1.6,
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 10,
            color: '#666',
            padding: '8px 0',
          }}>
            <div style={{
              display: 'flex',
              gap: 4,
            }}>
              {[0, 1, 2].map(i => (
                <div 
                  key={i}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: '#1a73e8',
                    animation: `bounce 1.4s ease-in-out ${i * 0.16}s infinite both`,
                  }} 
                />
              ))}
            </div>
            <span style={{ fontSize: 14 }}>Denkt nach...</span>
          </div>
        )}

        {error && (
          <div style={{ 
            padding: 14, 
            backgroundColor: '#ffebee', 
            borderRadius: 10,
            color: '#c62828',
            fontSize: 13,
            marginTop: 8,
          }}>
            <strong>Fehler:</strong> {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: 16,
        backgroundColor: 'white',
        borderTop: '1px solid #e8e8e8',
        display: 'flex',
        gap: 10,
      }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Frage stellen... (Enter zum Senden)"
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: 24,
            border: '1px solid #ddd',
            outline: 'none',
            fontSize: 14,
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#1a73e8'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#ddd'}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          style={{
            width: 48,
            height: 48,
            backgroundColor: isLoading || !input.trim() ? '#ccc' : '#1a73e8',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.2s',
          }}
          aria-label="Senden"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export default AIChatPanel;
