import { useEffect, useState } from 'react';
import { Tree } from 'react-d3-tree';
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

interface TreeNode {
  name: string;
  attributes: {
    type: string;
    id: string;
    participationPercentage?: string;
  };
  children?: TreeNode[];
}

function CompanyHierarchyTree() {
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHierarchy();
  }, []);

  const loadHierarchy = async () => {
    try {
      setLoading(true);
      const hierarchyData = await companyService.getHierarchy();
      
      // Ensure we have an array
      const safeData = Array.isArray(hierarchyData) ? hierarchyData : [];
      
      // Transform to tree structure
      const transformed = transformToTreeData(safeData);
      setTreeData(transformed);
    } catch (err: any) {
      console.error('Error loading company hierarchy:', err);
      setError(err.message || 'Fehler beim Laden der Unternehmenshierarchie');
    } finally {
      setLoading(false);
    }
  };

  const transformToTreeData = (companies: CompanyHierarchy[]): TreeNode[] => {
    return companies.map(company => ({
      name: company.name,
      attributes: {
        type: company.type,
        id: company.id,
        ...(company.participationPercentage && {
          participationPercentage: `${company.participationPercentage}%`
        })
      },
      children: company.children && company.children.length > 0
        ? transformToTreeData(company.children)
        : undefined
    }));
  };

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'parent':
        return '#3498db'; // Blue
      case 'subsidiary':
        return '#27ae60'; // Green
      default:
        return '#95a5a6'; // Gray
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="loading">
          <div className="loading-spinner"></div>
          <span>Lade Unternehmenshierarchie...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="error-message">
          <strong>Fehler:</strong> {error}
        </div>
      </div>
    );
  }

  if (treeData.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-title">Keine Unternehmenshierarchie verfügbar</div>
          <div className="empty-state-description">
            Erstellen Sie Unternehmen und definieren Sie Beziehungen, um eine Hierarchie anzuzeigen.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>Unternehmenshierarchie</h2>
      </div>
      <div style={{ 
        width: '100%', 
        height: '600px', 
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--color-bg-tertiary)',
        overflow: 'auto'
      }}>
        <Tree
          data={treeData}
          orientation="vertical"
          pathFunc="straight"
          translate={{ x: 400, y: 50 }}
          nodeSize={{ x: 200, y: 100 }}
          separation={{ siblings: 1.5, nonSiblings: 1.5 }}
          renderCustomNodeElement={(rd3tProps) => {
            const { nodeDatum } = rd3tProps;
            const nodeType = String(nodeDatum.attributes?.type ?? 'unknown');
            const color = getNodeColor(nodeType);
            return (
              <g>
                <circle
                  r="20"
                  fill={color}
                  stroke="#fff"
                  strokeWidth="2"
                  onClick={() => {
                    if (rd3tProps.toggleNode) {
                      rd3tProps.toggleNode();
                    }
                  }}
                />
                <text
                  x="0"
                  y="35"
                  textAnchor="middle"
                  fill="#333"
                  fontSize="12"
                  fontWeight="bold"
                >
                  {nodeDatum.name}
                </text>
                {nodeDatum.attributes?.participationPercentage && (
                  <text
                    x="0"
                    y="50"
                    textAnchor="middle"
                    fill="#666"
                    fontSize="10"
                  >
                    {String(nodeDatum.attributes.participationPercentage)}
                  </text>
                )}
                <text
                  x="0"
                  y="65"
                  textAnchor="middle"
                  fill="#999"
                  fontSize="9"
                  fontStyle="italic"
                >
                  {nodeType}
                </text>
              </g>
            );
          }}
        />
      </div>
      <div style={{ marginTop: 'var(--spacing-4)', display: 'flex', gap: 'var(--spacing-4)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--color-accent-blue)' }}></div>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Mutterunternehmen</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--color-success)' }}></div>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Tochtergesellschaft</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--color-text-tertiary)' }}></div>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>Standalone</span>
        </div>
      </div>
    </div>
  );
}

export default CompanyHierarchyTree;
