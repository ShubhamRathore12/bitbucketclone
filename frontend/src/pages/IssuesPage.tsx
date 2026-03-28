import React, { useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Circle,
  ArrowUpCircle,
  ChevronLeft,
  ChevronRight,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import type { PaginatedResponse } from '@/types/common';

// ---------------------------------------------------------------------------
// Issue types (local to page until types/issue.ts is created)
// ---------------------------------------------------------------------------

type IssueState = 'new' | 'open' | 'resolved' | 'on hold' | 'invalid' | 'duplicate' | 'wontfix' | 'closed';
type IssuePriority = 'trivial' | 'minor' | 'major' | 'critical' | 'blocker';
type IssueKind = 'bug' | 'enhancement' | 'proposal' | 'task';

interface Issue {
  id: string;
  number: number;
  title: string;
  state: IssueState;
  priority: IssuePriority;
  kind: IssueKind;
  assignee?: { id: string; username: string; displayName: string; avatarUrl: string };
  reporter: { id: string; username: string; displayName: string; avatarUrl: string };
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

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
// IssuesPage
// ---------------------------------------------------------------------------

const stateFilters: { label: string; value: string }[] = [
  { label: 'Open', value: 'open' },
  { label: 'New', value: 'new' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
  { label: 'All', value: 'all' },
];

const priorityColors: Record<IssuePriority, 'red' | 'yellow' | 'blue' | 'gray'> = {
  blocker: 'red',
  critical: 'red',
  major: 'yellow',
  minor: 'blue',
  trivial: 'gray',
};

const stateIcons: Record<string, React.ReactNode> = {
  new: <Circle className="h-4 w-4 text-blue-500" />,
  open: <AlertCircle className="h-4 w-4 text-green-500" />,
  resolved: <CheckCircle2 className="h-4 w-4 text-purple-500" />,
  closed: <CheckCircle2 className="h-4 w-4 text-gray-400" />,
  'on hold': <Circle className="h-4 w-4 text-yellow-500" />,
  invalid: <Circle className="h-4 w-4 text-gray-400" />,
  duplicate: <Circle className="h-4 w-4 text-gray-400" />,
  wontfix: <Circle className="h-4 w-4 text-gray-400" />,
};

export default function IssuesPage() {
  const { workspace, repo } = useParams<{ workspace: string; repo: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const stateFilter = searchParams.get('state') || 'open';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const query = searchParams.get('q') || '';
  const [searchInput, setSearchInput] = useState(query);

  const issuesQuery = useQuery<PaginatedResponse<Issue>>({
    queryKey: ['issues', workspace, repo, stateFilter, page, query],
    queryFn: () => {
      const params = new URLSearchParams();
      if (stateFilter !== 'all') params.set('state', stateFilter);
      params.set('page', String(page));
      params.set('pageSize', '25');
      if (query) params.set('q', query);
      return fetchJson(
        `/api/repositories/${workspace}/${repo}/issues?${params.toString()}`
      );
    },
    enabled: !!workspace && !!repo,
  });

  const handleStateChange = (state: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('state', state);
    params.delete('page');
    setSearchParams(params);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchInput) params.set('q', searchInput);
    else params.delete('q');
    params.delete('page');
    setSearchParams(params);
  };

  const handlePageChange = (p: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(p));
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <form onSubmit={handleSearch} className="flex-1 max-w-md">
          <Input
            placeholder="Search issues..."
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
          onClick={() => navigate(`/${workspace}/${repo}/issues/new`)}
        >
          Create issue
        </Button>
      </div>

      {/* State tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
        {stateFilters.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => handleStateChange(tab.value)}
            className={[
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer',
              stateFilter === tab.value
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Issue list */}
      {issuesQuery.isLoading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-4 flex items-center gap-3">
              <Skeleton className="h-5 w-5 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : issuesQuery.isError ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-10 text-center">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Failed to load issues.</p>
        </div>
      ) : !issuesQuery.data?.data.length ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-10 text-center">
          <AlertCircle className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="text-gray-900 dark:text-white font-medium mb-1">No issues</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {query ? 'No issues match your search.' : 'No issues found with the current filter.'}
          </p>
          {!query && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => navigate(`/${workspace}/${repo}/issues/new`)}
            >
              Create issue
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
          {issuesQuery.data.data.map((issue) => (
            <Link
              key={issue.id}
              to={`/${workspace}/${repo}/issues/${issue.number}`}
              className="block px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0">
                  {stateIcons[issue.state] || <Circle className="h-4 w-4 text-gray-400" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {issue.title}
                    </h3>
                    <Badge color={priorityColors[issue.priority]} size="sm">
                      {issue.priority}
                    </Badge>
                    <Badge color="gray" size="sm">{issue.kind}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    #{issue.number} &middot; opened by {issue.reporter.displayName}{' '}
                    {relativeTime(issue.createdAt)}
                    {issue.commentCount > 0 && (
                      <span className="ml-2">
                        {issue.commentCount} comment{issue.commentCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </p>
                </div>
                {issue.assignee && (
                  <Avatar
                    src={issue.assignee.avatarUrl}
                    name={issue.assignee.displayName}
                    size="xs"
                    className="shrink-0"
                  />
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {issuesQuery.data && issuesQuery.data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={!issuesQuery.data.hasPrevious}
            onClick={() => handlePageChange(page - 1)}
            leftIcon={<ChevronLeft className="h-4 w-4" />}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-500 dark:text-gray-400 px-3">
            Page {issuesQuery.data.page} of {issuesQuery.data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!issuesQuery.data.hasNext}
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
