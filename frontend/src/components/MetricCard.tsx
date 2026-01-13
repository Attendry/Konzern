import { useEffect, useState } from 'react';
import '../App.css';

interface MetricCardProps {
  label?: string;
  title?: string; // Alias for label
  value: number | string;
  previousValue?: number;
  trend?: 'up' | 'down' | 'neutral';
  format?: (value: number) => string;
  icon?: React.ReactNode;
  onClick?: () => void;
  color?: string;
  subtitle?: string;
}

export function MetricCard({
  label,
  title,
  value,
  previousValue,
  trend,
  format = (v) => v.toLocaleString('de-DE'),
  icon,
  onClick,
  color,
  subtitle,
}: MetricCardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const displayLabel = label || title || '';
  const numericValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
  const isStringValue = typeof value === 'string' && isNaN(parseFloat(value));

  useEffect(() => {
    if (isStringValue) {
      setDisplayValue(0);
      return;
    }
    const duration = 1000;
    const steps = 60;
    const increment = numericValue / steps;
    const stepDuration = duration / steps;

    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= numericValue) {
        setDisplayValue(numericValue);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [numericValue, isStringValue]);

  const change = previousValue ? ((numericValue - previousValue) / previousValue) * 100 : 0;
  const isPositive = change > 0;
  const displayTrend = trend || (previousValue ? (isPositive ? 'up' : 'down') : 'neutral');

  return (
    <div
      className={`metric-card-enhanced ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      style={color ? { '--metric-color': color } as React.CSSProperties : undefined}
    >
      <div className="metric-card-header">
        <span className="metric-card-label">{displayLabel}</span>
        {icon && <span className="metric-card-icon">{icon}</span>}
      </div>
      <div className="metric-card-value" style={color ? { color } : undefined}>
        {isStringValue ? value : format(displayValue)}
      </div>
      {subtitle && (
        <div className="metric-card-subtitle">{subtitle}</div>
      )}
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