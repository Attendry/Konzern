import React from 'react';
import './Callout.css';

export type CalloutType = 'warning' | 'tip' | 'info' | 'success' | 'hgb';

interface CalloutProps {
  type: CalloutType;
  title?: string;
  children: React.ReactNode;
}

const calloutConfig = {
  warning: {
    icon: '⚠️',
    title: 'Wichtig',
    className: 'callout-warning'
  },
  tip: {
    icon: '💡',
    title: 'Tipp',
    className: 'callout-tip'
  },
  info: {
    icon: 'ℹ️',
    title: 'Information',
    className: 'callout-info'
  },
  success: {
    icon: '✅',
    title: 'Best Practice',
    className: 'callout-success'
  },
  hgb: {
    icon: '📜',
    title: 'HGB-Referenz',
    className: 'callout-hgb'
  }
};

export function Callout({ type, title, children }: CalloutProps) {
  const config = calloutConfig[type];
  const displayTitle = title || config.title;

  return (
    <div className={`callout ${config.className}`}>
      <div className="callout-header">
        <span className="callout-icon">{config.icon}</span>
        <span className="callout-title">{displayTitle}</span>
      </div>
      <div className="callout-content">
        {children}
      </div>
    </div>
  );
}
