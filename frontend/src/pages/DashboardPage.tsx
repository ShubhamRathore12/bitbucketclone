import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  GitPullRequest,
  AlertCircle,
  Clock,
  Code2,
  FileCode2,
  ChevronRight,
  FolderGit2,
  Users,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import type { User } from '@/types/auth';
import type { PullRequest } from '@/types/pr';
import type { Workspace, Repository } from '@/types/repo';
import type { PaginatedResponse, UserReference } from '@/types/common';

// ---------------------------------------------------------------------------
// API helpers (move to src/api/ later)
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Skeleton helpers
// ---------------------------------------------------------------------------

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`}
      aria-hidden="true"
    />
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-3">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interfaces for dashboard-specific API responses
// ---------------------------------------------------------------------------

interface ActivityItem {
  id: string;
  type: 'push' | 'pr_created' | 'pr_merged' | 'issue_created' | 'comment' | 'branch_created';
  message: string;
  actor: UserReference;
  repository: { name: string; fullName: string };
  timestamp: string;
}

interface DashboardIssue {
  id: string;
  number: number;
  title: string;
  state: 'new' | 'open' | 'resolved' | 'closed';
  priority: 'trivial' | 'minor' | 'major' | 'critical' | 'blocker';
  repository: { name: string; fullName: string };
  createdAt: string;
}

// ---------------------------------------------------------------------------
// DashboardPage
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const navigate = useNavigate();

  // Current user
  const userQuery = useQuery<User>({
    queryKey: ['currentUser'],
    queryFn: () => fetchJson('/api/user/me'),
  });

  // Workspaces
  const workspacesQuery = useQuery<PaginatedResponse<Workspace>>({
    queryKey: ['workspaces'],
    queryFn: () => fetchJson('/api/workspaces?pageSize=20'),
  });

  // Recent activity
  const activityQuery = useQuery<PaginatedResponse<ActivityItem>>({
    queryKey: ['dashboard', 'activity'],
    queryFn: () => fetchJson('/api/dashboard/activity?pageSize=10'),
  });

  // Open PRs assigned to current user
  const prsQuery = useQuery<PaginatedResponse<PullRequest>>({
    queryKey: ['dashboard', 'prs'],
    queryFn: () => fetchJson('/api/dashboard/pull-requests?role=reviewer&state=open&pageSize=10'),
  });

  // Assigned issues
  const issuesQuery = useQuery<PaginatedResponse<DashboardIssue>>({
    queryKey: ['dashboard', 'issues'],
    queryFn: () => fetchJson('/api/dashboard/issues?assignee=me&state=open&pageSize=10'),
  });

  const user = userQuery.data;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function activityIcon(type: ActivityItem['type']) {
    switch (type) {
      case 'push':
        return <Code2 className="h-4 w-4 text-blue-500" />;
      case 'pr_created':
      case 'pr_merged':
        return <GitPullRequest className="h-4 w-4 text-purple-500" />;
      case 'issue_created':
        return <AlertCircle className="h-4 w-4 text-green-500" />;
      case 'comment':
        return <Activity className="h-4 w-4 text-yellow-500" />;
      case 'branch_created':
        return <FolderGit2 className="h-4 w-4 text-teal-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  }

  function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  const prStateBadge = (state: string) => {
    const map: Record<string, { color: 'green' | 'blue' | 'red' | 'gray'; label: string }> = {
      open: { color: 'blue', label: 'Open' },
      merged: { color: 'green', label: 'Merged' },
      declined: { color: 'red', label: 'Declined' },
    };
    const s = map[state] || { color: 'gray' as const, label: state };
    return <Badge color={s.color} size="sm">{s.label}</Badge>;
  };

  const issuePriorityBadge = (priority: string) => {
    const map: Record<string, 'red' | 'yellow' | 'blue' | 'gray'> = {
      blocker: 'red',
      critical: 'red',
      major: 'yellow',
      minor: 'blue',
      trivial: 'gray',
    };
    return <Badge color={map[priority] || 'gray'} size="sm">{priority}</Badge>;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            {userQuery.isLoading ? (
              <>
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </>
            ) : (
              <>
                <Avatar src={user?.avatarUrl} name={user?.displayName} size="lg" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Welcome back, {user?.displayName?.split(' ')[0] || user?.username || 'User'}
                  </h1>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    Here is what is happening across your workspaces
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => navigate('/repo/create')}
            >
              New repository
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FileCode2 className="h-4 w-4" />}
              onClick={() => navigate('/snippets/create')}
            >
              New snippet
            </Button>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Activity + PRs + Issues */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recent activity */}
            <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Activity className="h-5 w-5 text-gray-400" />
                  Recent Activity
                </h2>
                <Link to="/activity" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400">
                  View all
                </Link>
              </div>

              {activityQuery.isLoading ? (
                <div className="p-5 space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                      <div className="space-y-1.5 flex-1">
                        <Skeleton className="h-3.5 w-3/4" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activityQuery.isError ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-400" />
                  <p>Failed to load activity feed.</p>
                </div>
              ) : !activityQuery.data?.data.length ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>No recent activity.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {activityQuery.data.data.map((item) => (
                    <li key={item.id} className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                      <div className="mt-0.5 shrink-0">{activityIcon(item.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
                          <span className="font-medium">{item.actor.displayName}</span>{' '}
                          {item.message}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          <Link
                            to={`/${item.repository.fullName}`}
                            className="hover:underline text-blue-600 dark:text-blue-400"
                          >
                            {item.repository.fullName}
                          </Link>{' '}
                          &middot; {relativeTime(item.timestamp)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Open Pull Requests */}
            <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <GitPullRequest className="h-5 w-5 text-gray-400" />
                  Your Open Pull Requests
                </h2>
                <Link to="/dashboard/pull-requests" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400">
                  View all
                </Link>
              </div>

              {prsQuery.isLoading ? (
                <div className="p-5 space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-5 w-5 rounded shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : prsQuery.isError ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-400" />
                  <p>Failed to load pull requests.</p>
                </div>
              ) : !prsQuery.data?.data.length ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <GitPullRequest className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>No open pull requests.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {prsQuery.data.data.map((pr) => (
                    <li key={pr.id}>
                      <Link
                        to={`/${pr.repository.fullName}/pull-requests/${pr.number}`}
                        className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                      >
                        <GitPullRequest className="h-4 w-4 text-blue-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {pr.title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            #{pr.number} &middot; {pr.repository.fullName} &middot;{' '}
                            {pr.sourceBranch} &rarr; {pr.destinationBranch}
                          </p>
                        </div>
                        {prStateBadge(pr.state)}
                        <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Assigned Issues */}
            <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-gray-400" />
                  Your Assigned Issues
                </h2>
                <Link to="/dashboard/issues" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400">
                  View all
                </Link>
              </div>

              {issuesQuery.isLoading ? (
                <div className="p-5 space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-5 w-5 rounded shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : issuesQuery.isError ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-400" />
                  <p>Failed to load issues.</p>
                </div>
              ) : !issuesQuery.data?.data.length ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>No assigned issues. Nice work!</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {issuesQuery.data.data.map((issue) => (
                    <li key={issue.id}>
                      <Link
                        to={`/${issue.repository.fullName}/issues/${issue.number}`}
                        className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                      >
                        <AlertCircle className="h-4 w-4 text-green-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {issue.title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            #{issue.number} &middot; {issue.repository.fullName}
                          </p>
                        </div>
                        {issuePriorityBadge(issue.priority)}
                        <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Right column: Workspaces */}
          <div className="space-y-6">
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-gray-400" />
                  Workspaces
                </h2>
                <Button variant="ghost" size="sm" onClick={() => navigate('/workspaces/create')}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {workspacesQuery.isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <CardSkeleton key={i} />
                  ))}
                </div>
              ) : workspacesQuery.isError ? (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center text-gray-500 dark:text-gray-400">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-400" />
                  <p>Failed to load workspaces.</p>
                </div>
              ) : !workspacesQuery.data?.data.length ? (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center text-gray-500 dark:text-gray-400">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>No workspaces yet.</p>
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-3"
                    onClick={() => navigate('/workspaces/create')}
                  >
                    Create workspace
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {workspacesQuery.data.data.map((ws) => (
                    <Link
                      key={ws.id}
                      to={`/${ws.slug}`}
                      className="block rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all bg-white dark:bg-gray-800"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={ws.avatarUrl}
                          name={ws.name}
                          size="sm"
                          shape="square"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {ws.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {ws.slug} &middot; {ws.memberCount} member{ws.memberCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                        {ws.isPersonal && (
                          <Badge color="blue" size="sm">Personal</Badge>
                        )}
                      </div>
                      {ws.description && (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                          {ws.description}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
