import type { FC, ReactNode } from 'react';
import './Tabs.css';

// ============================================================
// Tabs — Reusable tab navigation component
// ============================================================

export interface TabItem {
  id: string;
  label: string;
  content?: ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  activeTabId: string;
  onChange: (id: string) => void;
}

export const Tabs: FC<TabsProps> = ({ tabs, activeTabId, onChange }) => {
  return (
    <div className="tabs">
      <div className="tabs__header" role="tablist">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              className={`tabs__btn${isActive ? ' tabs__btn--active' : ''}`}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="tabs__content" role="tabpanel">
        {tabs.find(t => t.id === activeTabId)?.content}
      </div>
    </div>
  );
};
