import { useAIChat } from '../../contexts/AIChatContext';
import { AIChatPanel } from './AIChatPanel';
import './ai-chat.css';

/**
 * GlobalAIChat - Renders the floating chat button and panel
 * 
 * Place this component once in App.tsx - it will be visible on all pages.
 * The chat button appears in the bottom-right corner.
 */
export const GlobalAIChat = () => {
  const { isOpen, toggleChat } = useAIChat();

  return (
    <>
      {/* Floating Chat Button - Always visible when chat is closed */}
      {!isOpen && (
        <button
          onClick={toggleChat}
          className="ai-chat-fab"
          aria-label="AI Assistent öffnen"
          title="AI Assistent öffnen (Strg+K)"
        >
          <svg 
            width="26" 
            height="26" 
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
