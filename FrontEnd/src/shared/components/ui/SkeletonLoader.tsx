import type { FC, CSSProperties } from 'react';
import './SkeletonLoader.css';

// ============================================================
// SkeletonLoader — Animated content placeholder
// ============================================================

interface SkeletonLoaderProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  style?: CSSProperties;
}

export const SkeletonLoader: FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = '1rem',
  borderRadius,
  style,
}) => {
  return (
    <span
      className="skeleton"
      role="status"
      aria-label="Cargando..."
      style={{
        width,
        height,
        borderRadius: borderRadius ?? 'var(--radius-sm)',
        ...style,
      }}
    />
  );
};

// Convenience composites
export const SkeletonCard: FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="skeleton-card">
    <SkeletonLoader height="1.5rem" width="60%" />
    <SkeletonLoader height="2.5rem" width="40%" style={{ marginTop: 'var(--space-2)' }} />
    {Array.from({ length: rows }).map((_, i) => (
      <SkeletonLoader key={i} height="0.75rem" style={{ marginTop: 'var(--space-2)' }} />
    ))}
  </div>
);

export const SkeletonTable: FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 5,
}) => (
  <div className="skeleton-table">
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="skeleton-table__row">
        {Array.from({ length: cols }).map((_, c) => (
          <SkeletonLoader key={c} height="0.875rem" />
        ))}
      </div>
    ))}
  </div>
);
