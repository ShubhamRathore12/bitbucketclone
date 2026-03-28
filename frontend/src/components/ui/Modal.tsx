import React, {
  forwardRef,
  useEffect,
  useCallback,
  useRef,
  useState,
  type ReactNode,
  type HTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  closeOnOverlay?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

const Modal = forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      open,
      onClose,
      title,
      footer,
      size = 'md',
      closeOnOverlay = true,
      closeOnEscape = true,
      showCloseButton = true,
      children,
      className = '',
      ...rest
    },
    ref
  ) => {
    const [visible, setVisible] = useState(false);
    const [animate, setAnimate] = useState(false);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Handle open/close with animation
    useEffect(() => {
      if (open) {
        setVisible(true);
        // Trigger entrance animation on next frame
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setAnimate(true));
        });
      } else {
        setAnimate(false);
        const timer = setTimeout(() => setVisible(false), 200);
        return () => clearTimeout(timer);
      }
    }, [open]);

    // Escape key
    const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
        if (closeOnEscape && e.key === 'Escape') {
          onClose();
        }
      },
      [closeOnEscape, onClose]
    );

    useEffect(() => {
      if (visible) {
        document.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';
        return () => {
          document.removeEventListener('keydown', handleKeyDown);
          document.body.style.overflow = '';
        };
      }
    }, [visible, handleKeyDown]);

    const handleOverlayClick = (e: React.MouseEvent) => {
      if (closeOnOverlay && e.target === overlayRef.current) {
        onClose();
      }
    };

    if (!visible) return null;

    return createPortal(
      <div
        ref={overlayRef}
        role="presentation"
        onClick={handleOverlayClick}
        className={[
          'fixed inset-0 z-50 flex items-center justify-center p-4',
          'transition-colors duration-200',
          animate ? 'bg-black/50' : 'bg-black/0',
        ].join(' ')}
      >
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === 'string' ? title : undefined}
          className={[
            'w-full rounded-lg bg-white shadow-xl dark:bg-gray-800',
            'transition-all duration-200',
            animate ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2',
            sizeClasses[size],
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...rest}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              {title && (
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {title}
                </h2>
              )}
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="ml-auto p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          )}

          {/* Body */}
          <div className="px-6 py-4 overflow-y-auto max-h-[70vh] text-gray-700 dark:text-gray-300">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
              {footer}
            </div>
          )}
        </div>
      </div>,
      document.body
    );
  }
);

Modal.displayName = 'Modal';

export { Modal };
export default Modal;
