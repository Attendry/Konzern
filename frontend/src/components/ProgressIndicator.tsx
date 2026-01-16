import React, { useEffect, useState } from 'react';
import './ProgressIndicator.css';

interface ProgressIndicatorProps {
  contentRef: React.RefObject<HTMLElement>;
}

export function ProgressIndicator({ contentRef }: ProgressIndicatorProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!contentRef.current) return;

      const element = contentRef.current;
      const scrollTop = element.scrollTop;
      const scrollHeight = element.scrollHeight - element.clientHeight;
      const progressPercent = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
      
      setProgress(Math.min(100, Math.max(0, progressPercent)));
    };

    const element = contentRef.current;
    if (element) {
      element.addEventListener('scroll', handleScroll);
      handleScroll(); // Initial calculation
      
      return () => {
        element.removeEventListener('scroll', handleScroll);
      };
    }
  }, [contentRef]);

  if (progress === 0) return null;

  return (
    <div className="progress-indicator">
      <div 
        className="progress-bar" 
        style={{ width: `${progress}%` }}
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}
