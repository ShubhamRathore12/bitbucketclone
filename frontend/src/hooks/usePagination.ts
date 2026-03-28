import { useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { DEFAULT_PAGE_SIZE } from "@/utils/constants";

interface UsePaginationOptions {
  /** Default page size. Defaults to DEFAULT_PAGE_SIZE (25). */
  defaultPageSize?: number;
  /** Whether to sync page/pageSize with URL search params. Defaults to true. */
  syncWithUrl?: boolean;
}

interface UsePaginationReturn {
  page: number;
  pageSize: number;
  offset: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  goToFirst: () => void;
  goToLast: (totalPages: number) => void;
  /** Derive pagination metadata from a total item count. */
  getPageInfo: (totalItems: number) => {
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
    startItem: number;
    endItem: number;
  };
  /** Generate page numbers array for a pagination component. */
  getPageNumbers: (totalPages: number, maxVisible?: number) => (number | "ellipsis")[];
}

/**
 * Pagination hook that can optionally sync with URL search params.
 */
export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
  const { defaultPageSize = DEFAULT_PAGE_SIZE, syncWithUrl = true } = options;

  const [searchParams, setSearchParams] = useSearchParams();

  // Internal state (used when syncWithUrl is false)
  const [localPage, setLocalPage] = useState(1);
  const [localPageSize, setLocalPageSize] = useState(defaultPageSize);

  const page = syncWithUrl
    ? Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
    : localPage;

  const pageSize = syncWithUrl
    ? Math.max(1, parseInt(searchParams.get("pageSize") ?? String(defaultPageSize), 10) || defaultPageSize)
    : localPageSize;

  const offset = (page - 1) * pageSize;

  const setPage = useCallback(
    (newPage: number) => {
      const p = Math.max(1, newPage);
      if (syncWithUrl) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set("page", String(p));
          return next;
        });
      } else {
        setLocalPage(p);
      }
    },
    [syncWithUrl, setSearchParams],
  );

  const setPageSize = useCallback(
    (size: number) => {
      const s = Math.max(1, size);
      if (syncWithUrl) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set("pageSize", String(s));
          next.set("page", "1"); // Reset to first page
          return next;
        });
      } else {
        setLocalPageSize(s);
        setLocalPage(1);
      }
    },
    [syncWithUrl, setSearchParams],
  );

  const nextPage = useCallback(() => setPage(page + 1), [page, setPage]);
  const prevPage = useCallback(() => setPage(page - 1), [page, setPage]);
  const goToFirst = useCallback(() => setPage(1), [setPage]);
  const goToLast = useCallback((totalPages: number) => setPage(totalPages), [setPage]);

  const getPageInfo = useCallback(
    (totalItems: number) => {
      const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      const startItem = totalItems === 0 ? 0 : offset + 1;
      const endItem = Math.min(offset + pageSize, totalItems);
      return {
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
        startItem,
        endItem,
      };
    },
    [page, pageSize, offset],
  );

  const getPageNumbers = useMemo(
    () =>
      (totalPages: number, maxVisible = 7): (number | "ellipsis")[] => {
        if (totalPages <= maxVisible) {
          return Array.from({ length: totalPages }, (_, i) => i + 1);
        }

        const pages: (number | "ellipsis")[] = [];
        const sideCount = Math.floor((maxVisible - 3) / 2); // pages on each side of current

        // Always include first page
        pages.push(1);

        const startPage = Math.max(2, page - sideCount);
        const endPage = Math.min(totalPages - 1, page + sideCount);

        if (startPage > 2) {
          pages.push("ellipsis");
        }

        for (let i = startPage; i <= endPage; i++) {
          pages.push(i);
        }

        if (endPage < totalPages - 1) {
          pages.push("ellipsis");
        }

        // Always include last page
        pages.push(totalPages);

        return pages;
      },
    [page],
  );

  return {
    page,
    pageSize,
    offset,
    setPage,
    setPageSize,
    nextPage,
    prevPage,
    goToFirst,
    goToLast,
    getPageInfo,
    getPageNumbers,
  };
}
