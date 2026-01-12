# UI 2026 Implementation Guide - Practical Examples

## Quick Reference: Before vs After

### Current State (2018-style)
- Basic Notion-inspired design
- Simple hover states
- Basic loading spinners
- Alert-based notifications
- Static tables
- Basic form inputs
- Simple cards

### Target State (2026-ready)
- Glassmorphism and depth
- Advanced micro-interactions
- Skeleton loaders
- Toast notification system
- Interactive, virtual-scrolled tables
- Smart form inputs with validation
- Interactive, expandable cards

---

## Implementation Examples

### 1. Command Palette (Cmd+K)

**Component Structure:**
```tsx
// components/CommandPalette.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Command {
  id: string;
  label: string;
  category: string;
  action: () => void;
  shortcut?: string;
  icon?: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const commands: Command[] = [
    {
      id: 'dashboard',
      label: 'Go to Dashboard',
      category: 'Navigation',
      action: () => navigate('/'),
      shortcut: '⌘1',
    },
    {
      id: 'companies',
      label: 'Go to Companies',
      category: 'Navigation',
      action: () => navigate('/companies'),
      shortcut: '⌘2',
    },
    {
      id: 'new-company',
      label: 'Create New Company',
      category: 'Actions',
      action: () => {
        navigate('/companies');
        // Trigger form open
      },
    },
    // ... more commands
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const filteredCommands = commands.filter(cmd =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  if (!open) return null;

  return (
    <div className="command-palette-overlay" onClick={() => setOpen(false)}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette-input-wrapper">
          <input
            type="text"
            className="command-palette-input"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <div className="command-palette-results">
          {filteredCommands.map((cmd) => (
            <button
              key={cmd.id}
              className="command-palette-item"
              onClick={() => {
                cmd.action();
                setOpen(false);
              }}
            >
              <span className="command-palette-label">{cmd.label}</span>
              {cmd.shortcut && (
                <span className="command-palette-shortcut">{cmd.shortcut}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**CSS:**
```css
.command-palette-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-overlay-dark);
  backdrop-filter: var(--backdrop-blur);
  z-index: var(--depth-modal);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 15vh;
  animation: fadeIn 150ms ease-out;
}

.command-palette {
  width: 100%;
  max-width: 640px;
  background: var(--color-bg-primary);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-overlay);
  overflow: hidden;
  animation: slideInUp 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

.command-palette-input-wrapper {
  padding: var(--spacing-4);
  border-bottom: 1px solid var(--color-border);
}

.command-palette-input {
  width: 100%;
  padding: var(--spacing-3) var(--spacing-4);
  font-size: var(--font-size-base);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-secondary);
}

.command-palette-results {
  max-height: 400px;
  overflow-y: auto;
  padding: var(--spacing-2);
}

.command-palette-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-3) var(--spacing-4);
  border-radius: var(--radius-md);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color var(--transition-fast);
  text-align: left;
}

.command-palette-item:hover,
.command-palette-item:focus {
  background: var(--color-bg-hover);
  outline: none;
}

.command-palette-shortcut {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  font-family: var(--font-family-mono);
}
```

---

### 2. Toast Notification System

**Component:**
```tsx
// components/Toast.tsx
import { useEffect } from 'react';

interface ToastProps {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  onClose: (id: string) => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function Toast({ id, message, type = 'info', duration = 5000, onClose, action }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => onClose(id), duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  return (
    <div className={`toast toast-${type}`} role="alert">
      <div className="toast-content">
        <span className="toast-message">{message}</span>
        {action && (
          <button className="toast-action" onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>
      <button className="toast-close" onClick={() => onClose(id)} aria-label="Close">
        ×
      </button>
    </div>
  );
}

// Toast Container
export function ToastContainer({ toasts, onClose }: { toasts: ToastProps[]; onClose: (id: string) => void }) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={onClose} />
      ))}
    </div>
  );
}
```

**CSS:**
```css
.toast-container {
  position: fixed;
  top: var(--spacing-4);
  right: var(--spacing-4);
  z-index: var(--depth-toast);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  max-width: 400px;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-4);
  box-shadow: var(--shadow-elevated);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-4);
  animation: slideInRight 300ms cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 300px;
}

