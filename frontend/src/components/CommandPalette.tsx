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
    // Navigation Commands
    {
      id: 'dashboard',
      label: 'Zum Dashboard',
      category: 'Navigation',
      action: () => {
        navigate('/');
        setOpen(false);
      },
      shortcut: `${modifierKey}1`,
      icon: '🏠',
      keywords: ['dashboard', 'home', 'start', 'hauptseite'],
    },
    {
      id: 'companies',
      label: 'Unternehmensverwaltung',
      category: 'Navigation',
      action: () => {
        navigate('/companies');
        setOpen(false);
      },
      shortcut: `${modifierKey}2`,
      icon: '🏢',
      keywords: ['companies', 'unternehmen', 'verwaltung'],
    },
    {
      id: 'import',
      label: 'Datenimport',
      category: 'Navigation',
      action: () => {
        navigate('/import');
        setOpen(false);
      },
      shortcut: `${modifierKey}3`,
      icon: '📥',
      keywords: ['import', 'data', 'upload', 'daten', 'importieren'],
    },
    {
      id: 'consolidation',
      label: 'Konsolidierung',
      category: 'Navigation',
      action: () => {
        navigate('/consolidation');
        setOpen(false);
      },
      shortcut: `${modifierKey}4`,
      icon: '🔄',
      keywords: ['consolidation', 'konsolidierung'],
    },
    {
      id: 'reports',
      label: 'Berichte',
      category: 'Navigation',
      action: () => {
        navigate('/reports');
        setOpen(false);
      },
      shortcut: `${modifierKey}5`,
      icon: '📊',
      keywords: ['reports', 'berichte', 'reports'],
    },
    {
      id: 'documentation',
      label: 'Dokumentation',
      category: 'Navigation',
      action: () => {
        navigate('/documentation');
        setOpen(false);
      },
      shortcut: `${modifierKey}D`,
      icon: '📚',
      keywords: ['documentation', 'dokumentation', 'help', 'hilfe'],
    },
    // Action Commands
    {
      id: 'new-company',
      label: 'Neues Unternehmen erstellen',
      category: 'Aktionen',
      action: () => {
        navigate('/companies');
        setOpen(false);
        setTimeout(() => {
          const event = new CustomEvent('openCompanyForm');
          window.dispatchEvent(event);
        }, 100);
      },
      icon: '➕',
      keywords: ['new', 'create', 'add', 'company', 'neu', 'erstellen', 'unternehmen'],
    },
    {
      id: 'import-data',
      label: 'Daten importieren',
      category: 'Aktionen',
      action: () => {
        navigate('/import');
        setOpen(false);
      },
      icon: '📥',
      keywords: ['import', 'data', 'upload', 'daten', 'importieren'],
    },
    {
      id: 'run-consolidation',
      label: 'Konsolidierung durchführen',
      category: 'Aktionen',
      action: () => {
        navigate('/consolidation');
        setOpen(false);
      },
      icon: '🔄',
      keywords: ['consolidate', 'konsolidieren', 'run', 'durchführen'],
    },
    {
      id: 'view-audit',
      label: 'AI-Nutzungsprotokoll',
      category: 'Aktionen',
      action: () => {
        navigate('/ai-audit');
        setOpen(false);
      },
      icon: '📋',
      keywords: ['audit', 'protokoll', 'log', 'ai'],
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
            placeholder={`Befehl eingeben oder suchen... (${modifierKey}+K zum Öffnen)`}
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
              Keine Befehle gefunden
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
                      {cmd.icon && (
                        <span style={{ marginRight: 'var(--spacing-2)', fontSize: '1.2em' }}>
                          {cmd.icon}
                        </span>
                      )}
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
            <kbd>↑</kbd><kbd>↓</kbd> Navigieren • <kbd>Enter</kbd> Auswählen • <kbd>Esc</kbd> Schließen • <kbd>{modifierKey}</kbd><kbd>K</kbd> Öffnen
          </div>
        </div>
      </div>
    </div>
  );
}