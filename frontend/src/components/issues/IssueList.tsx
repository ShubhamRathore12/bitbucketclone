import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  CircleDot,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ArrowUpCircle,
  Circle,
  ChevronDown,
  Loader2,
  AlertCircle,
  Tag,
  Plus,
  MessageSquare,
} from 'lucide-react';
import type { Issue, IssueState, IssuePriority, IssueKind, Label } from '@/types/issues';
import type { PaginatedResponse } from '@/types/common';

interface IssueListProps {
  repoFullName: string;
  onIssueClick?: (issue: Issue) => void;
  onCreateIssue?: () => void;
}

async function fetchIssues(
  repoFullName: string,
  params: Record<string, string>
): Promise<PaginatedResponse<Issue>> {
  const query = new URLSearchParams(params);
  const res = await fetch(`/api/repositories/${repoFullName}/issues?${query}`);
  if (!res.ok) throw new Error('Failed to fetch issues');
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

const priorityIcons: Record<IssuePriority, { icon: React.ReactNode; color: string }> = {
  blocker: { icon: <AlertOctagon className="h-3.5 w-3.5" />, color: 'text-red-600' },
  critical: { icon: <AlertTriangle className="h-3.5 w-3.5" />, color: 'text-red-500' },
  major: { icon: <ArrowUpCircle className="h-3.5 w-3.5" />, color: 'text-orange-500' },
  minor: { icon: <Circle className="h-3.5 w-3.5" />, color: 'text-yellow-500' },
  trivial: { icon: <Circle className="h-3.5 w-3.5" />, color: 'text-gray-400' },
};

const openStates: IssueState[] = ['new', 'open', 'on_hold'];
const closedStates: IssueState[] = ['resolved', 'closed', 'duplicate', 'invalid', 'wontfix'];

export default function IssueList({ repoFullName, onIssueClick, onCreateIssue }: IssueListProps) {
  const [stateFilter, setStateFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<IssuePriority | ''>('');
  const [kindFilter, setKindFilter] = useState<IssueKind | ''>('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const queryParams = useMemo(() => {
    const p: Record<string, string> = { page: String(page), pageSize: '25' };
    if (searchQuery) p.query = searchQuery;
    if (stateFilter === 'open') p.state = openStates.join(',');
    if (stateFilter === 'closed') p.state = closedStates.join(',');
    if (priorityFilter) p.priority = priorityFilter;
    if (kindFilter) p.kind = kindFilter;
    return p;
  }, [page, searchQuery, stateFilter, priorityFilter, kindFilter]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['issues', repoFullName, queryParams],
    queryFn: () => fetchIssues(repoFullName, queryParams),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* State toggle */}
        <div className="flex border border-gray-200 rounded-md overflow-hidden dark:border-gray-700">
          {(['open', 'closed', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStateFilter(s); setPage(1); }}
              className={[
                'px-3 py-1.5 text-sm font-medium capitalize transition-colors',
                stateFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
              ].join(' ')}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search issues..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md bg-white
              focus:outline-none focus:ring-2 focus:ring-blue-500
              dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
          />
        </div>

        {/* Filters toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-md
            bg-white hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200"
        >
          Filters <ChevronDown className="h-3 w-3" />
        </button>

        {onCreateIssue && (
          <button
            onClick={onCreateIssue}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white
              bg-blue-600 hover:bg-blue-700 rounded-md transition-colors ml-auto"
          >
            <Plus className="h-4 w-4" />
            Create issue
          </button>
        )}
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 p-3 border border-gray-200 rounded-md bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
          <select
            value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value as IssuePriority | ''); setPage(1); }}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
          >
            <option value="">All priorities</option>
            {(['blocker', 'critical', 'major', 'minor', 'trivial'] as IssuePriority[]).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select
            value={kindFilter}
            onChange={(e) => { setKindFilter(e.target.value as IssueKind | ''); setPage(1); }}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
          >
            <option value="">All kinds</option>
            {(['bug', 'enhancement', 'proposal', 'task'] as IssueKind[]).map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
      )}

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
            {error instanceof Error ? error.message : 'Failed to load issues'}
          </p>
        </div>
      )}

      {/* Issue list */}
      {data && !isLoading && (
        <>
          {data.data.length === 0 ? (
            <div className="text-center py-12">
              <CircleDot className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No issues found.</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-md divide-y divide-gray-200 dark:border-gray-700 dark:divide-gray-700">
              {data.data.map((issue) => {
                const isOpen = openStates.includes(issue.state);
                const priority = priorityIcons[issue.priority];
                return (
                  <button
                    key={issue.id}
                    onClick={() => onIssueClick?.(issue)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex items-start gap-3"
                  >
                    {isOpen ? (
                      <CircleDot className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{issue.title}</span>
                        {issue.labels.map((label: Label) => (
                          <span
                            key={label.id}
                            className="px-2 py-0.5 text-xs rounded-full border"
                            style={{
                              backgroundColor: `${label.color}20`,
                              borderColor: label.color,
                              color: label.color,
                            }}
                          >
                            {label.name}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <span>#{issue.number}</span>
                        <span className={priority.color + ' inline-flex items-center gap-0.5'}>
                          {priority.icon}
                          {issue.priority}
                        </span>
                        <span className="capitalize">{issue.kind}</span>
                        <span>opened {relativeTime(issue.createdAt)} by {issue.reporter.displayName}</span>
                        {issue.assignee && (
                          <span className="inline-flex items-center gap-1">
                            <img src={issue.assignee.avatarUrl} alt="" className="h-3.5 w-3.5 rounded-full" />
                            {issue.assignee.displayName}
                          </span>
                        )}
                      </div>
                    </div>
                    {issue.commentCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 shrink-0">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {issue.commentCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                disabled={!data.hasPrevious}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50
                  hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">Page {page} of {data.totalPages}</span>
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
