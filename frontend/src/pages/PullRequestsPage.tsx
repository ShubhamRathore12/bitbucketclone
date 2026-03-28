import React, { useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  GitPullRequest,
  Plus,
  Search,
  Filter,
  AlertCircle,
  MessageSquare,
  CheckCircle2,
  XCircle,
  GitMerge,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import type { PullRequest, PRState } from '@/types/pr';
import type { PaginatedResponse } from '@/types/common';

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`} />;
}

// ---------------------------------------------------------------------------
// State tabs
// ---------------------------------------------------------------------------

const stateTabs: { label: string; value: PRState | 'all'; icon: React.ReactNode }[] = [
  { label: 'Open', value: 'open', icon: <GitPullRequest className="h-4 w-4" /> },
  { label: 'Merged', value: 'merged', icon: <GitMerge className="h-4 w-4" /> },
  { label: 'Declined', value: 'declined', icon: <XCircle className="h-4 w-4" /> },
  { label: 'All', value: 'all', icon: <Filter className="h-4 w-4" /> },
];

const stateColors: Record<PRState, { color: 'blue' | 'green' | 'red' | 'gray'; icon: React.ReactNode }> = {
  open: { color: 'blue', icon: <GitPullRequest className="h-3.5 w-3.5" /> },
  merged: { color: 'green', icon: <GitMerge className="h-3.5 w-3.5" /> },
  declined: { color: 'red', icon: <XCircle className="h-3.5 w-3.5" /> },
  superseded: { color: 'gray', icon: <XCircle className="h-3.5 w-3.5" /> },
};

// ---------------------------------------------------------------------------
// PullRequestsPage
// ---------------------------------------------------------------------------

export default function PullRequestsPage() {
  const { workspace, repo } = useParams<{ workspace: string; repo: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const stateFilter = (searchParams.get('state') as PRState | 'all') || 'open';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const query = searchParams.get('q') || '';

  const [searchInput, setSearchInput] = useState(query);

  const prsQuery = useQuery<PaginatedResponse<PullRequest>>({
    queryKey: ['prs', workspace, repo, stateFilter, page, query],
    queryFn: () => {
      const params = new URLSearchParams();
      if (stateFilter !== 'all') params.set('state', stateFilter);
      params.set('page', String(page));
      params.set('pageSize', '20');
      if (query) params.set('q', query);
      return fetchJson(
        `/api/repositories/${workspace}/${repo}/pull-requests?${params.toString()}`
      );
    },
    enabled: !!workspace && !!repo,
  });

  const handleStateChange = (state: PRState | 'all') => {
    const params = new URLSearchParams(searchParams);
    params.set('state', state);
    params.delete('page');
    setSearchParams(params);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchInput) {
      params.set('q', searchInput);
    } else {
      params.delete('q');
    }
    params.delete('page');
    setSearchParams(params);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(newPage));
    setSearchParams(params);
  };

  function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <form onSubmit={handleSearch} className="flex-1 max-w-md">
          <Input
            placeholder="Search pull requests..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            prefixIcon={<Search className="h-4 w-4" />}
            inputSize="sm"
          />
        </form>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => navigate(`/${workspace}/${repo}/pull-requests/create`)}
        >
          Create pull request
        </Button>
      </div>

      {/* State tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
        {stateTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => handleStateChange(tab.value)}
            className={[
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer',
              stateFilter === tab.value
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600',
            ].join(' ')}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* PR list */}
      {prsQuery.isLoading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-4 flex items-start gap-3">
              <Skeleton className="h-5 w-5 mt-0.5 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-6 rounded-full shrink-0" />
            </div>
          ))}
        </div>
      ) : prsQuery.isError ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-10 text-center">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Failed to load pull requests.</p>
        </div>
      ) : !prsQuery.data?.data.length ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-10 text-center">
          <GitPullRequest className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="text-gray-900 dark:text-white font-medium mb-1">No pull requests</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {query
              ? 'No pull requests match your search.'
              : stateFilter === 'open'
                ? 'There are no open pull requests.'
                : `No ${stateFilter} pull requests found.`}
          </p>
          {stateFilter === 'open' && !query && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => navigate(`/${workspace}/${repo}/pull-requests/create`)}
            >
              Create pull request
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
          {prsQuery.data.data.map((pr) => {
            const sc = stateColors[pr.state];
            return (
              <Link
                key={pr.id}
                to={`/${workspace}/${repo}/pull-requests/${pr.number}`}
                className="block px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 shrink-0 text-${sc.color}-500`}>{sc.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        {pr.title}
                      </h3>
                      {pr.isDraft && <Badge color="gray" size="sm">Draft</Badge>}
                      {pr.hasConflicts && (
                        <Badge color="red" size="sm">Conflicts</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      #{pr.number} &middot; {pr.sourceBranch} &rarr; {pr.destinationBranch} &middot;
                      opened by {pr.author.displayName} {relativeTime(pr.createdAt)}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      {/* Reviewers */}
                      {pr.reviewers.length > 0 && (
                        <div className="flex items-center -space-x-1.5">
                          {pr.reviewers.slice(0, 4).map((r) => (
                            <Avatar
                              key={r.user.id}
                              src={r.user.avatarUrl}
                              name={r.user.displayName}
                              size="xs"
                              className={
                                r.status === 'approved'
                                  ? 'ring-2 ring-green-400'
                                  : r.status === 'changes_requested'
                                    ? 'ring-2 ring-red-400'
                                    : 'ring-2 ring-white dark:ring-gray-800'
                              }
                            />
                          ))}
                          {pr.reviewers.length > 4 && (
                            <span className="text-xs text-gray-400 pl-2">
                              +{pr.reviewers.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                      {/* Stats */}
                      {pr.commentCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <MessageSquare className="h-3 w-3" />
                          {pr.commentCount}
                        </span>
                      )}
                      {pr.taskCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <CheckCircle2 className="h-3 w-3" />
                          {pr.resolvedTaskCount}/{pr.taskCount}
                        </span>
                      )}
                      {/* Diff stats */}
                      <span className="text-xs text-gray-400">
                        <span className="text-green-600 dark:text-green-400">
                          +{pr.diffStats.additions}
                        </span>{' '}
                        <span className="text-red-600 dark:text-red-400">
                          -{pr.diffStats.deletions}
                        </span>
                      </span>
                    </div>
                  </div>
                  <Avatar
                    src={pr.author.avatarUrl}
                    name={pr.author.displayName}
                    size="sm"
                    className="shrink-0"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {prsQuery.data && prsQuery.data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={!prsQuery.data.hasPrevious}
            onClick={() => handlePageChange(page - 1)}
            leftIcon={<ChevronLeft className="h-4 w-4" />}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-500 dark:text-gray-400 px-3">
            Page {prsQuery.data.page} of {prsQuery.data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!prsQuery.data.hasNext}
            onClick={() => handlePageChange(page + 1)}
            rightIcon={<ChevronRight className="h-4 w-4" />}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
