import { useState, ReactNode } from 'react';
import { Tooltip } from './Tooltip';
import '../App.css';

interface HelpItem {
  id: string;
  title: string;
  content: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

interface ContextualHelpProps {
  helpId: string;
  title?: string;
  content: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactNode;
  className?: string;
}

const helpRegistry = new Map<string, HelpItem>();

export function ContextualHelp({
  helpId,
  title,
  content,
  position = 'top',
  children,
  className = '',
}: ContextualHelpProps) {
  const [isHelpVisible, setIsHelpVisible] = useState(false);

  // Register help item
  useState(() => {
    helpRegistry.set(helpId, { id: helpId, title: title || '', content, position });
    return null;
  });

  return (
    <div className={`contextual-help-wrapper ${className}`}>
      {children}
      <Tooltip
        content={
          <div className="contextual-help-tooltip">
            {title && <div className="contextual-help-title">{title}</div>}
            <div className="contextual-help-content">{content}</div>
          </div>
        }
        position={position}
        delay={300}
      >
        <button
          className="contextual-help-icon"
          onClick={(e) => {
            e.stopPropagation();
            setIsHelpVisible(!isHelpVisible);
          }}
          aria-label="Show help"
        >
          ?
        </button>
      </Tooltip>
    </div>
  );
}

// Hook to get help content
export function useHelp(helpId: string): HelpItem | undefined {
  return helpRegistry.get(helpId);
}