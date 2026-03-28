import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GitPullRequest,
  GitMerge,
  XCircle,
  CheckCircle2,
  Clock,
  GitBranch,
  ArrowRight,
  MessageSquare,
  CheckCheck,
  X,
  ThumbsUp,
  Bot,
  Loader2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import type { PullRequest, PRComment, PRReviewer, AIReviewStatus } from '@/types/pr';
import Button from '@/components/ui/Button';
import DiffViewer from './DiffViewer';
import ReviewPanel from './ReviewPanel';
import AIReviewBadge from './AIReviewBadge';

type ActiveTab = 'overview' | 'diff' | 'commits' | 'activity';

interface PullRequestDetailProps {
  repoFullName: string;
  prNumber: number;
}

async function fetchPR(repoFullName: string, prNumber: number): Promise<PullRequest> {
  const res = await fetch(`/api/repositories/${repoFullName}/pull-requests/${prNumber}`);
  if (!res.ok) throw new Error('Failed to fetch pull request');
  return res.json();
}

async function fetchComments(repoFullName: string, prNumber: number): Promise<PRComment[]> {
  const res = await fetch(`/api/repositories/${repoFullName}/pull-requests/${prNumber}/comments`);
  if (!res.ok) throw new Error('Failed to fetch comments');
  return res.json();
}

