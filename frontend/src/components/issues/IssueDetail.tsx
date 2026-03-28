import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CircleDot,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ArrowUpCircle,
  Circle,
  Pencil,
  Tag,
  User,
  Clock,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { Issue, IssueComment, IssueState, IssuePriority, Label } from '@/types/issues';
import Button from '@/components/ui/Button';

interface IssueDetailProps {
  repoFullName: string;
  issueNumber: number;
  onEdit?: (issue: Issue) => void;
}

async function fetchIssue(repoFullName: string, issueNumber: number): Promise<Issue> {
  const res = await fetch(`/api/repositories/${repoFullName}/issues/${issueNumber}`);
  if (!res.ok) throw new Error('Failed to fetch issue');
  return res.json();
}

async function fetchComments(repoFullName: string, issueNumber: number): Promise<IssueComment[]> {
  const res = await fetch(`/api/repositories/${repoFullName}/issues/${issueNumber}/comments`);
  if (!res.ok) throw new Error('Failed to fetch comments');
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

const priorityConfig: Record<IssuePriority, { icon: React.ReactNode; color: string }> = {
  blocker: { icon: <AlertOctagon className="h-4 w-4" />, color: 'text-red-600' },
  critical: { icon: <AlertTriangle className="h-4 w-4" />, color: 'text-red-500' },
  major: { icon: <ArrowUpCircle className="h-4 w-4" />, color: 'text-orange-500' },
  minor: { icon: <Circle className="h-4 w-4" />, color: 'text-yellow-500' },
  trivial: { icon: <Circle className="h-4 w-4" />, color: 'text-gray-400' },
};

const stateColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  open: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  on_hold: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  resolved: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  closed: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  duplicate: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  invalid: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  wontfix: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

export default function IssueDetail({ repoFullName, issueNumber, onEdit }: IssueDetailProps) {
  const [newComment, setNewComment] = useState('');
  const queryClient = useQueryClient();

  const { data: issue, isLoading, isError, error } = useQuery({
    queryKey: ['issue', repoFullName, issueNumber],
    queryFn: () => fetchIssue(repoFullName, issueNumber),
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['issue-comments', repoFullName, issueNumber],
    queryFn: () => fetchComments(repoFullName, issueNumber),
    enabled: !!issue,
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/repositories/${repoFullName}/issues/${issueNumber}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: newComment }),
        }
      );
      if (!res.ok) throw new Error('Failed to post comment');
      return res.json();
    },
    onSuccess: () => {
      setNewComment('');
      queryClient.invalidateQueries({ queryKey: ['issue-comments', repoFullName, issueNumber] });
    },
  });

  const stateChangeMutation = useMutation({
    mutationFn: async (state: IssueState) => {
      const res = await fetch(
        `/api/repositories/${repoFullName}/issues/${issueNumber}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state }),
        }
      );
      if (!res.ok) throw new Error('Failed to update issue');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', repoFullName, issueNumber] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (isError || !issue) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md dark:bg-red-900/20 dark:border-red-800">
        <AlertCircle className="h-5 w-5 text-red-500" />
        <p className="text-sm text-red-700 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load issue'}
        </p>
      </div>
    );
  }

  const isOpen = ['new', 'open', 'on_hold'].includes(issue.state);
  const priority = priorityConfig[issue.priority];

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-start gap-3">
            {isOpen ? (
              <CircleDot className="h-6 w-6 text-green-500 shrink-0 mt-1" />
            ) : (
              <CheckCircle2 className="h-6 w-6 text-purple-500 shrink-0 mt-1" />
            )}
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {issue.title}{' '}
                <span className="text-gray-400 font-normal">#{issue.number}</span>
              </h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                <span className={['px-2 py-0.5 text-xs rounded-full capitalize', stateColors[issue.state]].join(' ')}>
                  {issue.state.replace('_', ' ')}
                </span>
                <span>
                  Opened {relativeTime(issue.createdAt)} by {issue.reporter.displayName}
                </span>
              </div>
            </div>
            {onEdit && (
              <Button variant="outline" size="sm" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => onEdit(issue)}>
                Edit
              </Button>
            )}
          </div>
        </div>

        {/* Description */}
        {issue.content && (
          <div className="border border-gray-200 rounded-md dark:border-gray-700">
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-sm">
              <img src={issue.reporter.avatarUrl} alt="" className="h-5 w-5 rounded-full" />
              <span className="font-medium text-gray-800 dark:text-gray-200">{issue.reporter.displayName}</span>
              <span className="text-gray-500">{relativeTime(issue.createdAt)}</span>
            </div>
            <div
              className="px-4 py-3 prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: issue.renderedContent }}
            />
          </div>
        )}

        {/* Comments */}
        <div className="space-y-4">
          {comments.map((comment) => (
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

        {/* New comment form */}
        <div className="border border-gray-200 rounded-md dark:border-gray-700">
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Add a comment</span>
          </div>
          <div className="p-4 space-y-3">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={4}
              placeholder="Write a comment... (Markdown supported)"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md resize-y
                focus:outline-none focus:ring-2 focus:ring-blue-500
                dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            />
            <div className="flex items-center gap-3 justify-end">
              {isOpen ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => stateChangeMutation.mutate('resolved')}
                  loading={stateChangeMutation.isPending}
                >
                  Close issue
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => stateChangeMutation.mutate('open')}
                  loading={stateChangeMutation.isPending}
                >
                  Reopen issue
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                disabled={!newComment.trim()}
                loading={commentMutation.isPending}
                onClick={() => commentMutation.mutate()}
              >
                Comment
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-56 shrink-0 space-y-5">
        {/* State */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 dark:text-gray-400">State</h3>
          <span className={['px-2 py-1 text-sm rounded capitalize', stateColors[issue.state]].join(' ')}>
            {issue.state.replace('_', ' ')}
          </span>
        </div>

        {/* Priority */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 dark:text-gray-400">Priority</h3>
          <span className={['inline-flex items-center gap-1.5 text-sm capitalize', priority.color].join(' ')}>
            {priority.icon}
            {issue.priority}
          </span>
        </div>

        {/* Kind */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 dark:text-gray-400">Kind</h3>
          <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{issue.kind}</span>
        </div>

        {/* Assignee */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 dark:text-gray-400">Assignee</h3>
          {issue.assignee ? (
            <div className="flex items-center gap-2 text-sm">
              <img src={issue.assignee.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
              <span className="text-gray-700 dark:text-gray-300">{issue.assignee.displayName}</span>
            </div>
          ) : (
            <span className="text-sm text-gray-400 dark:text-gray-500">Unassigned</span>
          )}
        </div>

        {/* Labels */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 dark:text-gray-400">Labels</h3>
          {issue.labels.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
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
          ) : (
            <span className="text-sm text-gray-400 dark:text-gray-500">None</span>
          )}
        </div>

        {/* Milestone */}
        {issue.milestone && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 dark:text-gray-400">Milestone</h3>
            <span className="text-sm text-gray-700 dark:text-gray-300">{issue.milestone.name}</span>
          </div>
        )}

        {/* Watchers & Votes */}
        <div className="flex gap-4">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 dark:text-gray-400">Votes</h3>
            <span className="text-sm text-gray-700 dark:text-gray-300">{issue.votes}</span>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 dark:text-gray-400">Watchers</h3>
            <span className="text-sm text-gray-700 dark:text-gray-300">{issue.watchers}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
