import { Skeleton, TableSkeleton, MetricCardSkeleton } from './Skeleton';
import '../App.css';

export type LoadingStateType = 'table' | 'card' | 'list' | 'form' | 'metric-cards';

export interface LoadingStateProps {
  /** Type of skeleton to display */
  type: LoadingStateType;
  /** Number of items to show (for table, list, cards) */
  count?: number;
  /** Additional CSS classes */
  className?: string;
  /** Custom message to display */
  message?: string;
}

/**
 * LoadingState component with skeleton screens
 * 
 * Features:
 * - Multiple skeleton types
 * - Animated shimmer effect
 * - Matches content structure
 * - Responsive design
 */
export function LoadingState({
  type,
  count = 5,
  className = '',
  message,
}: LoadingStateProps) {
  const renderSkeleton = () => {
    switch (type) {
      case 'table':
        return <TableSkeleton rows={count} columns={4} />;
      
      case 'card':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="card">
                <div style={{ marginBottom: 'var(--spacing-3)' }}>
                  <Skeleton height="20px" width="60%" />
                </div>
                <div style={{ marginBottom: 'var(--spacing-2)' }}>
                  <Skeleton height="16px" width="100%" />
                </div>
                <Skeleton height="16px" width="80%" />
              </div>
            ))}
          </div>
        );
      
      case 'list':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
                <Skeleton height="40px" width="40px" rounded />
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: 'var(--spacing-1)' }}>
                    <Skeleton height="16px" width="60%" />
                  </div>
                  <Skeleton height="14px" width="40%" />
                </div>
              </div>
            ))}
          </div>
        );
      
      case 'form':
        return (
          <div className="card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
              {Array.from({ length: count }).map((_, i) => (
                <div key={i}>
                  <div style={{ marginBottom: 'var(--spacing-2)' }}>
                    <Skeleton height="14px" width="30%" />
                  </div>
                  <Skeleton height="40px" width="100%" />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 'var(--spacing-3)', marginTop: 'var(--spacing-4)' }}>
                <Skeleton height="40px" width="120px" />
                <Skeleton height="40px" width="100px" />
              </div>
            </div>
          </div>
        );
      
      case 'metric-cards':
        return <MetricCardSkeleton count={count} />;
      
      default:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
            {Array.from({ length: count }).map((_, i) => (
              <Skeleton key={i} height="20px" width="100%" />
            ))}
          </div>
        );
    }
  };

  return (
    <div className={`loading-state ${className}`}>
      {message && (
        <div style={{ 
          textAlign: 'center',
          marginBottom: 'var(--spacing-4)',
          color: 'var(--color-text-secondary)'
        }}>
          {message}
        </div>
      )}
      {renderSkeleton()}
    </div>
  );
}

export default LoadingState;
