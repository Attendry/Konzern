import { useMemo } from 'react';
import '../App.css';

interface SankeyNode {
  id: string;
  name: string;
  value?: number;
  color?: string;
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
  color?: string;
}

interface SankeyDiagramProps {
  nodes: SankeyNode[];
  links: SankeyLink[];
  width?: number;
  height?: number;
  onNodeClick?: (node: SankeyNode) => void;
  className?: string;
}

export function SankeyDiagram({
  nodes,
  links,
  width = 800,
  height = 600,
  onNodeClick,
  className = '',
}: SankeyDiagramProps) {
  // Simplified Sankey layout
  const layout = useMemo(() => {
    // Group nodes into columns (sources, intermediates, targets)
    const sourceNodes = nodes.filter(
      (node) => !links.some((link) => link.target === node.id)
    );
    const targetNodes = nodes.filter(
      (node) => !links.some((link) => link.source === node.id)
    );
    const intermediateNodes = nodes.filter(
      (node) =>
        links.some((link) => link.target === node.id) &&
        links.some((link) => link.source === node.id)
    );

    const nodePositions: Record<
      string,
      { x: number; y: number; width: number; height: number }
    > = {};
    const columnWidth = width / 3;
    const padding = 20;

    // Position source nodes (left column)
    sourceNodes.forEach((node, index) => {
      const nodeHeight = 40;
      const totalHeight = sourceNodes.length * nodeHeight + (sourceNodes.length - 1) * 10;
      const startY = (height - totalHeight) / 2;
      nodePositions[node.id] = {
        x: padding,
        y: startY + index * (nodeHeight + 10),
        width: columnWidth - padding * 2,
        height: nodeHeight,
      };
    });

    // Position intermediate nodes (middle column)
    intermediateNodes.forEach((node, index) => {
      const nodeHeight = 40;
      const totalHeight =
        intermediateNodes.length * nodeHeight + (intermediateNodes.length - 1) * 10;
      const startY = (height - totalHeight) / 2;
      nodePositions[node.id] = {
        x: columnWidth + padding,
        y: startY + index * (nodeHeight + 10),
        width: columnWidth - padding * 2,
        height: nodeHeight,
      };
    });

    // Position target nodes (right column)
    targetNodes.forEach((node, index) => {
      const nodeHeight = 40;
      const totalHeight = targetNodes.length * nodeHeight + (targetNodes.length - 1) * 10;
      const startY = (height - totalHeight) / 2;
      nodePositions[node.id] = {
        x: columnWidth * 2 + padding,
        y: startY + index * (nodeHeight + 10),
        width: columnWidth - padding * 2,
        height: nodeHeight,
      };
    });

    return nodePositions;
  }, [nodes, links, width, height]);

  const getLinkPath = (
    source: SankeyNode,
    target: SankeyNode
  ): string => {
    const sourcePos = layout[source.id];
    const targetPos = layout[target.id];
    if (!sourcePos || !targetPos) return '';

    const sourceX = sourcePos.x + sourcePos.width;
    const sourceY = sourcePos.y + sourcePos.height / 2;
    const targetX = targetPos.x;
    const targetY = targetPos.y + targetPos.height / 2;

    const midX = (sourceX + targetX) / 2;

    return `M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`;
  };

  return (
    <div className={`sankey-diagram ${className}`} style={{ width, height }}>
      <svg width={width} height={height} className="sankey-svg">
        {/* Render links */}
        {links.map((link, index) => {
          const sourceNode = nodes.find((n) => n.id === link.source);
          const targetNode = nodes.find((n) => n.id === link.target);
          if (!sourceNode || !targetNode) return null;

          const path = getLinkPath(sourceNode, targetNode);
          const linkColor = link.color || 'var(--color-accent-blue)';

          return (
            <path
              key={`link-${index}`}
              d={path}
              fill="none"
              stroke={linkColor}
              strokeWidth={Math.max(2, link.value / 1000)}
              opacity={0.6}
              className="sankey-link"
            />
          );
        })}

        {/* Render nodes */}
        {nodes.map((node) => {
          const pos = layout[node.id];
          if (!pos) return null;

          const nodeColor = node.color || 'var(--color-accent-blue)';

          return (
            <g
              key={node.id}
              className="sankey-node"
              onClick={() => onNodeClick?.(node)}
              style={{ cursor: onNodeClick ? 'pointer' : 'default' }}
            >
              <rect
                x={pos.x}
                y={pos.y}
                width={pos.width}
                height={pos.height}
                fill={nodeColor}
                className="sankey-node-rect"
                rx={4}
              />
              <text
                x={pos.x + pos.width / 2}
                y={pos.y + pos.height / 2 + 5}
                textAnchor="middle"
                fontSize="12"
                fill="white"
                fontWeight="500"
                className="sankey-node-label"
              >
                {node.name.length > 15
                  ? `${node.name.substring(0, 15)}...`
                  : node.name}
              </text>
              {node.value !== undefined && (
                <text
                  x={pos.x + pos.width / 2}
                  y={pos.y + pos.height / 2 + 20}
                  textAnchor="middle"
                  fontSize="10"
                  fill="white"
                  opacity={0.9}
                >
                  {node.value.toLocaleString('de-DE')}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}