import React, { useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  /** Current page (1-based). */
  page: number;
  /** Total number of items. */
  totalItems: number;
  /** Items per page. */
  pageSize: number;
  /** Called when the page changes. */
  onPageChange: (page: number) => void;
  /** Called when page size changes. */
  onPageSizeChange?: (size: number) => void;
  /** Available page sizes. */
  pageSizeOptions?: number[];
  /** Maximum number of page buttons visible at once (excluding prev/next). */
  siblingCount?: number;
  className?: string;
}

/**
 * Build a range of page numbers to show with ellipsis indicators.
 */
function buildPageRange(current: number, total: number, siblings: number): (number | 'ellipsis')[] {
  // Total page buttons we aim to show: first + last + current + 2*siblings + 2 ellipsis
  const totalPageNumbers = siblings * 2 + 5;

  if (totalPageNumbers >= total) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(current - siblings, 1);
  const rightSibling = Math.min(current + siblings, total);

  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < total - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftRange = Array.from({ length: 3 + 2 * siblings }, (_, i) => i + 1);
    return [...leftRange, 'ellipsis', total];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightRange = Array.from({ length: 3 + 2 * siblings }, (_, i) => total - (3 + 2 * siblings) + 1 + i);
    return [1, 'ellipsis', ...rightRange];
  }

  const middleRange = Array.from({ length: rightSibling - leftSibling + 1 }, (_, i) => leftSibling + i);
  return [1, 'ellipsis', ...middleRange, 'ellipsis', total];
}

function Pagination({
  page,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  siblingCount = 1,
  className = '',
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const pages = useMemo(
    () => buildPageRange(currentPage, totalPages, siblingCount),
    [currentPage, totalPages, siblingCount]
  );

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const goTo = useCallback(
    (p: number) => {
      if (p >= 1 && p <= totalPages && p !== currentPage) onPageChange(p);
    },
    [totalPages, currentPage, onPageChange]
  );

  const pageButtonBase =
    'inline-flex items-center justify-center h-8 min-w-[2rem] px-2 text-sm rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';

  return (
    <div
      className={[
        'flex flex-wrap items-center justify-between gap-4 text-sm',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Showing X-Y of Z */}
      <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap">
        Showing <span className="font-medium text-gray-900 dark:text-gray-100">{startItem}</span>
        {' - '}
        <span className="font-medium text-gray-900 dark:text-gray-100">{endItem}</span>
        {' of '}
        <span className="font-medium text-gray-900 dark:text-gray-100">{totalItems}</span>
      </span>

      {/* Page buttons */}
      <nav aria-label="Pagination" className="flex items-center gap-1">
        {/* Previous */}
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => goTo(currentPage - 1)}
          aria-label="Previous page"
          className={[
            pageButtonBase,
            currentPage <= 1
              ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer',
          ].join(' ')}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pages.map((p, idx) =>
          p === 'ellipsis' ? (
            <span
              key={`ellipsis-${idx}`}
              className="inline-flex items-center justify-center h-8 min-w-[2rem] text-gray-400 dark:text-gray-500 select-none"
            >
              ...
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => goTo(p)}
              aria-current={p === currentPage ? 'page' : undefined}
              className={[
                pageButtonBase,
                'cursor-pointer',
                p === currentPage
                  ? 'bg-blue-600 text-white dark:bg-blue-500 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700',
              ].join(' ')}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => goTo(currentPage + 1)}
          aria-label="Next page"
          className={[
            pageButtonBase,
            currentPage >= totalPages
              ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer',
          ].join(' ')}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>

      {/* Page size selector */}
      {onPageSizeChange && (
        <div className="flex items-center gap-2">
          <label htmlFor="page-size-select" className="text-gray-600 dark:text-gray-400 whitespace-nowrap">
            Per page:
          </label>
          <select
            id="page-size-select"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 px-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

export { Pagination };
export default Pagination;
