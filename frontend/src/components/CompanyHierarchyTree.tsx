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
        <p>Lade Unternehmenshierarchie...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ backgroundColor: '#fee', border: '1px solid #fcc' }}>
        <p style={{ color: '#c33' }}>Fehler: {error}</p>
      </div>
    );
  }

  if (treeData.length === 0) {
    return (
      <div className="card">
        <p>Keine Unternehmenshierarchie verfügbar.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Unternehmenshierarchie</h2>
      <div style={{ 
        width: '100%', 
        height: '600px', 
        border: '1px solid #ddd',
        borderRadius: '4px',
        backgroundColor: '#fafafa',
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
      <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#3498db' }}></div>
          <span style={{ fontSize: '0.875rem' }}>Mutterunternehmen</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#27ae60' }}></div>
          <span style={{ fontSize: '0.875rem' }}>Tochtergesellschaft</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#95a5a6' }}></div>
          <span style={{ fontSize: '0.875rem' }}>Standalone</span>
        </div>
      </div>
    </div>
  );
}

export default CompanyHierarchyTree;
