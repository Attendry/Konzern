import React from 'react';
import { useAIChat } from '../../contexts/AIChatContext';
import { AIChatPanel } from './AIChatPanel';

/**
 * GlobalAIChat - Renders the floating chat button and panel
 * 
 * Place this component once in App.tsx - it will be visible on all pages.
 * The chat button appears in the bottom-right corner.
 */
export const GlobalAIChat: React.FC = () => {
  const { isOpen, toggleChat, isAvailable } = useAIChat();

  // Don't render anything if AI is not available
  if (!isAvailable) {
    return null;
  }

  return (
    <>
      {/* Floating Chat Button - Always visible when chat is closed */}
      {!isOpen && (
        <button
          onClick={toggleChat}
          aria-label="AI Assistent öffnen"
          title="AI Assistent öffnen (Strg+K)"
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            width: 60,
            height: 60,
            borderRadius: '50%',
            backgroundColor: '#1a73e8',
            color: 'white',
            border: 'none',
            boxShadow: '0 4px 12px rgba(26, 115, 232, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            zIndex: 9998,
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(26, 115, 232, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(26, 115, 232, 0.4)';
          }}
        >
          <svg 
            width="28" 
            height="28" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* Chat Panel - Opens when button clicked */}
      <AIChatPanel />
    </>
  );
};

export default GlobalAIChat;