.toast-success {
  border-left: 4px solid var(--color-success);
}

.toast-error {
  border-left: 4px solid var(--color-error);
}

.toast-info {
  border-left: 4px solid var(--color-info);
}

.toast-warning {
  border-left: 4px solid var(--color-warning);
}

.toast-content {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.toast-action {
  padding: var(--spacing-1) var(--spacing-3);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.toast-action:hover {
  background: var(--color-bg-hover);
}

.toast-close {
  background: transparent;
  border: none;
  font-size: var(--font-size-xl);
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: var(--spacing-1);
  line-height: 1;
  transition: color var(--transition-fast);
}

.toast-close:hover {
  color: var(--color-text-primary);
}
```

**Hook:**
```tsx
// hooks/useToast.ts
import { useState, useCallback } from 'react';

export function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type?: string }>>([]);

  const showToast = useCallback((message: string, type = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, removeToast };
}
```

---

### 3. Enhanced Table with Virtual Scrolling

**Component:**
```tsx
// components/AdvancedTable.tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useState, useRef, useMemo } from 'react';

interface Column<T> {
  id: string;
  header: string;
  accessor: (row: T) => any;
  width?: number;
  sortable?: boolean;
  resizable?: boolean;
}

interface AdvancedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  selectable?: boolean;
}

