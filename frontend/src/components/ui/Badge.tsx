import React, { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';

export type BadgeColor = 'blue' | 'green' | 'red' | 'yellow' | 'gray' | 'purple';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: BadgeColor;
  size?: BadgeSize;
  dot?: boolean;
  removable?: boolean;
  onRemove?: () => void;
  children: ReactNode;
}

const colorClasses: Record<BadgeColor, string> = {
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  green: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  gray: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
};

const dotColorClasses: Record<BadgeColor, string> = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  red: 'bg-red-500',
  yellow: 'bg-yellow-500',
  gray: 'bg-gray-500',
  purple: 'bg-purple-500',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

const removeButtonSizeClasses: Record<BadgeSize, string> = {
  sm: 'h-3 w-3',
  md: 'h-3.5 w-3.5',
};

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      color = 'gray',
      size = 'sm',
      dot = false,
      removable = false,
      onRemove,
      children,
      className = '',
      ...rest
    },
    ref
  ) => {
    return (
      <span
        ref={ref}
        className={[
          'inline-flex items-center gap-1.5 font-medium rounded-full whitespace-nowrap',
          colorClasses[color],
          sizeClasses[size],
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      >
        {dot && (
          <span
            className={['h-1.5 w-1.5 rounded-full shrink-0', dotColorClasses[color]].join(' ')}
            aria-hidden="true"
          />
        )}
        {children}
        {removable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.();
            }}
            aria-label="Remove"
            className="inline-flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer ml-0.5 -mr-0.5"
          >
            <X className={removeButtonSizeClasses[size]} />
          </button>
        )}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
export default Badge;
