import { useEffect, useState } from 'react';
import '../App.css';

interface MetricCardProps {
  label: string;
  value: number;
  previousValue?: number;
  trend?: 'up' | 'down' | 'neutral';
  format?: (value: number) => string;
  icon?: React.ReactNode;
  onClick?: () => void;
  color?: string;
}

export function MetricCard({
  label,
  value,
  previousValue,
  trend,
  format = (v) => v.toLocaleString('de-DE'),
  icon,
  onClick,
  color,
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
  const displayTrend = trend || (previousValue ? (isPositive ? 'up' : 'down') : 'neutral');

  return (
    <div
      className={`metric-card-enhanced ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      style={color ? { '--metric-color': color } as React.CSSProperties : undefined}
    >
      <div className="metric-card-header">
        <span className="metric-card-label">{label}</span>
        {icon && <span className="metric-card-icon">{icon}</span>}
      </div>
      <div className="metric-card-value" style={color ? { color } : undefined}>
        {format(displayValue)}
      </div>
      {previousValue !== undefined && (
        <div className={`metric-card-trend trend-${displayTrend}`}>
          <span className="trend-icon">{displayTrend === 'up' ? '↑' : displayTrend === 'down' ? '↓' : '—'}</span>
          <span>{Math.abs(change).toFixed(1)}%</span>
          <span className="trend-label">vs previous</span>
        </div>
      )}
    </div>
  );
}