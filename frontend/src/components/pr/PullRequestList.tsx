import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  GitPullRequest,
  GitMerge,
  XCircle,
  MessageSquare,
  CheckCircle2,
  Clock,
  ChevronDown,
  Loader2,
  AlertCircle,
  GitBranch,
  ArrowRight,
} from 'lucide-react';
import type { PullRequest, PRState, ListPRsParams } from '@/types/pr';
import type { PaginatedResponse } from '@/types/common';

interface PullRequestListProps {
  repoFullName: string;
  onPRClick?: (pr: PullRequest) => void;
}

async function fetchPRs(
  repoFullName: string,
  params: ListPRsParams
): Promise<PaginatedResponse<PullRequest>> {
  const query = new URLSearchParams();
  if (params.state && params.state !== 'all') query.set('state', params.state);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.sort) query.set('sort', params.sort);
  if (params.direction) query.set('direction', params.direction);
  const res = await fetch(`/api/repositories/${repoFullName}/pull-requests?${query}`);
  if (!res.ok) throw new Error('Failed to fetch pull requests');
  return res.json();
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const stateConfig: Record<PRState, { icon: React.ReactNode; color: string; label: string }> = {
  open: {
    icon: <GitPullRequest className="h-4 w-4" />,
    color: 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800',
    label: 'Open',
  },
  merged: {
    icon: <GitMerge className="h-4 w-4" />,
    color: 'text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-900/20 dark:border-purple-800',
    label: 'Merged',
  },
  declined: {
    icon: <XCircle className="h-4 w-4" />,
    color: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800',
    label: 'Declined',
  },
  superseded: {
    icon: <XCircle className="h-4 w-4" />,
    color: 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:border-gray-700',
    label: 'Superseded',
  },
};

type FilterState = PRState | 'all';

export default function PullRequestList({ repoFullName, onPRClick }: PullRequestListProps) {
  const [filterState, setFilterState] = useState<FilterState>('open');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState('updatedAt');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const params: ListPRsParams = useMemo(
    () => ({
      state: filterState === 'all' ? 'all' : filterState,
      page,
      pageSize: 25,
      sort: sortField,
      direction: 'desc',
    }),
    [filterState, page, sortField]
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['pull-requests', repoFullName, params],
    queryFn: () => fetchPRs(repoFullName, params),
    placeholderData: (prev) => prev,
  });

  const filteredPRs = useMemo(() => {
    if (!data || !searchQuery) return data?.data ?? [];
    const q = searchQuery.toLowerCase();
    return data.data.filter(
      (pr) =>
        pr.title.toLowerCase().includes(q) ||
        String(pr.number).includes(q) ||
        pr.author.displayName.toLowerCase().includes(q)
    );
  }, [data, searchQuery]);

  const stateFilters: { key: FilterState; label: string }[] = [
    { key: 'open', label: 'Open' },
    { key: 'merged', label: 'Merged' },
    { key: 'declined', label: 'Declined' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* State filters */}
        <div className="flex border border-gray-200 rounded-md overflow-hidden dark:border-gray-700">
          {stateFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => { setFilterState(f.key); setPage(1); }}
              className={[
                'px-3 py-1.5 text-sm font-medium transition-colors',
                filterState === f.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search pull requests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md bg-white
              focus:outline-none focus:ring-2 focus:ring-blue-500
              dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
          />
        </div>

        {/* Sort */}
        <div className="relative ml-auto">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-md
              bg-white hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200"
          >
            Sort <ChevronDown className="h-3 w-3" />
          </button>
          {showSortMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
              <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-md shadow-lg z-20 dark:bg-gray-800 dark:border-gray-700">
                {[
                  { field: 'updatedAt', label: 'Last updated' },
                  { field: 'createdAt', label: 'Newest' },
                  { field: 'commentCount', label: 'Most discussed' },
                ].map((opt) => (
                  <button
                    key={opt.field}
                    onClick={() => { setSortField(opt.field); setShowSortMenu(false); }}
                    className={[
                      'w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700',
                      sortField === opt.field ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300',
                    ].join(' ')}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md dark:bg-red-900/20 dark:border-red-800">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-700 dark:text-red-400">
            {error instanceof Error ? error.message : 'Failed to load pull requests'}
          </p>
        </div>
      )}

      {/* PR list */}
      {!isLoading && !isError && (
        <>
          {filteredPRs.length === 0 ? (
            <div className="text-center py-12">
              <GitPullRequest className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No pull requests found.</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-md divide-y divide-gray-200 dark:border-gray-700 dark:divide-gray-700">
              {filteredPRs.map((pr) => {
                const stateInfo = stateConfig[pr.state];
                const approvedCount = pr.reviewers.filter((r) => r.status === 'approved').length;
                return (
                  <button
                    key={pr.id}
                    onClick={() => onPRClick?.(pr)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex items-start gap-3"
                  >
                    {/* State icon */}
                    <span className={stateInfo.color.split(' ')[0]}>{stateInfo.icon}</span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {pr.title}
                        </span>
                        <span className={[
                          'px-2 py-0.5 text-xs rounded-full border',
                          stateInfo.color,
                        ].join(' ')}>
                          {stateInfo.label}
                        </span>
                      </div>

                      {/* Meta line */}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                        <span>#{pr.number}</span>
                        <span className="inline-flex items-center gap-1">
                          <img src={pr.author.avatarUrl} alt="" className="h-4 w-4 rounded-full" />
                          {pr.author.displayName}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <GitBranch className="h-3 w-3" />
                          <code className="text-xs">{pr.sourceBranch}</code>
                          <ArrowRight className="h-3 w-3" />
                          <code className="text-xs">{pr.destinationBranch}</code>
                        </span>
                      </div>
                    </div>

                    {/* Right side stats */}
                    <div className="flex items-center gap-3 shrink-0 text-xs text-gray-500 dark:text-gray-400">
                      {approvedCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {approvedCount}
                        </span>
                      )}
                      {pr.commentCount > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {pr.commentCount}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {relativeTime(pr.updatedAt)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                disabled={!data.hasPrevious}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50
                  hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {page} of {data.totalPages}
              </span>
              <button
                disabled={!data.hasNext}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50
                  hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
