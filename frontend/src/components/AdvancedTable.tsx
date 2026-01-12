import { useState, useMemo, ReactNode } from 'react';
import { Sparkline } from './Sparkline';
import '../App.css';

export interface TableColumn<T> {
  id: string;
  header: string;
  accessor: (row: T) => any;
  width?: string | number;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T) => ReactNode;
  sparkline?: {
    data: (row: T) => number[];
    color?: string;
  };
}

interface AdvancedTableProps<T extends { id: string }> {
  data: T[];
  columns: TableColumn<T>[];
  onRowClick?: (row: T) => void;
  onRowContextMenu?: (e: React.MouseEvent, row: T) => void;
  selectable?: boolean;
  onSelectionChange?: (selectedIds: string[]) => void;
  emptyMessage?: string;
  loading?: boolean;
  className?: string;
}

export function AdvancedTable<T extends { id: string }>({
  data,
  columns,
  onRowClick,
  onRowContextMenu,
  selectable = false,
  onSelectionChange,
  emptyMessage = 'No data available',
  loading = false,
  className = '',
}: AdvancedTableProps<T>) {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);

  const sortedData = useMemo(() => {
    if (!sortConfig) return data;
    
    return [...data].sort((a, b) => {
      const column = columns.find((c) => c.id === sortConfig.column);
      if (!column) return 0;
      
      const aVal = column.accessor(a);
      const bVal = column.accessor(b);
      
      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      // Compare values
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      
      if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig, columns]);

  const handleSort = (columnId: string) => {
    setSortConfig((prev) => {
      if (prev?.column === columnId) {
        return prev.direction === 'asc' ? { column: columnId, direction: 'desc' } : null;
      }
      return { column: columnId, direction: 'asc' };
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(data.map((d) => d.id));
      setSelectedRows(allIds);
      onSelectionChange?.(Array.from(allIds));
    } else {
      setSelectedRows(new Set());
      onSelectionChange?.([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedRows);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedRows(newSelected);
    onSelectionChange?.(Array.from(newSelected));
  };

  if (loading) {
    return (
      <div className="advanced-table-loading">
        <div className="loading-spinner"></div>
        <span>Loading data...</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="advanced-table-empty">
        <div className="empty-state">
          <div className="empty-state-title">{emptyMessage}</div>
        </div>
      </div>
    );
  }

  const allSelected = data.length > 0 && selectedRows.size === data.length;
  const someSelected = selectedRows.size > 0 && selectedRows.size < data.length;

  return (
    <div className={`advanced-table-wrapper ${className}`}>
      {selectable && selectedRows.size > 0 && (
        <div className="advanced-table-bulk-actions">
          <div className="bulk-actions-bar">
            <span>{selectedRows.size} selected</span>
            <button
              className="button button-sm button-secondary"
              onClick={() => {
                setSelectedRows(new Set());
                onSelectionChange?.([]);
              }}
            >
              Clear selection
            </button>
          </div>
        </div>
      )}
      <div className="advanced-table-container">
        <table className="advanced-table">
          <thead className="advanced-table-thead">
            <tr>
              {selectable && (
                <th className="advanced-table-th-checkbox" style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = someSelected;
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    aria-label="Select all rows"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.id}
                  className={`advanced-table-th ${column.sortable ? 'sortable' : ''}`}
                  style={{
                    width: column.width,
                    textAlign: column.align || 'left',
                  }}
                  onClick={() => column.sortable && handleSort(column.id)}
                >
                  <div className="advanced-table-th-content">
                    <span>{column.header}</span>
                    {column.sortable && (
                      <span className="advanced-table-sort-indicator">
                        {sortConfig?.column === column.id && (
                          <span className="sort-icon">
                            {sortConfig.direction === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                        {sortConfig?.column !== column.id && (
                          <span className="sort-icon-placeholder">⇅</span>
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="advanced-table-tbody">
            {sortedData.map((row) => {
              const isSelected = selectedRows.has(row.id);
              return (
                <tr
                  key={row.id}
                  className={`advanced-table-tr ${isSelected ? 'selected' : ''} ${onRowClick ? 'clickable' : ''}`}
                  onClick={() => onRowClick?.(row)}
                  onContextMenu={(e) => onRowContextMenu?.(e, row)}
                >
                  {selectable && (
                    <td
                      className="advanced-table-td-checkbox"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleSelectRow(row.id, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select row ${row.id}`}
                      />
                    </td>
                  )}
                  {columns.map((column) => {
                    const value = column.accessor(row);
                    return (
                      <td
                        key={column.id}
                        className="advanced-table-td"
                        style={{ textAlign: column.align || 'left' }}
                      >
                        {column.render ? (
                          column.render(value, row)
                        ) : column.sparkline ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                            <span>{value}</span>
                            <Sparkline
                              data={column.sparkline.data(row)}
                              width={80}
                              height={20}
                              color={column.sparkline.color}
                            />
                          </div>
                        ) : (
                          value
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}