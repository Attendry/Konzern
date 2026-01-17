import { useEffect, useState, useMemo, useCallback } from 'react';
import { companyService } from '../services/companyService';
import '../App.css';

// SVG Icons for company types
const CompanyIcons = {
  parent: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <path d="M5 21V7l8-4v18" />
      <path d="M19 21V11l-6-4" />
      <path d="M9 9v.01" />
      <path d="M9 12v.01" />
      <path d="M9 15v.01" />
    </svg>
  ),
  subsidiary: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 9v.01" />
      <path d="M15 9v.01" />
      <path d="M9 15v.01" />
      <path d="M15 15v.01" />
    </svg>
  ),
  standalone: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  ),
};

interface CompanyHierarchy {
  id: string;
  name: string;
  type: 'parent' | 'subsidiary' | 'standalone';
  parentCompanyId: string | null;
  children: CompanyHierarchy[];
  participationPercentage?: number;
}

interface CompanyHierarchyTreeProps {
  selectedCompanyId?: string;
  onCompanyClick?: (companyId: string) => void;
  parentCompanyId?: string | null; // Filter to show only this parent company's hierarchy
  compact?: boolean; // Compact mode for inline use
}

function CompanyHierarchyTree({ 
  selectedCompanyId, 
  onCompanyClick,
  parentCompanyId,
  compact = false
}: CompanyHierarchyTreeProps) {
  const [hierarchyData, setHierarchyData] = useState<CompanyHierarchy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    loadHierarchy();
  }, []);

  // Auto-select the right group when selectedCompanyId changes
  useEffect(() => {
    if (selectedCompanyId && hierarchyData.length > 0) {
      const group = findCompanyGroup(hierarchyData, selectedCompanyId);
      if (group) {
        setSelectedGroupId(group.id);
        // Auto-expand to the selected company
        expandToCompany(selectedCompanyId, group);
      }
    }
  }, [selectedCompanyId, hierarchyData]);

  // If parentCompanyId is provided, filter to that group
  useEffect(() => {
    if (parentCompanyId && hierarchyData.length > 0) {
      const group = hierarchyData.find(g => g.id === parentCompanyId);
      if (group) {
        setSelectedGroupId(parentCompanyId);
        // Expand all nodes in this group
        const allIds = getAllCompanyIds(group);
        setExpandedNodes(new Set(allIds));
      }
    } else if (!selectedGroupId && hierarchyData.length > 0) {
      // If no group is selected yet, select the first one
      setSelectedGroupId(hierarchyData[0].id);
      // Expand all by default for initial view
      const allIds = getAllCompanyIds(hierarchyData[0]);
      setExpandedNodes(new Set(allIds));
    }
  }, [hierarchyData, selectedGroupId, parentCompanyId]);

  const loadHierarchy = async () => {
    try {
      setLoading(true);
      const data = await companyService.getHierarchy();
      const safeData = Array.isArray(data) ? data : [];
      setHierarchyData(safeData);
    } catch (err: any) {
      console.error('Error loading company hierarchy:', err);
      setError(err.message || 'Fehler beim Laden der Unternehmenshierarchie');
    } finally {
      setLoading(false);
    }
  };

  const findCompanyGroup = (groups: CompanyHierarchy[], companyId: string): CompanyHierarchy | null => {
    for (const group of groups) {
      if (group.id === companyId) return group;
      if (findInChildren(group.children, companyId)) return group;
    }
    return null;
  };

  const findInChildren = (children: CompanyHierarchy[], companyId: string): boolean => {
    for (const child of children) {
      if (child.id === companyId) return true;
      if (findInChildren(child.children, companyId)) return true;
    }
    return false;
  };

  const getAllCompanyIds = (company: CompanyHierarchy): string[] => {
    const ids = [company.id];
    for (const child of company.children) {
      ids.push(...getAllCompanyIds(child));
    }
    return ids;
  };

  const expandToCompany = (companyId: string, group: CompanyHierarchy) => {
    const path = findPathToCompany(group, companyId, []);
    if (path.length > 0) {
      setExpandedNodes(prev => new Set([...prev, ...path]));
    }
  };

  const findPathToCompany = (node: CompanyHierarchy, targetId: string, path: string[]): string[] => {
    if (node.id === targetId) {
      return [...path, node.id];
    }
    for (const child of node.children) {
      const result = findPathToCompany(child, targetId, [...path, node.id]);
      if (result.length > 0) return result;
    }
    return [];
  };

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const selectedGroup = useMemo(() => {
    if (parentCompanyId) {
      return hierarchyData.find(g => g.id === parentCompanyId) || null;
    }
    return hierarchyData.find(g => g.id === selectedGroupId) || null;
  }, [hierarchyData, selectedGroupId, parentCompanyId]);

  const handleGroupChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newGroupId = e.target.value;
    setSelectedGroupId(newGroupId);
    // Expand all nodes in the new group
    const group = hierarchyData.find(g => g.id === newGroupId);
    if (group) {
      const allIds = getAllCompanyIds(group);
      setExpandedNodes(new Set(allIds));
    }
  };

  if (loading) {
    return (
      <div className="hierarchy-card">
        <div className="hierarchy-loading">
          <div className="hierarchy-loading-spinner" />
          <span>Lade Unternehmenshierarchie...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="hierarchy-card">
        <div className="hierarchy-error">
          <span className="hierarchy-error-icon">⚠</span>
          <div>
            <strong>Fehler beim Laden</strong>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (hierarchyData.length === 0) {
    return (
      <div className="hierarchy-card">
        <div className="hierarchy-empty">
          <div className="hierarchy-empty-icon">—</div>
          <div className="hierarchy-empty-title">Keine Unternehmenshierarchie verfügbar</div>
          <div className="hierarchy-empty-desc">
            Erstellen Sie Unternehmen und definieren Sie Beziehungen, um eine Hierarchie anzuzeigen.
          </div>
        </div>
      </div>
    );
  }

  // In compact mode, show minimal UI
  if (compact) {
    return (
      <div style={{ width: '100%' }}>
        {loading ? (
          <div style={{ padding: 'var(--spacing-2)', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            Lade Hierarchie...
          </div>
        ) : error ? (
          <div style={{ padding: 'var(--spacing-2)', color: 'var(--color-error)' }}>
            Fehler: {error}
          </div>
        ) : selectedGroup ? (
          <div style={{ fontSize: '0.875rem' }}>
            <TreeView
              node={selectedGroup}
              level={0}
              expandedNodes={expandedNodes}
              hoveredNode={hoveredNode}
              selectedCompanyId={selectedCompanyId}
              onToggle={toggleNode}
              onHover={setHoveredNode}
              onClick={onCompanyClick}
              compact={true}
            />
          </div>
        ) : (
          <div style={{ padding: 'var(--spacing-2)', color: 'var(--color-text-secondary)' }}>
            Keine Hierarchie verfügbar
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="hierarchy-card">
      <div className="hierarchy-header">
        <div className="hierarchy-title-row">
          <h2 className="hierarchy-title">Unternehmenshierarchie</h2>
          {!parentCompanyId && hierarchyData.length > 1 && (
            <div className="hierarchy-selector">
              <label htmlFor="group-select">Konzern:</label>
              <select
                id="group-select"
                value={selectedGroupId || ''}
                onChange={handleGroupChange}
                className="hierarchy-select"
              >
                {hierarchyData.map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="hierarchy-tree-container">
        {selectedGroup && (
          <TreeView
            node={selectedGroup}
            level={0}
            expandedNodes={expandedNodes}
            hoveredNode={hoveredNode}
            selectedCompanyId={selectedCompanyId}
            onToggle={toggleNode}
            onHover={setHoveredNode}
            onClick={onCompanyClick}
            compact={false}
          />
        )}
      </div>

      <div className="hierarchy-legend">
        <div className="hierarchy-legend-item">
          <span className="hierarchy-legend-icon hierarchy-legend-parent">{CompanyIcons.parent}</span>
          <span>Mutterunternehmen</span>
        </div>
        <div className="hierarchy-legend-item">
          <span className="hierarchy-legend-icon hierarchy-legend-subsidiary">{CompanyIcons.subsidiary}</span>
          <span>Tochtergesellschaft</span>
        </div>
        <div className="hierarchy-legend-item">
          <span className="hierarchy-legend-icon hierarchy-legend-standalone">{CompanyIcons.standalone}</span>
          <span>Standalone</span>
        </div>
      </div>
    </div>
  );
}

interface TreeViewProps {
  node: CompanyHierarchy;
  level: number;
  expandedNodes: Set<string>;
  hoveredNode: string | null;
  selectedCompanyId?: string;
  onToggle: (id: string) => void;
  onHover: (id: string | null) => void;
  onClick?: (id: string) => void;
  compact?: boolean;
}

function TreeView({
  node,
  level,
  expandedNodes,
  hoveredNode,
  selectedCompanyId,
  onToggle,
  onHover,
  onClick,
  compact = false,
}: TreeViewProps) {
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const isHovered = hoveredNode === node.id;
  const isSelected = selectedCompanyId === node.id;

  if (compact) {
    return (
      <div style={{ 
        marginLeft: level > 0 ? 'var(--spacing-4)' : '0',
        marginBottom: 'var(--spacing-1)',
        fontSize: '0.875rem'
      }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-2)',
            padding: 'var(--spacing-1)',
            cursor: onClick ? 'pointer' : 'default',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: isHovered ? 'var(--color-bg-tertiary)' : 'transparent',
          }}
          onMouseEnter={() => onHover(node.id)}
          onMouseLeave={() => onHover(null)}
          onClick={() => onClick?.(node.id)}
        >
          {hasChildren && (
            <button
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--color-text-secondary)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onToggle(node.id);
              }}
            >
              <span style={{ fontSize: '0.75rem' }}>{isExpanded ? '▼' : '▶'}</span>
            </button>
          )}
          {!hasChildren && <span style={{ width: '12px' }} />}
          <span style={{ fontSize: '0.75rem' }}>
            {node.type === 'parent' ? '🏢' : node.type === 'subsidiary' ? '📦' : '🔵'}
          </span>
          <span style={{ fontWeight: node.type === 'parent' ? '600' : '400' }}>{node.name}</span>
          {node.participationPercentage !== undefined && node.participationPercentage > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
              ({node.participationPercentage}%)
            </span>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => (
              <TreeView
                key={child.id}
                node={child}
                level={level + 1}
                expandedNodes={expandedNodes}
                hoveredNode={hoveredNode}
                selectedCompanyId={selectedCompanyId}
                onToggle={onToggle}
                onHover={onHover}
                onClick={onClick}
                compact={true}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="hierarchy-tree-branch" style={{ '--level': level } as React.CSSProperties}>
      <div
        className={`hierarchy-node ${node.type} ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''}`}
        onMouseEnter={() => onHover(node.id)}
        onMouseLeave={() => onHover(null)}
        onClick={() => onClick?.(node.id)}
      >
        {level > 0 && (
          <div className="hierarchy-connector">
            <div className="hierarchy-connector-line hierarchy-connector-vertical" />
            <div className="hierarchy-connector-line hierarchy-connector-horizontal" />
          </div>
        )}
        
        <div className="hierarchy-node-content">
          {hasChildren && (
            <button
              className={`hierarchy-toggle ${isExpanded ? 'expanded' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggle(node.id);
              }}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M4 2L8 6L4 10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          
          <div className={`hierarchy-node-badge ${node.type}`}>
            {CompanyIcons[node.type] || CompanyIcons.standalone}
          </div>
          
          <div className="hierarchy-node-info">
            <span className="hierarchy-node-name">{node.name}</span>
            {node.participationPercentage !== undefined && node.participationPercentage > 0 && (
              <span className="hierarchy-node-percentage">{node.participationPercentage}%</span>
            )}
          </div>
          
          <div className="hierarchy-node-type-tag">{getTypeLabel(node.type)}</div>
        </div>
      </div>
      
      {hasChildren && isExpanded && (
        <div className="hierarchy-children">
          {node.children.map((child) => (
            <TreeView
              key={child.id}
              node={child}
              level={level + 1}
              expandedNodes={expandedNodes}
              hoveredNode={hoveredNode}
              selectedCompanyId={selectedCompanyId}
              onToggle={onToggle}
              onHover={onHover}
              onClick={onClick}
              compact={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'parent':
      return 'Mutter';
    case 'subsidiary':
      return 'Tochter';
    default:
      return 'Solo';
  }
}

export default CompanyHierarchyTree;
