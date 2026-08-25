import { type FC, type ReactNode } from 'react';
import './KpiCard.css';

// ============================================================
// KpiCard — Single KPI metric card
// ============================================================

interface KpiCardProps {
  label: string;
  value: string;
  subtext: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: ReactNode;
  variant?: 'default' | 'accent';
}

const IconTrendUp: FC = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="kpi-card__trend-icon kpi-card__trend-icon--up">
    <path d="M7 17l9.2-9.2M17 17V7.8M17 7.8H7.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const IconTrendDown: FC = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="kpi-card__trend-icon kpi-card__trend-icon--down">
    <path d="M7 7l9.2 9.2M16.2 7H7v9.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const KpiCard: FC<KpiCardProps> = ({ label, value, subtext, trend, icon, variant = 'default' }) => {
  return (
    <div className={`kpi-card kpi-card--${variant}`}>
      <div className="kpi-card__header">
        <span className="kpi-card__label">{label}</span>
        <div className="kpi-card__icon-wrap" aria-hidden="true">
          {icon}
        </div>
      </div>
      <div className="kpi-card__body">
        <span className="kpi-card__value">{value}</span>
        {trend && (
          <span className={`kpi-card__trend kpi-card__trend--${trend}`}>
            {trend === 'up' ? <IconTrendUp /> : trend === 'down' ? <IconTrendDown /> : null}
            {subtext}
          </span>
        )}
        {!trend && <span className="kpi-card__subtext">{subtext}</span>}
      </div>
    </div>
  );
};
