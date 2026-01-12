import { useEffect, useState, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import '../App.css';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className = '' }: PageTransitionProps) {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionStage, setTransitionStage] = useState<'entering' | 'entered'>('entered');

  useEffect(() => {
    if (location !== displayLocation) {
      setTransitionStage('entering');
      const timer = setTimeout(() => {
        setDisplayLocation(location);
        setTransitionStage('entered');
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [location, displayLocation]);

  return (
    <div
      className={`page-transition page-transition-${transitionStage} ${className}`}
      key={displayLocation.pathname}
    >
      {children}
    </div>
  );
}