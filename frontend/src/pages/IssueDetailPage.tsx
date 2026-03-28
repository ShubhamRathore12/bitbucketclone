import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Edit3,
  MessageSquare,
  Clock,
  Tag,
  User,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import type { UserReference, ApiError } from '@/types/common';

// ---------------------------------------------------------------------------
// Issue types
// ---------------------------------------------------------------------------

type IssueState = 'new' | 'open' | 'resolved' | 'on hold' | 'invalid' | 'duplicate' | 'wontfix' | 'closed';
type IssuePriority = 'trivial' | 'minor' | 'major' | 'critical' | 'blocker';
type IssueKind = 'bug' | 'enhancement' | 'proposal' | 'task';

interface IssueDetail {
  id: string;
  number: number;
  title: string;
  content: string;
  renderedContent: string;
  state: IssueState;
  priority: IssuePriority;
  kind: IssueKind;
  assignee?: UserReference;
  reporter: UserReference;
  votesCount: number;
  watchersCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

interface IssueComment {
  id: string;
  author: UserReference;
  content: string;
  renderedContent: string;
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

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('access_token')}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('API error');
  return res.json();
}

async function putJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('access_token')}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('API error');
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

const priorityColors: Record<IssuePriority, 'red' | 'yellow' | 'blue' | 'gray'> = {
  blocker: 'red',
  critical: 'red',
  major: 'yellow',
  minor: 'blue',
  trivial: 'gray',
};

const stateIcons: Record<string, React.ReactNode> = {
  new: <Circle className="h-5 w-5 text-blue-500" />,
  open: <AlertCircle className="h-5 w-5 text-green-500" />,
  resolved: <CheckCircle2 className="h-5 w-5 text-purple-500" />,
  closed: <CheckCircle2 className="h-5 w-5 text-gray-400" />,
};

const allStates: IssueState[] = ['new', 'open', 'resolved', 'on hold', 'invalid', 'duplicate', 'wontfix', 'closed'];

// ---------------------------------------------------------------------------
// IssueDetailPage
// ---------------------------------------------------------------------------

export default function IssueDetailPage() {
  const { workspace, repo, issueId } = useParams<{
    workspace: string;
    repo: string;
    issueId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');
  const [showStateDropdown, setShowStateDropdown] = useState(false);

  const basePath = `/api/repositories/${workspace}/${repo}/issues/${issueId}`;

  const issueQuery = useQuery<IssueDetail>({
    queryKey: ['issue', workspace, repo, issueId],
    queryFn: () => fetchJson(basePath),
    enabled: !!workspace && !!repo && !!issueId,
  });

  const commentsQuery = useQuery<IssueComment[]>({
    queryKey: ['issue-comments', workspace, repo, issueId],
    queryFn: () => fetchJson(`${basePath}/comments`),
    enabled: !!workspace && !!repo && !!issueId,
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) => postJson(`${basePath}/comments`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue-comments', workspace, repo, issueId] });
      setCommentText('');
    },
  });

  const stateChangeMutation = useMutation({
    mutationFn: (state: IssueState) => putJson(basePath, { state }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', workspace, repo, issueId] });
      setShowStateDropdown(false);
    },
  });

  const issue = issueQuery.data;

  // Loading
  if (issueQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <Skeleton className="h-6 w-6" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // Error
  if (issueQuery.isError || !issue) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Issue not found
        </h2>
        <Button
          variant="primary"
          onClick={() => navigate(`/${workspace}/${repo}/issues`)}
        >
          Back to issues
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Issue header */}
      <div className="flex items-start gap-3">
        <span className="mt-1 shrink-0">
          {stateIcons[issue.state] || <Circle className="h-5 w-5 text-gray-400" />}
        </span>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {issue.title}{' '}
            <span className="text-gray-400 dark:text-gray-500 font-normal">#{issue.number}</span>
          </h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap text-sm">
            <Badge
              color={
                issue.state === 'open' || issue.state === 'new'
                  ? 'blue'
                  : issue.state === 'resolved'
                    ? 'green'
                    : 'gray'
              }
            >
              {issue.state}
            </Badge>
            <Badge color={priorityColors[issue.priority]}>{issue.priority}</Badge>
            <Badge color="gray">{issue.kind}</Badge>
            <span className="text-gray-500 dark:text-gray-400">
              Opened by{' '}
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {issue.reporter.displayName}
              </span>{' '}
              {relativeTime(issue.createdAt)}
            </span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<Edit3 className="h-4 w-4" />}
          onClick={() => navigate(`/${workspace}/${repo}/issues/${issue.number}/edit`)}
        >
          Edit
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            {issue.renderedContent ? (
              <div
                className="prose dark:prose-invert max-w-none text-sm"
                dangerouslySetInnerHTML={{ __html: issue.renderedContent }}
              />
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                No description provided.
              </p>
            )}
          </div>

          {/* Comments */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-gray-400" />
              Comments ({commentsQuery.data?.length || 0})
            </h3>

            {commentsQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Skeleton className="h-6 w-6 rounded-full" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-12 w-full" />
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
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* State changer */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Status</h4>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowStateDropdown(!showStateDropdown)}
                className="w-full flex items-center justify-between gap-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <span className="flex items-center gap-2">
                  {stateIcons[issue.state] || <Circle className="h-4 w-4" />}
                  <span className="capitalize text-gray-700 dark:text-gray-300">{issue.state}</span>
                </span>
                <ChevronDown className="h-3 w-3 text-gray-400" />
              </button>
              {showStateDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowStateDropdown(false)} />
                  <div className="absolute left-0 mt-1 w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50">
                    {allStates.map((state) => (
                      <button
                        key={state}
                        type="button"
                        onClick={() => stateChangeMutation.mutate(state)}
                        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer capitalize ${
                          state === issue.state
                            ? 'font-semibold text-blue-600 dark:text-blue-400'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {stateIcons[state] || <Circle className="h-4 w-4" />}
                        {state}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Assignee */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Assignee</h4>
            {issue.assignee ? (
              <div className="flex items-center gap-2">
                <Avatar
                  src={issue.assignee.avatarUrl}
                  name={issue.assignee.displayName}
                  size="sm"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {issue.assignee.displayName}
                </span>
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">No one assigned</p>
            )}
          </div>

          {/* Details */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Details</h4>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500 dark:text-gray-400 text-xs">Priority</dt>
                <dd>
                  <Badge color={priorityColors[issue.priority]}>{issue.priority}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400 text-xs">Kind</dt>
                <dd className="capitalize text-gray-700 dark:text-gray-300">{issue.kind}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400 text-xs">Votes</dt>
                <dd className="text-gray-700 dark:text-gray-300">{issue.votesCount}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400 text-xs">Watchers</dt>
                <dd className="text-gray-700 dark:text-gray-300">{issue.watchersCount}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400 text-xs">Created</dt>
                <dd className="text-gray-700 dark:text-gray-300">
                  {new Date(issue.createdAt).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400 text-xs">Updated</dt>
                <dd className="text-gray-700 dark:text-gray-300">
                  {new Date(issue.updatedAt).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
