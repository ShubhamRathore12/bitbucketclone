import React from 'react';

/* ------------------------------------------------------------------ */
/* Base shimmer                                                       */
/* ------------------------------------------------------------------ */

interface SkeletonBaseProps {
  className?: string;
}

function SkeletonBase({ className = '' }: SkeletonBaseProps) {
  return (
    <div
      aria-hidden="true"
      className={[
        'animate-pulse rounded bg-gray-200 dark:bg-gray-700',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}

/* ------------------------------------------------------------------ */
/* SkeletonText                                                       */
/* ------------------------------------------------------------------ */

export interface SkeletonTextProps {
  lines?: number;
  /** Width of the last line (e.g. "60%"). All other lines are 100%. */
  lastLineWidth?: string;
  className?: string;
}

function SkeletonText({ lines = 3, lastLineWidth = '60%', className = '' }: SkeletonTextProps) {
  return (
    <div className={['flex flex-col gap-2', className].filter(Boolean).join(' ')} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBase
          key={i}
          className="h-4"
          {...(i === lines - 1 && lastLineWidth ? { className: `h-4 w-[${lastLineWidth}]` } : {})}
        />
      ))}
    </div>
  );
}

// Use inline style for dynamic last-line width to ensure Tailwind JIT works
function SkeletonTextFixed({ lines = 3, lastLineWidth = '60%', className = '' }: SkeletonTextProps) {
  return (
    <div className={['flex flex-col gap-2', className].filter(Boolean).join(' ')} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => {
        const isLast = i === lines - 1;
        return (
          <div
            key={i}
            className="animate-pulse rounded bg-gray-200 dark:bg-gray-700 h-4"
            style={isLast ? { width: lastLineWidth } : undefined}
          />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SkeletonAvatar                                                     */
/* ------------------------------------------------------------------ */

export type SkeletonAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const avatarSizeClasses: Record<SkeletonAvatarSize, string> = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
};

export interface SkeletonAvatarProps {
  size?: SkeletonAvatarSize;
  shape?: 'circle' | 'square';
  className?: string;
}

function SkeletonAvatar({ size = 'md', shape = 'circle', className = '' }: SkeletonAvatarProps) {
  return (
    <div
      aria-hidden="true"
      className={[
        'animate-pulse bg-gray-200 dark:bg-gray-700',
        shape === 'circle' ? 'rounded-full' : 'rounded-md',
        avatarSizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}

/* ------------------------------------------------------------------ */
/* SkeletonButton                                                     */
/* ------------------------------------------------------------------ */

export type SkeletonButtonSize = 'sm' | 'md' | 'lg';

const buttonSizeClasses: Record<SkeletonButtonSize, string> = {
  sm: 'h-8 w-20',
  md: 'h-10 w-24',
  lg: 'h-12 w-28',
};

export interface SkeletonButtonProps {
  size?: SkeletonButtonSize;
  fullWidth?: boolean;
  className?: string;
}

function SkeletonButton({ size = 'md', fullWidth = false, className = '' }: SkeletonButtonProps) {
  return (
    <div
      aria-hidden="true"
      className={[
        'animate-pulse rounded-md bg-gray-200 dark:bg-gray-700',
        buttonSizeClasses[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}

/* ------------------------------------------------------------------ */
/* SkeletonCard                                                       */
/* ------------------------------------------------------------------ */

export interface SkeletonCardProps {
  /** Show an image placeholder at the top */
  hasImage?: boolean;
  /** Number of text lines in the body */
  lines?: number;
  className?: string;
}

function SkeletonCard({ hasImage = false, lines = 3, className = '' }: SkeletonCardProps) {
  return (
    <div
      aria-hidden="true"
      className={[
        'rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {hasImage && (
        <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-40 w-full" />
      )}
      <div className="p-4 space-y-3">
        {/* Title */}
        <div className="animate-pulse rounded bg-gray-200 dark:bg-gray-700 h-5 w-3/4" />
        {/* Body text lines */}
        <SkeletonTextFixed lines={lines} />
        {/* Footer row */}
        <div className="flex items-center gap-3 pt-2">
          <SkeletonAvatar size="sm" />
          <div className="animate-pulse rounded bg-gray-200 dark:bg-gray-700 h-4 w-24" />
        </div>
      </div>
    </div>
  );
}

const SkeletonText = SkeletonTextFixed;

export { SkeletonBase, SkeletonText, SkeletonAvatar, SkeletonButton, SkeletonCard };
export default SkeletonBase;
