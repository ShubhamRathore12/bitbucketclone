import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  variant: ToastVariant;
  title?: string;
  message: string;
  duration?: number;
}

type ToastInput = Omit<ToastData, 'id'>;

interface ToastContextValue {
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
}

/* ------------------------------------------------------------------ */
/* Context                                                            */
/* ------------------------------------------------------------------ */

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

/* ------------------------------------------------------------------ */
/* Provider                                                           */
/* ------------------------------------------------------------------ */

let toastCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const toast = useCallback((input: ToastInput): string => {
    const id = `toast-${++toastCounter}`;
    const newToast: ToastData = { id, duration: 5000, ...input };
    setToasts((prev) => [...prev, newToast]);
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          aria-label="Notifications"
          className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2 max-w-sm w-full pointer-events-none"
        >
          {toasts.map((t) => (
            <ToastItem key={t.id} data={t} onDismiss={dismiss} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Single toast                                                       */
/* ------------------------------------------------------------------ */

const variantConfig: Record<
  ToastVariant,
  { icon: ReactNode; containerClass: string }
> = {
  success: {
    icon: <CheckCircle className="h-5 w-5 text-green-500" />,
    containerClass: 'border-green-200 dark:border-green-800 bg-white dark:bg-gray-800',
  },
  error: {
    icon: <AlertCircle className="h-5 w-5 text-red-500" />,
    containerClass: 'border-red-200 dark:border-red-800 bg-white dark:bg-gray-800',
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
    containerClass: 'border-yellow-200 dark:border-yellow-800 bg-white dark:bg-gray-800',
  },
  info: {
    icon: <Info className="h-5 w-5 text-blue-500" />,
    containerClass: 'border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800',
  },
};

interface ToastItemProps {
  data: ToastData;
  onDismiss: (id: string) => void;
}

function ToastItem({ data, onDismiss }: ToastItemProps) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const { icon, containerClass } = variantConfig[data.variant];

  const startExit = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(data.id), 200);
  }, [data.id, onDismiss]);

  // Auto-dismiss
  useEffect(() => {
    if (data.duration && data.duration > 0) {
      timerRef.current = setTimeout(startExit, data.duration);
      return () => clearTimeout(timerRef.current);
    }
  }, [data.duration, startExit]);

  return (
    <div
      role="alert"
      className={[
        'pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-lg transition-all duration-200',
        containerClass,
        exiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0',
      ].join(' ')}
      onMouseEnter={() => clearTimeout(timerRef.current)}
      onMouseLeave={() => {
        if (data.duration && data.duration > 0) {
          timerRef.current = setTimeout(startExit, data.duration);
        }
      }}
    >
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        {data.title && (
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{data.title}</p>
        )}
        <p className="text-sm text-gray-600 dark:text-gray-300">{data.message}</p>
      </div>
      <button
        type="button"
        onClick={() => startExit()}
        aria-label="Dismiss notification"
        className="shrink-0 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export { ToastItem };
