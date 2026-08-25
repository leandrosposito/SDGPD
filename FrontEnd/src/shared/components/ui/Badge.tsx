import type { FC } from 'react';
import './Badge.css';

// ============================================================
// Badge — Status pill component
// ============================================================

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'accent';

interface BadgeProps {
  label: string;
  variant: BadgeVariant;
}

export const Badge: FC<BadgeProps> = ({ label, variant }) => {
  return (
    <span className={`badge badge--${variant}`} role="status">
      <span className="badge__dot" aria-hidden="true" />
      {label}
    </span>
  );
};