async function fetchAIReview(repoFullName: string, prNumber: number): Promise<AIReviewStatus | null> {
  const res = await fetch(`/api/repositories/${repoFullName}/pull-requests/${prNumber}/ai-review`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch AI review');
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

const reviewStatusIcon: Record<string, React.ReactNode> = {
  approved: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  changes_requested: <XCircle className="h-4 w-4 text-red-500" />,
  pending: <Clock className="h-4 w-4 text-yellow-500" />,
  dismissed: <X className="h-4 w-4 text-gray-400" />,
};

export default function PullRequestDetail({ repoFullName, prNumber }: PullRequestDetailProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [showMergeMenu, setShowMergeMenu] = useState(false);

  const queryClient = useQueryClient();

  const { data: pr, isLoading, isError, error } = useQuery({
    queryKey: ['pull-request', repoFullName, prNumber],
    queryFn: () => fetchPR(repoFullName, prNumber),
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['pr-comments', repoFullName, prNumber],
    queryFn: () => fetchComments(repoFullName, prNumber),
    enabled: !!pr,
  });

  const { data: aiReview } = useQuery({
    queryKey: ['ai-review', repoFullName, prNumber],
    queryFn: () => fetchAIReview(repoFullName, prNumber),
    enabled: !!pr,
  });

  const mergeMutation = useMutation({
    mutationFn: async (strategy: string) => {
      const res = await fetch(
        `/api/repositories/${repoFullName}/pull-requests/${prNumber}/merge`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ strategy }),
        }
      );
      if (!res.ok) throw new Error('Failed to merge');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pull-request', repoFullName, prNumber] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/repositories/${repoFullName}/pull-requests/${prNumber}/approve`,
        { method: 'POST' }
      );
      if (!res.ok) throw new Error('Failed to approve');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pull-request', repoFullName, prNumber] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/repositories/${repoFullName}/pull-requests/${prNumber}/decline`,
        { method: 'POST' }
      );
      if (!res.ok) throw new Error('Failed to decline');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pull-request', repoFullName, prNumber] });
    },
  });

  const triggerAIReview = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/repositories/${repoFullName}/pull-requests/${prNumber}/ai-review`,
        { method: 'POST' }
      );
      if (!res.ok) throw new Error('Failed to trigger AI review');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-review', repoFullName, prNumber] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (isError || !pr) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md dark:bg-red-900/20 dark:border-red-800">
        <AlertCircle className="h-5 w-5 text-red-500" />
        <p className="text-sm text-red-700 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load pull request'}
        </p>
      </div>
    );
  }

  const tabs: { key: ActiveTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'diff', label: `Diff (${pr.diffStats.filesChanged})` },
    { key: 'commits', label: `Commits (${pr.commitCount})` },
    { key: 'activity', label: 'Activity' },
  ];

  const overviewComments = comments.filter((c) => !c.inline);
  const approvedCount = pr.reviewers.filter((r) => r.status === 'approved').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-start gap-3">
          {pr.state === 'open' && <GitPullRequest className="h-6 w-6 text-green-500 shrink-0 mt-1" />}
          {pr.state === 'merged' && <GitMerge className="h-6 w-6 text-purple-500 shrink-0 mt-1" />}
          {(pr.state === 'declined' || pr.state === 'superseded') && <XCircle className="h-6 w-6 text-red-500 shrink-0 mt-1" />}
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {pr.title}{' '}
              <span className="text-gray-400 font-normal">#{pr.number}</span>
            </h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
              <img src={pr.author.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
              <span>{pr.author.displayName}</span>
              <span>wants to merge</span>
              <span className="inline-flex items-center gap-1">
                <GitBranch className="h-3.5 w-3.5" />
                <code className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs dark:bg-blue-900/30 dark:text-blue-300">
                  {pr.sourceBranch}
                </code>
              </span>
              <ArrowRight className="h-3.5 w-3.5" />
              <code className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs dark:bg-gray-700 dark:text-gray-300">
                {pr.destinationBranch}
              </code>
              <span>({pr.commitCount} commits)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content with sidebar */}
      <div className="flex gap-6">
        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex gap-6">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={[
                    'pb-3 text-sm font-medium border-b-2 transition-colors',
                    activeTab === tab.key
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab content */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Description */}
              {pr.description && (
                <div className="prose prose-sm dark:prose-invert max-w-none p-4 border border-gray-200 rounded-md dark:border-gray-700">
                  <div dangerouslySetInnerHTML={{ __html: pr.description }} />
                </div>
              )}

              {/* Diff stats */}
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span className="text-green-600 dark:text-green-400">+{pr.diffStats.additions}</span>
                <span className="text-red-600 dark:text-red-400">-{pr.diffStats.deletions}</span>
                <span>{pr.diffStats.filesChanged} files changed</span>
              </div>

              {/* Comments */}
              <div className="space-y-4">
                {overviewComments.map((comment) => (
                  <div key={comment.id} className="border border-gray-200 rounded-md dark:border-gray-700">
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-sm">
                      <img src={comment.author.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
                      <span className="font-medium text-gray-800 dark:text-gray-200">{comment.author.displayName}</span>
                      <span className="text-gray-500">{relativeTime(comment.createdAt)}</span>
                    </div>
                    <div
                      className="px-4 py-3 prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: comment.renderedContent }}
                    />
                  </div>
                ))}
              </div>

              {/* Review panel */}
              {showReviewPanel && (
                <ReviewPanel
                  repoFullName={repoFullName}
                  prNumber={prNumber}
                  onSubmitted={() => {
                    setShowReviewPanel(false);
                    queryClient.invalidateQueries({ queryKey: ['pull-request', repoFullName, prNumber] });
                  }}
                  onCancel={() => setShowReviewPanel(false)}
                />
              )}
            </div>
          )}

          {activeTab === 'diff' && (
            <DiffViewer repoFullName={repoFullName} prNumber={prNumber} />
          )}

          {activeTab === 'commits' && (
            <div className="text-sm text-gray-500 dark:text-gray-400 p-8 text-center">
              Commit list for this pull request ({pr.commitCount} commits)
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="text-sm text-gray-500 dark:text-gray-400 p-8 text-center">
              Activity timeline for this pull request
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-64 shrink-0 space-y-5">
          {/* Actions */}
          {pr.state === 'open' && (
            <div className="space-y-2">
              {/* Merge */}
              <div className="relative">
                <div className="flex">
                  <Button
                    variant="primary"
                    fullWidth
                    loading={mergeMutation.isPending}
                    onClick={() => mergeMutation.mutate('merge')}
                    leftIcon={<GitMerge className="h-4 w-4" />}
                    className="rounded-r-none"
                  >
                    Merge
                  </Button>
                  <button
                    onClick={() => setShowMergeMenu(!showMergeMenu)}
                    className="px-2 bg-blue-700 text-white rounded-r-md hover:bg-blue-800 border-l border-blue-500"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
                {showMergeMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMergeMenu(false)} />
                    <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20 dark:bg-gray-800 dark:border-gray-700">
                      {['merge', 'squash', 'rebase'].map((s) => (
                        <button
                          key={s}
                          onClick={() => { mergeMutation.mutate(s); setShowMergeMenu(false); }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 capitalize text-gray-700 dark:text-gray-300"
                        >
                          {s === 'merge' ? 'Merge commit' : s === 'squash' ? 'Squash merge' : 'Rebase'}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <Button
                variant="outline"
                fullWidth
                loading={approveMutation.isPending}
                onClick={() => approveMutation.mutate()}
                leftIcon={<ThumbsUp className="h-4 w-4" />}
              >
                Approve
              </Button>
              <Button
                variant="ghost"
                fullWidth
                onClick={() => setShowReviewPanel(true)}
                leftIcon={<MessageSquare className="h-4 w-4" />}
              >
                Add review
              </Button>
              <Button
                variant="danger"
                fullWidth
                loading={declineMutation.isPending}
                onClick={() => declineMutation.mutate()}
                leftIcon={<X className="h-4 w-4" />}
              >
                Decline
              </Button>

              {/* AI Review */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="outline"
                  fullWidth
                  loading={triggerAIReview.isPending}
                  onClick={() => triggerAIReview.mutate()}
                  leftIcon={<Bot className="h-4 w-4" />}
                >
                  AI Review
                </Button>
                {aiReview && <AIReviewBadge status={aiReview} className="mt-2" />}
              </div>
            </div>
          )}

          {/* Reviewers */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 dark:text-gray-400">
              Reviewers
            </h3>
            {pr.reviewers.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">No reviewers</p>
            ) : (
              <ul className="space-y-2">
                {pr.reviewers.map((reviewer: PRReviewer) => (
                  <li key={reviewer.user.id} className="flex items-center gap-2 text-sm">
                    <img src={reviewer.user.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
                    <span className="flex-1 text-gray-700 dark:text-gray-300 truncate">
                      {reviewer.user.displayName}
                    </span>
                    {reviewStatusIcon[reviewer.status]}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Participants */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 dark:text-gray-400">
              Participants
            </h3>
            <div className="flex -space-x-2">
              {pr.participants.map((p) => (
                <img
                  key={p.user.id}
                  src={p.user.avatarUrl}
                  alt={p.user.displayName}
                  title={p.user.displayName}
                  className="h-7 w-7 rounded-full border-2 border-white dark:border-gray-900"
                />
              ))}
            </div>
          </div>

          {/* Build status */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 dark:text-gray-400">
              Build status
            </h3>
            {pr.hasConflicts && (
              <div className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
                <XCircle className="h-4 w-4" />
                Has conflicts
              </div>
            )}
            <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <CheckCheck className="h-4 w-4 text-green-500" />
              {pr.resolvedTaskCount}/{pr.taskCount} tasks resolved
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
