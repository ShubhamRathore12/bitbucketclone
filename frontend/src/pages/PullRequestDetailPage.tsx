import React, { useState } from 'react';
import { useParams, NavLink, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GitPullRequest,
  GitMerge,
  XCircle,
  MessageSquare,
  FileCode2,
  GitCommitHorizontal,
  Activity,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Bot,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import type {
  PullRequest,
  PRComment,
  PRActivity,
  DiffFile,
  PRState,
  PRMergeStrategy,
} from '@/types/pr';
import type { Commit } from '@/types/repo';
import type { PaginatedResponse, ApiError } from '@/types/common';

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

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('access_token')}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err: ApiError = await res.json();
    throw err;
  }
  return res.json();
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`} />;
}

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
// Sub-tabs
// ---------------------------------------------------------------------------

type TabValue = 'overview' | 'diff' | 'commits' | 'activity';

// ---------------------------------------------------------------------------
// PullRequestDetailPage
// ---------------------------------------------------------------------------

export default function PullRequestDetailPage() {
  const { workspace, repo, prId } = useParams<{
    workspace: string;
    repo: string;
    prId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabValue>('overview');
  const [commentText, setCommentText] = useState('');
  const [showMerge, setShowMerge] = useState(false);
  const [mergeStrategy, setMergeStrategy] = useState<PRMergeStrategy>('merge');
  const [closeSourceBranch, setCloseSourceBranch] = useState(true);

  const basePath = `/api/repositories/${workspace}/${repo}/pull-requests/${prId}`;

  // PR details
  const prQuery = useQuery<PullRequest>({
    queryKey: ['pr', workspace, repo, prId],
    queryFn: () => fetchJson(basePath),
    enabled: !!workspace && !!repo && !!prId,
  });

  // Diff
  const diffQuery = useQuery<DiffFile[]>({
    queryKey: ['pr-diff', workspace, repo, prId],
    queryFn: () => fetchJson(`${basePath}/diff`),
    enabled: activeTab === 'diff' || activeTab === 'overview',
  });

  // Commits
  const commitsQuery = useQuery<PaginatedResponse<Commit>>({
    queryKey: ['pr-commits', workspace, repo, prId],
    queryFn: () => fetchJson(`${basePath}/commits`),
    enabled: activeTab === 'commits',
  });

  // Activity
  const activityQuery = useQuery<PRActivity[]>({
    queryKey: ['pr-activity', workspace, repo, prId],
    queryFn: () => fetchJson(`${basePath}/activity`),
    enabled: activeTab === 'activity',
  });

  // Comments
  const commentsQuery = useQuery<PRComment[]>({
    queryKey: ['pr-comments', workspace, repo, prId],
    queryFn: () => fetchJson(`${basePath}/comments`),
    enabled: activeTab === 'overview',
  });

  // Approve
  const approveMutation = useMutation({
    mutationFn: () => postJson(`${basePath}/approve`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pr', workspace, repo, prId] }),
  });

  // Merge
  const mergeMutation = useMutation({
    mutationFn: () =>
      postJson(`${basePath}/merge`, {
        strategy: mergeStrategy,
        closeSourceBranch,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pr', workspace, repo, prId] });
      setShowMerge(false);
    },
  });

  // Decline
  const declineMutation = useMutation({
    mutationFn: () => postJson(`${basePath}/decline`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pr', workspace, repo, prId] }),
  });

  // Add comment
  const commentMutation = useMutation({
    mutationFn: (content: string) => postJson(`${basePath}/comments`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pr-comments', workspace, repo, prId] });
      setCommentText('');
    },
  });

  const pr = prQuery.data;

  const stateConfig: Record<PRState, { color: string; icon: React.ReactNode; label: string }> = {
    open: { color: 'text-blue-600', icon: <GitPullRequest className="h-5 w-5" />, label: 'Open' },
    merged: { color: 'text-purple-600', icon: <GitMerge className="h-5 w-5" />, label: 'Merged' },
    declined: { color: 'text-red-600', icon: <XCircle className="h-5 w-5" />, label: 'Declined' },
    superseded: { color: 'text-gray-600', icon: <XCircle className="h-5 w-5" />, label: 'Superseded' },
  };

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  if (prQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <Skeleton className="h-6 w-6 shrink-0" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (prQuery.isError || !pr) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Pull request not found
        </h2>
        <Button
          variant="primary"
          onClick={() => navigate(`/${workspace}/${repo}/pull-requests`)}
        >
          Back to pull requests
        </Button>
      </div>
    );
  }

  const sc = stateConfig[pr.state];

  // ---------------------------------------------------------------------------
  // Tab content renderers
  // ---------------------------------------------------------------------------

  const renderOverview = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main content */}
      <div className="lg:col-span-2 space-y-6">
        {/* Description */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          {pr.description ? (
            <div
              className="prose dark:prose-invert max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: pr.description }}
            />
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">No description provided.</p>
          )}
        </div>

        {/* AI Review */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-800/50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Bot className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white">AI Code Review</h3>
            <Badge color="purple" size="sm">Beta</Badge>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Get an automated code review powered by AI to catch potential issues and suggest improvements.
          </p>
          <Button variant="outline" size="sm" leftIcon={<Bot className="h-4 w-4" />}>
            Run AI Review
          </Button>
        </div>

        {/* Diff summary */}
        {diffQuery.data && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-gray-400" />
              Changed files ({diffQuery.data.length})
            </h3>
            <ul className="space-y-1">
              {diffQuery.data.slice(0, 10).map((file) => (
                <li
                  key={file.oldPath || file.newPath}
                  className="flex items-center gap-2 text-sm py-1"
                >
                  <span
                    className={
                      file.status === 'added'
                        ? 'text-green-600'
                        : file.status === 'deleted'
                          ? 'text-red-600'
                          : 'text-yellow-600'
                    }
                  >
                    {file.status === 'added' ? 'A' : file.status === 'deleted' ? 'D' : 'M'}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300 truncate font-mono text-xs">
                    {file.newPath || file.oldPath}
                  </span>
                  <span className="ml-auto text-xs">
                    <span className="text-green-600">+{file.stats.additions}</span>{' '}
                    <span className="text-red-600">-{file.stats.deletions}</span>
                  </span>
                </li>
              ))}
              {diffQuery.data.length > 10 && (
                <li className="text-sm text-gray-500 dark:text-gray-400 pt-1">
                  ...and {diffQuery.data.length - 10} more files
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Comments */}
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-gray-400" />
            Comments ({commentsQuery.data?.length || 0})
          </h3>

          {commentsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-16 w-full" />
                </div>
              ))}
            </div>
          ) : commentsQuery.data?.length ? (
            <div className="space-y-3">
              {commentsQuery.data.map((comment) => (
                <div
                  key={comment.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar
                      src={comment.author.avatarUrl}
                      name={comment.author.displayName}
                      size="xs"
                    />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {comment.author.displayName}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {relativeTime(comment.createdAt)}
                    </span>
                    {comment.isResolved && (
                      <Badge color="green" size="sm">Resolved</Badge>
                    )}
                  </div>
                  <div
                    className="prose dark:prose-invert max-w-none text-sm"
                    dangerouslySetInnerHTML={{ __html: comment.renderedContent }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No comments yet.</p>
          )}

          {/* Add comment */}
          {pr.state === 'open' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Leave a comment... (Markdown supported)"
                className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-y"
              />
              <div className="flex justify-end mt-2">
                <Button
                  variant="primary"
                  size="sm"
                  loading={commentMutation.isPending}
                  disabled={!commentText.trim()}
                  onClick={() => commentMutation.mutate(commentText)}
                >
                  Comment
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-5">
        {/* Reviewers */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Reviewers</h4>
          {pr.reviewers.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">No reviewers assigned.</p>
          ) : (
            <div className="space-y-2">
              {pr.reviewers.map((r) => (
                <div key={r.user.id} className="flex items-center gap-2">
                  <Avatar src={r.user.avatarUrl} name={r.user.displayName} size="xs" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">
                    {r.user.displayName}
                  </span>
                  {r.status === 'approved' && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  {r.status === 'changes_requested' && (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  {r.status === 'pending' && (
                    <Clock className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Branch info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Branches</h4>
          <div className="text-xs space-y-2">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Source:</span>{' '}
              <code className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-mono">
                {pr.sourceBranch}
              </code>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Destination:</span>{' '}
              <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded font-mono">
                {pr.destinationBranch}
              </code>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Stats</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-xs">Commits</span>
              <p className="font-semibold text-gray-900 dark:text-white">{pr.commitCount}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-xs">Files changed</span>
              <p className="font-semibold text-gray-900 dark:text-white">
                {pr.diffStats.filesChanged}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-xs">Additions</span>
              <p className="font-semibold text-green-600">+{pr.diffStats.additions}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400 text-xs">Deletions</span>
              <p className="font-semibold text-red-600">-{pr.diffStats.deletions}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        {pr.state === 'open' && (
          <div className="space-y-2">
            <Button
              variant="primary"
              fullWidth
              leftIcon={<ThumbsUp className="h-4 w-4" />}
              loading={approveMutation.isPending}
              onClick={() => approveMutation.mutate()}
            >
              Approve
            </Button>
            <Button
              variant="secondary"
              fullWidth
              leftIcon={<GitMerge className="h-4 w-4" />}
              onClick={() => setShowMerge(true)}
            >
              Merge
            </Button>
            <Button
              variant="ghost"
              fullWidth
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              leftIcon={<XCircle className="h-4 w-4" />}
              loading={declineMutation.isPending}
              onClick={() => declineMutation.mutate()}
            >
              Decline
            </Button>
          </div>
        )}

        {/* Merge modal */}
        {showMerge && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Merge pull request
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Merge strategy
                  </label>
                  <select
                    value={mergeStrategy}
                    onChange={(e) => setMergeStrategy(e.target.value as PRMergeStrategy)}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="merge">Merge commit</option>
                    <option value="squash">Squash and merge</option>
                    <option value="rebase">Rebase and merge</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={closeSourceBranch}
                    onChange={(e) => setCloseSourceBranch(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Close source branch after merge
                </label>
                {mergeMutation.isError && (
                  <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-700 dark:text-red-300">
                    {(mergeMutation.error as ApiError)?.message || 'Merge failed.'}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button variant="secondary" onClick={() => setShowMerge(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  loading={mergeMutation.isPending}
                  onClick={() => mergeMutation.mutate()}
                >
                  Merge
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderDiff = () => {
    if (diffQuery.isLoading) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      );
    }
    if (diffQuery.isError) {
      return (
        <div className="text-center py-10">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-gray-500 dark:text-gray-400">Failed to load diff.</p>
        </div>
      );
    }
    if (!diffQuery.data?.length) {
      return (
        <div className="text-center py-10">
          <p className="text-gray-500 dark:text-gray-400">No changes.</p>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {diffQuery.data.map((file) => (
          <div
            key={file.oldPath || file.newPath}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center gap-2">
              <Badge
                color={
                  file.status === 'added'
                    ? 'green'
                    : file.status === 'deleted'
                      ? 'red'
                      : file.status === 'renamed'
                        ? 'purple'
                        : 'yellow'
                }
                size="sm"
              >
                {file.status}
              </Badge>
              <span className="font-mono text-sm text-gray-700 dark:text-gray-300 truncate">
                {file.newPath || file.oldPath}
              </span>
              <span className="ml-auto text-xs text-gray-400">
                <span className="text-green-600">+{file.stats.additions}</span>{' '}
                <span className="text-red-600">-{file.stats.deletions}</span>
              </span>
            </div>
            {file.isBinary ? (
              <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                Binary file not shown
              </div>
            ) : (
              <div className="overflow-x-auto">
                {file.hunks.map((hunk, hi) => (
                  <div key={hi}>
                    <div className="px-4 py-1 bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-600 dark:text-blue-400 font-mono">
                      {hunk.header}
                    </div>
                    {hunk.lines.map((line, li) => (
                      <div
                        key={li}
                        className={[
                          'flex font-mono text-xs leading-6',
                          line.type === 'addition'
                            ? 'bg-green-50 dark:bg-green-900/10'
                            : line.type === 'deletion'
                              ? 'bg-red-50 dark:bg-red-900/10'
                              : '',
                        ].join(' ')}
                      >
                        <span className="select-none w-10 text-right pr-2 text-gray-400 dark:text-gray-600 shrink-0 border-r border-gray-100 dark:border-gray-700">
                          {line.oldLineNumber ?? ''}
                        </span>
                        <span className="select-none w-10 text-right pr-2 text-gray-400 dark:text-gray-600 shrink-0 border-r border-gray-100 dark:border-gray-700">
                          {line.newLineNumber ?? ''}
                        </span>
                        <span
                          className={[
                            'px-2 whitespace-pre flex-1',
                            line.type === 'addition'
                              ? 'text-green-800 dark:text-green-300'
                              : line.type === 'deletion'
                                ? 'text-red-800 dark:text-red-300'
                                : 'text-gray-700 dark:text-gray-300',
                          ].join(' ')}
                        >
                          {line.type === 'addition'
                            ? '+'
                            : line.type === 'deletion'
                              ? '-'
                              : ' '}
                          {line.content}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderCommits = () => {
    if (commitsQuery.isLoading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      );
    }
    if (!commitsQuery.data?.data.length) {
      return <p className="text-gray-500 dark:text-gray-400 text-center py-10">No commits.</p>;
    }
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
        {commitsQuery.data.data.map((commit) => (
          <div key={commit.hash} className="px-4 py-3 flex items-center gap-3">
            <Avatar src={commit.author.user?.avatarUrl} name={commit.author.name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {commit.subject}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {commit.author.name} &middot; {relativeTime(commit.date)}
              </p>
            </div>
            <code className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded border border-gray-200 dark:border-gray-700">
              {commit.abbreviatedHash}
            </code>
          </div>
        ))}
      </div>
    );
  };

  const renderActivity = () => {
    if (activityQuery.isLoading) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      );
    }
    if (!activityQuery.data?.length) {
      return <p className="text-gray-500 dark:text-gray-400 text-center py-10">No activity.</p>;
    }
    return (
      <div className="relative pl-6">
        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />
        <div className="space-y-6">
          {activityQuery.data.map((item) => (
            <div key={item.id} className="relative flex gap-3">
              <div className="absolute -left-6 mt-1 h-5 w-5 rounded-full bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center z-10">
                {item.type === 'approval' ? (
                  <ThumbsUp className="h-3 w-3 text-green-500" />
                ) : item.type === 'merge' ? (
                  <GitMerge className="h-3 w-3 text-purple-500" />
                ) : item.type === 'comment' ? (
                  <MessageSquare className="h-3 w-3 text-blue-500" />
                ) : (
                  <Activity className="h-3 w-3 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">{item.author.displayName}</span>{' '}
                  {item.type === 'approval' && 'approved this pull request'}
                  {item.type === 'comment' && 'left a comment'}
                  {item.type === 'merge' && 'merged this pull request'}
                  {item.type === 'decline' && 'declined this pull request'}
                  {item.type === 'update' && 'updated this pull request'}
                  {item.type === 'status_change' && 'changed the status'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {relativeTime(item.timestamp)}
                </p>
                {item.comment && (
                  <div className="mt-2 bg-gray-50 dark:bg-gray-900 rounded-md p-3 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                    <div dangerouslySetInnerHTML={{ __html: item.comment.renderedContent }} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  const tabs: { label: string; value: TabValue; icon: React.ReactNode }[] = [
    { label: 'Overview', value: 'overview', icon: <MessageSquare className="h-4 w-4" /> },
    { label: 'Diff', value: 'diff', icon: <FileCode2 className="h-4 w-4" /> },
    { label: 'Commits', value: 'commits', icon: <GitCommitHorizontal className="h-4 w-4" /> },
    { label: 'Activity', value: 'activity', icon: <Activity className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* PR header */}
      <div>
        <div className="flex items-start gap-3">
          <span className={sc.color}>{sc.icon}</span>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {pr.title}{' '}
              <span className="text-gray-400 dark:text-gray-500 font-normal">#{pr.number}</span>
            </h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap text-sm">
              <Badge
                color={
                  pr.state === 'open'
                    ? 'blue'
                    : pr.state === 'merged'
                      ? 'green'
                      : 'red'
                }
              >
                {sc.label}
              </Badge>
              <span className="text-gray-500 dark:text-gray-400">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {pr.author.displayName}
                </span>{' '}
                wants to merge{' '}
                <code className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-mono">
                  {pr.sourceBranch}
                </code>{' '}
                into{' '}
                <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-mono">
                  {pr.destinationBranch}
                </code>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={[
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer',
              activeTab === tab.value
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
            ].join(' ')}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'diff' && renderDiff()}
      {activeTab === 'commits' && renderCommits()}
      {activeTab === 'activity' && renderActivity()}
    </div>
  );
}
