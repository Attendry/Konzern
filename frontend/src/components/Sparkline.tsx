import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import '../App.css';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showTooltip?: boolean;
  strokeWidth?: number;
  className?: string;
}

export function Sparkline({
  data,
  width = 100,
  height = 20,
  color = 'var(--color-accent-blue)',
  showTooltip = false,
  strokeWidth = 2,
  className = '',
}: SparklineProps) {
  const minValue = Math.min(...data);
  const maxValue = Math.max(...data);
  const range = maxValue - minValue || 1;
  const normalizedData = data.map((value) => ({
    value: ((value - minValue) / range) * 100,
    original: value,
  }));

  if (data.length === 0) {
    return (
      <div
        className={`sparkline-empty ${className}`}
        style={{ width, height }}
        aria-label="No data"
      />
    );
  }

  const isPositive = data[data.length - 1] >= data[0];
  const sparklineColor = color || (isPositive ? 'var(--color-success)' : 'var(--color-error)');

  return (
    <div className={`sparkline ${className}`} style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={normalizedData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={sparklineColor}
            strokeWidth={strokeWidth}
            dot={false}
            isAnimationActive={true}
            animationDuration={500}
          />
          {showTooltip && (
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload[0]) {
                  const dataPoint = normalizedData[payload[0].payload.index];
                  return (
                    <div className="sparkline-tooltip">
                      {dataPoint.original.toLocaleString('de-DE', {
                        style: 'currency',
                        currency: 'EUR',
                      })}
                    </div>
                  );
                }
                return null;
              }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface SparklineWithValueProps extends SparklineProps {
  currentValue: number;
  previousValue?: number;
  format?: (value: number) => string;
}

export function SparklineWithValue({
  currentValue,
  previousValue,
  format = (v) => v.toLocaleString('de-DE'),
  ...sparklineProps
}: SparklineWithValueProps) {
  const trend = previousValue !== undefined
    ? currentValue >= previousValue
      ? 'up'
      : 'down'
    : 'neutral';

  return (
    <div className="sparkline-with-value">
      <div className="sparkline-value">{format(currentValue)}</div>
      <Sparkline
        {...sparklineProps}
        color={
          trend === 'up'
            ? 'var(--color-success)'
            : trend === 'down'
            ? 'var(--color-error)'
            : 'var(--color-text-secondary)'
        }
      />
      {previousValue !== undefined && (
        <div className={`sparkline-trend trend-${trend}`}>
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—'}
        </div>
      )}
    </div>
  );
}