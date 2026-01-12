import { useMemo, useState } from 'react';
import '../App.css';

interface Node {
  id: string;
  label: string;
  type?: 'parent' | 'subsidiary';
  data?: any;
}

interface Edge {
  from: string;
  to: string;
  label?: string;
  weight?: number;
}

interface NetworkGraphProps {
  nodes: Node[];
  edges: Edge[];
  width?: number;
  height?: number;
  onNodeClick?: (node: Node) => void;
  className?: string;
}

export function NetworkGraph({
  nodes,
  edges,
  width = 800,
  height = 600,
  onNodeClick,
  className = '',
}: NetworkGraphProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Simple force-directed layout (simplified version)
  const layout = useMemo(() => {
    const nodePositions: Record<string, { x: number; y: number }> = {};
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.3;

    // Find parent nodes (nodes with no incoming edges)
    const parentNodes = nodes.filter(
      (node) => !edges.some((edge) => edge.to === node.id)
    );

    // Position parent nodes in center
    if (parentNodes.length === 1) {
      nodePositions[parentNodes[0].id] = { x: centerX, y: centerY };
    } else {
      parentNodes.forEach((node, index) => {
        const angle = (index / parentNodes.length) * 2 * Math.PI;
        nodePositions[node.id] = {
          x: centerX + Math.cos(angle) * radius * 0.5,
          y: centerY + Math.sin(angle) * radius * 0.5,
        };
      });
    }

    // Position child nodes in circles around their parents
    const positioned = new Set(parentNodes.map((n) => n.id));
    const queue = [...parentNodes];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = edges
        .filter((e) => e.from === current.id)
        .map((e) => nodes.find((n) => n.id === e.to))
        .filter((n): n is Node => n !== undefined);

      if (children.length > 0) {
        const parentPos = nodePositions[current.id];
        const childRadius = radius * 0.6;
        const angleStep = (2 * Math.PI) / children.length;

        children.forEach((child, index) => {
          if (!positioned.has(child.id)) {
            const angle = angleStep * index;
            nodePositions[child.id] = {
              x: parentPos.x + Math.cos(angle) * childRadius,
              y: parentPos.y + Math.sin(angle) * childRadius,
            };
            positioned.add(child.id);
            queue.push(child);
          }
        });
      }
    }

    // Fallback for any unpositioned nodes
    nodes.forEach((node) => {
      if (!nodePositions[node.id]) {
        const angle = Math.random() * 2 * Math.PI;
        nodePositions[node.id] = {
          x: centerX + Math.cos(angle) * radius * 0.8,
          y: centerY + Math.sin(angle) * radius * 0.8,
        };
      }
    });

    return nodePositions;
  }, [nodes, edges, width, height]);

  const handleNodeClick = (node: Node) => {
    setSelectedNode(node.id);
    onNodeClick?.(node);
  };

  return (
    <div className={`network-graph ${className}`} style={{ width, height }}>
      <svg width={width} height={height} className="network-graph-svg">
        {/* Render edges first (behind nodes) */}
        {edges.map((edge, index) => {
          const fromNode = layout[edge.from];
          const toNode = layout[edge.to];
          if (!fromNode || !toNode) return null;

          return (
            <g key={`edge-${index}`}>
              <line
                x1={fromNode.x}
                y1={fromNode.y}
                x2={toNode.x}
                y2={toNode.y}
                className={`network-edge ${selectedNode === edge.from || selectedNode === edge.to ? 'highlighted' : ''}`}
                strokeWidth={edge.weight ? Math.max(1, edge.weight / 10) : 2}
              />
              {edge.label && (
                <text
                  x={(fromNode.x + toNode.x) / 2}
                  y={(fromNode.y + toNode.y) / 2}
                  className="network-edge-label"
                  textAnchor="middle"
                  fontSize="12"
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Render nodes */}
        {nodes.map((node) => {
          const pos = layout[node.id];
          if (!pos) return null;

          const isSelected = selectedNode === node.id;
          const isHovered = hoveredNode === node.id;
          const nodeType = node.type || 'subsidiary';

          return (
            <g
              key={node.id}
              className={`network-node ${nodeType} ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
              onClick={() => handleNodeClick(node)}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: onNodeClick ? 'pointer' : 'default' }}
            >
              <circle
                cx={pos.x}
                cy={pos.y}
                r={nodeType === 'parent' ? 30 : 20}
                className="network-node-circle"
              />
              <text
                x={pos.x}
                y={pos.y + 5}
                className="network-node-label"
                textAnchor="middle"
                fontSize="12"
                fill="white"
                fontWeight="500"
              >
                {node.label.length > 10 ? `${node.label.substring(0, 10)}...` : node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}