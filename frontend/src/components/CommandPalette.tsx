import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css';

interface Command {
  id: string;
  label: string;
  category: string;
  action: () => void;
  shortcut?: string;
  icon?: string;
  keywords?: string[];
}

interface CommandPaletteProps {
  onClose?: () => void;
}

// Detect if running on macOS
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
const modifierKey = isMac ? '⌘' : 'Ctrl';

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  const commands: Command[] = useMemo(() => [
    {
      id: 'dashboard',
      label: 'Go to Dashboard',
      category: 'Navigation',
      action: () => {
        navigate('/');
        setOpen(false);
      },
      shortcut: `${modifierKey}1`,
      keywords: ['dashboard', 'home', 'start'],
    },
    {
      id: 'companies',
      label: 'Go to Companies',
      category: 'Navigation',
      action: () => {
        navigate('/companies');
        setOpen(false);
      },
      shortcut: `${modifierKey}2`,
      keywords: ['companies', 'unternehmen', 'companies'],
    },
    {
      id: 'import',
      label: 'Go to Data Import',
      category: 'Navigation',
      action: () => {
        navigate('/import');
        setOpen(false);
      },
      shortcut: `${modifierKey}3`,
      keywords: ['import', 'data', 'upload'],
    },
    {
      id: 'consolidation',
      label: 'Go to Consolidation',
      category: 'Navigation',
      action: () => {
        navigate('/consolidation');
        setOpen(false);
      },
      shortcut: `${modifierKey}4`,
      keywords: ['consolidation', 'konsolidierung'],
    },
    {
      id: 'new-company',
      label: 'Create New Company',
      category: 'Actions',
      action: () => {
        navigate('/companies');
        setOpen(false);
        // Trigger form open - would need to be handled by parent
        setTimeout(() => {
          const event = new CustomEvent('openCompanyForm');
          window.dispatchEvent(event);
        }, 100);
      },
      keywords: ['new', 'create', 'add', 'company'],
    },
  ], [navigate]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    
    const lowerQuery = query.toLowerCase();
    return commands.filter(cmd => {
      const matchesLabel = cmd.label.toLowerCase().includes(lowerQuery);
      const matchesKeywords = cmd.keywords?.some(kw => kw.toLowerCase().includes(lowerQuery));
      return matchesLabel || matchesKeywords;
    });
  }, [commands, query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
        setQuery('');
        setSelectedIndex(0);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
        setQuery('');
        onClose?.();
      }
      if (open) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        }
        if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
          e.preventDefault();
          filteredCommands[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, filteredCommands, selectedIndex, onClose]);

  if (!open) return null;

  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) {
      acc[cmd.category] = [];
    }
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  return (
    <div
      className="command-palette-overlay"
      onClick={() => {
        setOpen(false);
        onClose?.();
      }}
    >
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette-input-wrapper">
          <input
            type="text"
            className="command-palette-input"
            placeholder={`Type a command or search... (${modifierKey}+K to open)`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            autoFocus
          />
        </div>
        <div className="command-palette-results">
          {filteredCommands.length === 0 ? (
            <div className="command-palette-empty">
              No commands found
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, cmds]) => (
              <div key={category} className="command-palette-group">
                <div className="command-palette-category">{category}</div>
                {cmds.map((cmd) => {
                  const globalIndex = filteredCommands.findIndex(c => c.id === cmd.id);
                  return (
                    <button
                      key={cmd.id}
                      className={`command-palette-item ${globalIndex === selectedIndex ? 'selected' : ''}`}
                      onClick={() => cmd.action()}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                    >
                      <span className="command-palette-label">{cmd.label}</span>
                      {cmd.shortcut && (
                        <span className="command-palette-shortcut">{cmd.shortcut}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="command-palette-footer">
          <div className="command-palette-hint">
            <kbd>↑</kbd><kbd>↓</kbd> Navigate • <kbd>Enter</kbd> Select • <kbd>Esc</kbd> Close • <kbd>{modifierKey}</kbd><kbd>K</kbd> Open
          </div>
        </div>
      </div>
    </div>
  );
}