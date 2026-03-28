import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  LayoutGrid,
  List,
  ArrowUpDown,
  ChevronDown,
  Plus,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { Repository, ListReposParams } from '@/types/repos';
import type { PaginatedResponse } from '@/types/common';
import RepoCard from './RepoCard';

type SortField = 'name' | 'updatedAt' | 'createdAt';
type ViewMode = 'grid' | 'list';

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: 'bg-blue-500',
  JavaScript: 'bg-yellow-400',
  Python: 'bg-green-500',
  Java: 'bg-red-500',
  Go: 'bg-cyan-500',
  Rust: 'bg-orange-600',
  Ruby: 'bg-red-600',
  PHP: 'bg-purple-500',
  'C#': 'bg-green-600',
  'C++': 'bg-pink-500',
  C: 'bg-gray-500',
  Swift: 'bg-orange-500',
  Kotlin: 'bg-violet-500',
  Dart: 'bg-teal-500',
  Shell: 'bg-emerald-600',
};

interface RepoListProps {
  workspaceId: string;
  onRepoClick?: (repo: Repository) => void;
  onCreateRepo?: () => void;
}

async function fetchRepos(params: ListReposParams): Promise<PaginatedResponse<Repository>> {
  const query = new URLSearchParams();
  if (params.workspaceId) query.set('workspaceId', params.workspaceId);
  if (params.query) query.set('query', params.query);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.sort) query.set('sort', params.sort);
  if (params.direction) query.set('direction', params.direction);
  const res = await fetch(`/api/repositories?${query}`);
  if (!res.ok) throw new Error('Failed to fetch repositories');
  return res.json();
}

export default function RepoList({ workspaceId, onRepoClick, onCreateRepo }: RepoListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [page, setPage] = useState(1);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const params: ListReposParams = useMemo(
    () => ({
      workspaceId,
      query: searchQuery || undefined,
      page,
      pageSize: 25,
      sort: sortField,
      direction: sortDir,
    }),
    [workspaceId, searchQuery, page, sortField, sortDir]
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['repositories', params],
    queryFn: () => fetchRepos(params),
    placeholderData: (prev) => prev,
  });

  const sortOptions: { field: SortField; label: string }[] = [
    { field: 'name', label: 'Name' },
    { field: 'updatedAt', label: 'Last updated' },
    { field: 'createdAt', label: 'Date created' },
  ];

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setShowSortMenu(false);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Find a repository..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md bg-white
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder:text-gray-500"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-md
                bg-white hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200"
            >
              <ArrowUpDown className="h-4 w-4" />
              Sort
              <ChevronDown className="h-3 w-3" />
            </button>
            {showSortMenu && (
              <div
                className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20
                  dark:bg-gray-800 dark:border-gray-700"
              >
                {sortOptions.map((opt) => (
                  <button
                    key={opt.field}
                    onClick={() => handleSort(opt.field)}
                    className={[
                      'w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700',
                      sortField === opt.field
                        ? 'font-semibold text-blue-600 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-300',
                    ].join(' ')}
                  >
                    {opt.label}
                    {sortField === opt.field && (
                      <span className="ml-1 text-xs">({sortDir === 'asc' ? 'A-Z' : 'Z-A'})</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* View toggle */}
          <div className="flex border border-gray-300 rounded-md overflow-hidden dark:border-gray-600">
            <button
              onClick={() => setViewMode('list')}
              className={[
                'p-2 transition-colors',
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700',
              ].join(' ')}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={[
                'p-2 transition-colors',
                viewMode === 'grid'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700',
              ].join(' ')}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>

          {/* Create repo */}
          {onCreateRepo && (
            <button
              onClick={onCreateRepo}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white
                bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create repository
            </button>
          )}
        </div>
      </div>

      {/* Click-away for sort menu */}
      {showSortMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span className="ml-2 text-sm text-gray-500">Loading repositories...</span>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md dark:bg-red-900/20 dark:border-red-800">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-700 dark:text-red-400">
            {error instanceof Error ? error.message : 'Failed to load repositories'}
          </p>
        </div>
      )}

      {/* Repository list */}
      {data && !isLoading && (
        <>
          {data.data.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No repositories found.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.data.map((repo) => (
                <RepoCard key={repo.id} repo={repo} onClick={() => onRepoClick?.(repo)} />
              ))}
            </div>
          ) : (
            <div className="border border-gray-200 rounded-md divide-y divide-gray-200 dark:border-gray-700 dark:divide-gray-700">
              {data.data.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => onRepoClick?.(repo)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-blue-600 dark:text-blue-400 truncate">
                        {repo.fullName}
                      </span>
                      <span
                        className={[
                          'px-2 py-0.5 text-xs rounded-full border',
                          repo.visibility === 'private'
                            ? 'border-orange-300 text-orange-700 bg-orange-50 dark:border-orange-600 dark:text-orange-400 dark:bg-orange-900/20'
                            : 'border-green-300 text-green-700 bg-green-50 dark:border-green-600 dark:text-green-400 dark:bg-green-900/20',
                        ].join(' ')}
                      >
                        {repo.visibility}
                      </span>
                    </div>
                    {repo.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                        {repo.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {repo.language && (
                        <span className="inline-flex items-center gap-1">
                          <span
                            className={[
                              'h-2.5 w-2.5 rounded-full',
                              LANGUAGE_COLORS[repo.language] || 'bg-gray-400',
                            ].join(' ')}
                          />
                          {repo.language}
                        </span>
                      )}
                      <span>Updated {new Date(repo.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {(page - 1) * (params.pageSize ?? 25) + 1} to{' '}
                {Math.min(page * (params.pageSize ?? 25), data.totalItems)} of {data.totalItems}
              </p>
              <div className="flex gap-1">
                <button
                  disabled={!data.hasPrevious}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50
                    hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200"
                >
                  Previous
                </button>
                <button
                  disabled={!data.hasNext}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50
                    hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
