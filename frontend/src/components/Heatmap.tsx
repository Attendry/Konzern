import { useMemo } from 'react';
import '../App.css';

interface HeatmapCell {
  x: string | number;
  y: string | number;
  value: number;
  label?: string;
}

interface HeatmapProps {
  data: HeatmapCell[];
  xLabels?: string[];
  yLabels?: string[];
  colorScale?: (value: number, min: number, max: number) => string;
  cellSize?: number;
  onCellClick?: (cell: HeatmapCell) => void;
  className?: string;
}

export function Heatmap({
  data,
  xLabels,
  yLabels,
  colorScale,
  cellSize = 40,
  onCellClick,
  className = '',
}: HeatmapProps) {
  const { minValue, maxValue, processedData } = useMemo(() => {
    if (data.length === 0) {
      return { minValue: 0, maxValue: 0, processedData: [] };
    }

    const values = data.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Group data by x and y coordinates
    const grouped = new Map<string, HeatmapCell>();
    data.forEach((cell) => {
      const key = `${cell.x}-${cell.y}`;
      grouped.set(key, cell);
    });

    return {
      minValue: min,
      maxValue: max,
      processedData: Array.from(grouped.values()),
    };
  }, [data]);

  const defaultColorScale = (value: number, min: number, max: number): string => {
    if (max === min) return 'var(--color-bg-tertiary)';
    const normalized = (value - min) / (max - min);
    
    // Use a color gradient from light to dark
    const hue = 200; // Blue hue
    const saturation = 70;
    const lightness = 100 - normalized * 50; // From light to dark
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  const getCellColor = (value: number) => {
    const scale = colorScale || defaultColorScale;
    return scale(value, minValue, maxValue);
  };

  // Extract unique x and y labels if not provided
  const uniqueXLabels = xLabels || Array.from(new Set(data.map((d) => String(d.x))));
  const uniqueYLabels = yLabels || Array.from(new Set(data.map((d) => String(d.y))));

  const getCellValue = (x: string, y: string): HeatmapCell | undefined => {
    return processedData.find((cell) => String(cell.x) === x && String(cell.y) === y);
  };

  return (
    <div className={`heatmap ${className}`}>
      <div className="heatmap-container">
        {/* Y-axis labels */}
        <div className="heatmap-y-labels">
          {uniqueYLabels.map((label) => (
            <div key={label} className="heatmap-y-label">
              {label}
            </div>
          ))}
        </div>

        {/* Main heatmap grid */}
        <div className="heatmap-grid">
          {/* X-axis labels */}
          <div className="heatmap-x-labels">
            {uniqueXLabels.map((label) => (
              <div key={label} className="heatmap-x-label">
                {label}
              </div>
            ))}
          </div>

          {/* Cells */}
          <div className="heatmap-cells">
            {uniqueYLabels.map((yLabel) => (
              <div key={yLabel} className="heatmap-row">
                {uniqueXLabels.map((xLabel) => {
                  const cell = getCellValue(xLabel, yLabel);
                  const value = cell?.value ?? 0;
                  const hasValue = cell !== undefined;

                  return (
                    <div
                      key={`${xLabel}-${yLabel}`}
                      className={`heatmap-cell ${hasValue ? 'has-value' : ''} ${onCellClick ? 'clickable' : ''}`}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        backgroundColor: hasValue ? getCellColor(value) : 'var(--color-bg-tertiary)',
                      }}
                      onClick={() => cell && onCellClick?.(cell)}
                      title={cell?.label || `${xLabel} × ${yLabel}: ${value.toLocaleString('de-DE')}`}
                    >
                      {hasValue && (
                        <span className="heatmap-cell-value">
                          {value.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="heatmap-legend">
        <span className="heatmap-legend-label">Min</span>
        <div className="heatmap-legend-gradient">
          {Array.from({ length: 10 }).map((_, i) => {
            const value = minValue + (maxValue - minValue) * (i / 9);
            return (
              <div
                key={i}
                className="heatmap-legend-cell"
                style={{ backgroundColor: getCellColor(value) }}
              />
            );
          })}
        </div>
        <span className="heatmap-legend-label">Max</span>
      </div>
    </div>
  );
}