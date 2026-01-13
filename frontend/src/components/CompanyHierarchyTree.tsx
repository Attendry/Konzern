import { useEffect, useState, useMemo, useCallback } from 'react';
import { companyService } from '../services/companyService';
import '../App.css';

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
}

function CompanyHierarchyTree({ selectedCompanyId, onCompanyClick }: CompanyHierarchyTreeProps) {
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

  // If no group is selected yet, select the first one
  useEffect(() => {
    if (!selectedGroupId && hierarchyData.length > 0) {
      setSelectedGroupId(hierarchyData[0].id);
      // Expand all by default for initial view
      const allIds = getAllCompanyIds(hierarchyData[0]);
      setExpandedNodes(new Set(allIds));
    }
  }, [hierarchyData, selectedGroupId]);

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
    return hierarchyData.find(g => g.id === selectedGroupId) || null;
  }, [hierarchyData, selectedGroupId]);

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

  return (
    <div className="hierarchy-card">
      <div className="hierarchy-header">
        <div className="hierarchy-title-row">
          <h2 className="hierarchy-title">Unternehmenshierarchie</h2>
          {hierarchyData.length > 1 && (
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
          />
        )}
      </div>

      <div className="hierarchy-legend">
        <div className="hierarchy-legend-item">
          <span className="hierarchy-legend-dot hierarchy-legend-parent" />
          <span>Mutterunternehmen</span>
        </div>
        <div className="hierarchy-legend-item">
          <span className="hierarchy-legend-dot hierarchy-legend-subsidiary" />
          <span>Tochtergesellschaft</span>
        </div>
        <div className="hierarchy-legend-item">
          <span className="hierarchy-legend-dot hierarchy-legend-standalone" />
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
}: TreeViewProps) {
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const isHovered = hoveredNode === node.id;
  const isSelected = selectedCompanyId === node.id;

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
            {node.type === 'parent' ? '⬡' : node.type === 'subsidiary' ? '◇' : '○'}
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