export function AdvancedTable<T extends { id: string }>({
  data,
  columns,
  onRowClick,
  selectable = false,
}: AdvancedTableProps<T>) {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 5,
  });

  const sortedData = useMemo(() => {
    if (!sortConfig) return data;
    return [...data].sort((a, b) => {
      const column = columns.find((c) => c.id === sortConfig.column);
      if (!column) return 0;
      const aVal = column.accessor(a);
      const bVal = column.accessor(b);
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig, columns]);

  return (
    <div className="advanced-table-wrapper">
      <div className="advanced-table-header">
        {selectable && (
          <div className="advanced-table-bulk-actions">
            {selectedRows.size > 0 && (
              <div className="bulk-actions-bar">
                <span>{selectedRows.size} selected</span>
                <button className="button button-sm">Export</button>
                <button className="button button-sm button-danger">Delete</button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="advanced-table-container" ref={parentRef}>
        <table className="advanced-table">
          <thead className="advanced-table-thead">
            <tr>
              {selectable && (
                <th className="advanced-table-th-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === data.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRows(new Set(data.map((d) => d.id)));
                      } else {
                        setSelectedRows(new Set());
                      }
                    }}
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.id}
                  className="advanced-table-th"
                  style={{ width: column.width }}
                >
                  <div className="advanced-table-th-content">
                    <span>{column.header}</span>
                    {column.sortable && (
                      <button
                        className="advanced-table-sort"
                        onClick={() => {
                          setSortConfig({
                            column: column.id,
                            direction:
                              sortConfig?.column === column.id && sortConfig.direction === 'asc'
                                ? 'desc'
                                : 'asc',
                          });
                        }}
                      >
                        {sortConfig?.column === column.id && (
                          <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="advanced-table-tbody">
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = sortedData[virtualRow.index];
              return (
                <tr
                  key={row.id}
                  className={`advanced-table-tr ${selectedRows.has(row.id) ? 'selected' : ''}`}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onClick={() => onRowClick?.(row)}
                >
                  {selectable && (
                    <td className="advanced-table-td-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(row.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          const newSelected = new Set(selectedRows);
                          if (e.target.checked) {
                            newSelected.add(row.id);
                          } else {
                            newSelected.delete(row.id);
                          }
                          setSelectedRows(newSelected);
                        }}
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td key={column.id} className="advanced-table-td">
                      {column.accessor(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

### 4. Skeleton Loader

**Component:**
```tsx
// components/Skeleton.tsx
export function Skeleton({ width, height, className }: { width?: string; height?: string; className?: string }) {
  return (
    <div
      className={`skeleton ${className || ''}`}
      style={{ width, height }}
    />
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="table-skeleton">
      <div className="table-skeleton-header">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} height="20px" width="100px" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="table-skeleton-row">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} height="16px" width="80%" />
          ))}
        </div>
      ))}
    </div>
  );
}
```

**CSS:**
```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-bg-tertiary) 0%,
    var(--color-bg-hover) 50%,
    var(--color-bg-tertiary) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-md);
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.table-skeleton {
  padding: var(--spacing-4);
}

.table-skeleton-header {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: var(--spacing-4);
  margin-bottom: var(--spacing-4);
  padding-bottom: var(--spacing-4);
  border-bottom: 1px solid var(--color-border);
}

.table-skeleton-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: var(--spacing-4);
  padding: var(--spacing-3) 0;
}
```

---

### 5. Enhanced Metric Card

**Component:**
```tsx
// components/MetricCard.tsx
import { useEffect, useState } from 'react';

interface MetricCardProps {
  label: string;
  value: number;
  previousValue?: number;
  trend?: 'up' | 'down' | 'neutral';
  format?: (value: number) => string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export function MetricCard({
  label,
  value,
  previousValue,
  trend,
  format = (v) => v.toLocaleString(),
  icon,
  onClick,
}: MetricCardProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 1000;
    const steps = 60;
    const increment = value / steps;
    const stepDuration = duration / steps;

    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [value]);

  const change = previousValue ? ((value - previousValue) / previousValue) * 100 : 0;
  const isPositive = change > 0;

  return (
    <div
      className={`metric-card-enhanced ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
    >
      <div className="metric-card-header">
        <span className="metric-card-label">{label}</span>
        {icon && <span className="metric-card-icon">{icon}</span>}
      </div>
      <div className="metric-card-value">{format(displayValue)}</div>
      {previousValue !== undefined && (
        <div className={`metric-card-trend trend-${trend || (isPositive ? 'up' : 'down')}`}>
          <span className="trend-icon">{isPositive ? '↑' : '↓'}</span>
          <span>{Math.abs(change).toFixed(1)}%</span>
          <span className="trend-label">vs previous</span>
        </div>
      )}
    </div>
  );
}
```

**CSS:**
```css
.metric-card-enhanced {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-6);
  transition: all var(--transition-base);
}

.metric-card-enhanced:hover {
  border-color: var(--color-border-hover);
  box-shadow: var(--shadow-float);
  transform: translateY(-2px);
}

.metric-card-enhanced.clickable {
  cursor: pointer;
}

.metric-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-4);
}

.metric-card-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-wide);
  font-weight: var(--font-weight-medium);
}

.metric-card-icon {
  color: var(--color-text-tertiary);
}

.metric-card-value {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  line-height: var(--line-height-tight);
  margin-bottom: var(--spacing-2);
}

.metric-card-trend {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--font-size-sm);
}

.trend-up {
  color: var(--color-success);
}

.trend-down {
  color: var(--color-error);
}

.trend-neutral {
  color: var(--color-text-secondary);
}

.trend-icon {
  font-weight: var(--font-weight-bold);
}
```

---

## Implementation Priority Matrix

### High Impact, Low Effort (Start Here)
1. ✅ Toast notification system
2. ✅ Skeleton loaders
3. ✅ Enhanced metric cards
4. ✅ Micro-interactions (button feedback)
5. ✅ Command palette

### High Impact, Medium Effort
1. Advanced table with virtual scrolling
2. Dark mode
3. Enhanced form components
4. Page transitions
5. Chart enhancements

### High Impact, High Effort
1. Full design system overhaul
2. Gesture support
3. AI-powered features
4. Advanced visualizations

---

## Migration Strategy

### Step 1: Add New Components (Parallel)
- Build new components alongside existing ones
- Use feature flags to toggle
- Test thoroughly

### Step 2: Gradual Migration
- Start with new pages/features
- Migrate high-traffic pages first
- Keep old components as fallback

### Step 3: Full Adoption
- Remove old components
- Update all pages
- Document new patterns

---

## Testing Checklist

- [ ] All components work in light mode
- [ ] All components work in dark mode
- [ ] Keyboard navigation works
- [ ] Screen reader compatibility
- [ ] Mobile responsiveness
- [ ] Performance (60fps animations)
- [ ] Cross-browser compatibility
- [ ] Accessibility (WCAG compliance)

---

*This guide provides practical examples to get started with the 2026 modernization. Start with quick wins and gradually implement more advanced features.*