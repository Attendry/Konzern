import '../App.css';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  rounded?: boolean;
}

export function Skeleton({ width, height, className = '', rounded = true }: SkeletonProps) {
  const style: React.CSSProperties = {
    width: width || '100%',
    height: height || '1rem',
    borderRadius: rounded ? 'var(--radius-md)' : '0',
  };

  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div className="table-skeleton">
      <div className="table-skeleton-header">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} height="20px" width="100px" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="table-skeleton-row">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} height="16px" width="80%" />
          ))}
        </div>
      ))}
    </div>
  );
}

interface MetricCardSkeletonProps {
  count?: number;
}

export function MetricCardSkeleton({ count = 3 }: MetricCardSkeletonProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-4)' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="metric-card">
          <Skeleton height="14px" width="60%" />
          <div style={{ marginTop: 'var(--spacing-4)' }}>
            <Skeleton height="32px" width="80%" />
          </div>
        </div>
      ))}
    </div>
  );
}