import { useState, useRef, useEffect, ReactNode } from 'react';
import '../App.css';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: TooltipPosition;
  delay?: number;
  disabled?: boolean;
  className?: string;
}

export function Tooltip({
  content,
  children,
  position = 'top',
  delay = 200,
  disabled = false,
  className = '',
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>(position);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && tooltipRef.current && triggerRef.current) {
      // Auto-adjust position if tooltip would go off-screen
      const tooltip = tooltipRef.current;
      const trigger = triggerRef.current;
      const rect = tooltip.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();

      let newPosition = position;

      // Check if tooltip goes off screen and adjust
      if (position === 'top' && rect.top < 0) {
        newPosition = 'bottom';
      } else if (position === 'bottom' && rect.bottom > window.innerHeight) {
        newPosition = 'top';
      } else if (position === 'left' && rect.left < 0) {
        newPosition = 'right';
      } else if (position === 'right' && rect.right > window.innerWidth) {
        newPosition = 'left';
      }

      setTooltipPosition(newPosition);
    }
  }, [isVisible, position]);

  const showTooltip = () => {
    if (disabled) return;
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  return (
    <div
      ref={triggerRef}
      className={`tooltip-wrapper ${className}`}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`tooltip tooltip-${tooltipPosition}`}
          role="tooltip"
        >
          {content}
        </div>
      )}
    </div>
  );
}