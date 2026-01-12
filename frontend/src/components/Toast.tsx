import { useEffect } from 'react';
import { Toast as ToastType } from '../hooks/useToast';
import '../App.css';

interface ToastProps extends ToastType {
  onClose: (id: string) => void;
}

export function Toast({ id, message, type = 'info', duration = 5000, onClose, action }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => onClose(id), duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  return (
    <div className={`toast toast-${type}`} role="alert" aria-live="polite">
      <div className="toast-content">
        <span className="toast-message">{message}</span>
        {action && (
          <button className="toast-action" onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>
      <button
        className="toast-close"
        onClick={() => onClose(id)}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastType[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={onClose} />
      ))}
    </div>
  );
}