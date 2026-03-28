import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  GitCommitHorizontal,
  GitBranch,
  ChevronDown,
  Copy,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import type { Commit, Branch } from '@/types/repo';
import type { PaginatedResponse } from '@/types/common';

// ---------------------------------------------------------------------------
// API helpers
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
// BranchSelector
// ---------------------------------------------------------------------------

function BranchSelector({
  workspace,
  repo,
  currentRef,
  onSelect,
}: {
  workspace: string;
  repo: string;
  currentRef: string;
  onSelect: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const branchesQuery = useQuery<PaginatedResponse<Branch>>({
    queryKey: ['branches', workspace, repo],
    queryFn: () => fetchJson(`/api/repositories/${workspace}/${repo}/branches?pageSize=100`),
    enabled: open,
  });

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        leftIcon={<GitBranch className="h-4 w-4" />}
        rightIcon={<ChevronDown className="h-3 w-3" />}
        onClick={() => setOpen(!open)}
      >
        {currentRef}
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-80 overflow-y-auto">
            {branchesQuery.isLoading ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <ul className="py-1">
                {branchesQuery.data?.data.map((branch) => (
                  <li key={branch.name}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(branch.name);
                        setOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer ${
                        branch.name === currentRef
                          ? 'font-semibold text-blue-600 dark:text-blue-400'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <GitBranch className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{branch.name}</span>
                      {branch.isDefault && (
                        <Badge color="blue" size="sm" className="ml-auto">default</Badge>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RepoCommitsPage
// ---------------------------------------------------------------------------

export default function RepoCommitsPage() {
  const { workspace, repo } = useParams<{ workspace: string; repo: string }>();
  const [branch, setBranch] = useState('main');
  const [page, setPage] = useState(1);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const commitsQuery = useQuery<PaginatedResponse<Commit>>({
    queryKey: ['commits', workspace, repo, branch, page],
    queryFn: () =>
      fetchJson(
        `/api/repositories/${workspace}/${repo}/commits?ref=${encodeURIComponent(branch)}&page=${page}&pageSize=25`
      ),
    enabled: !!workspace && !!repo,
  });

  const handleCopyHash = async (hash: string) => {
    await navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return formatDate(iso);
  }

  // Group commits by date
  const groupedCommits = React.useMemo(() => {
    const commits = commitsQuery.data?.data || [];
    const groups: { date: string; commits: Commit[] }[] = [];
    let currentDate = '';

    for (const commit of commits) {
      const date = formatDate(commit.date);
      if (date !== currentDate) {
        currentDate = date;
        groups.push({ date, commits: [commit] });
      } else {
        groups[groups.length - 1].commits.push(commit);
      }
    }
    return groups;
  }, [commitsQuery.data]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BranchSelector
            workspace={workspace!}
            repo={repo!}
            currentRef={branch}
            onSelect={(b) => {
              setBranch(b);
              setPage(1);
            }}
          />
          {commitsQuery.data && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {commitsQuery.data.totalItems} commits
            </span>
          )}
        </div>
      </div>

      {/* Commits list */}
      {commitsQuery.isLoading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, gi) => (
            <div key={gi}>
              <Skeleton className="h-4 w-32 mb-3" />
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : commitsQuery.isError ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-10 text-center">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Failed to load commits.</p>
        </div>
      ) : groupedCommits.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-10 text-center">
          <GitCommitHorizontal className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No commits on this branch.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedCommits.map((group) => (
            <div key={group.date}>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2">
                <GitCommitHorizontal className="h-4 w-4" />
                {group.date}
              </h3>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                {group.commits.map((commit) => (
                  <div
                    key={commit.hash}
                    className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <Avatar
                      src={commit.author.user?.avatarUrl}
                      name={commit.author.name}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/${workspace}/${repo}/commits/${commit.hash}`}
                        className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate block"
                      >
                        {commit.subject}
                      </Link>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {commit.author.name} &middot; {relativeTime(commit.date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {commit.stats && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">
                          <span className="text-green-600 dark:text-green-400">
                            +{commit.stats.additions}
                          </span>{' '}
                          <span className="text-red-600 dark:text-red-400">
                            -{commit.stats.deletions}
                          </span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopyHash(commit.hash)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs font-mono text-gray-600 dark:text-gray-400 hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer"
                        title="Copy commit hash"
                      >
                        {copiedHash === commit.hash ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        {commit.abbreviatedHash}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {commitsQuery.data && commitsQuery.data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={!commitsQuery.data.hasPrevious}
            onClick={() => setPage((p) => p - 1)}
            leftIcon={<ChevronLeft className="h-4 w-4" />}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-500 dark:text-gray-400 px-3">
            Page {commitsQuery.data.page} of {commitsQuery.data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!commitsQuery.data.hasNext}
            onClick={() => setPage((p) => p + 1)}
            rightIcon={<ChevronRight className="h-4 w-4" />}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
