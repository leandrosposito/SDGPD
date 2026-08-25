import type { FC } from 'react';
import './PlaceholderPage.css';

// ============================================================
// PlaceholderPage — Temporary placeholder for modules
// not yet implemented. Replace with the real module page.
// ============================================================

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export const PlaceholderPage: FC<PlaceholderPageProps> = ({ title, description }) => {
  return (
    <div className="placeholder-page page-enter" role="main">
      <div className="placeholder-page__content">
        <div className="placeholder-page__icon" aria-hidden="true">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="placeholder-page__title">{title}</h1>
        <p className="placeholder-page__desc">{description}</p>
        <div className="placeholder-page__badge">Proximo modulo</div>
      </div>
    </div>
  );
};
