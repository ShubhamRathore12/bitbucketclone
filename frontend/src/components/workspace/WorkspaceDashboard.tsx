import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  GitBranch,
  Users,
  Activity,
  GitPullRequest,
  CircleDot,
  Clock,
  Loader2,
  AlertCircle,
  ArrowRight,
  Star,
} from 'lucide-react';
import type { Workspace } from '@/types/workspace';
import type { Repository } from '@/types/repos';

interface WorkspaceDashboardProps {
  workspaceSlug: string;
  onRepoClick?: (fullName: string) => void;
}

interface DashboardData {
  workspace: Workspace;
  recentRepos: Repository[];
  stats: {
    totalRepos: number;
    totalMembers: number;
    openPRs: number;
    openIssues: number;
  };
  recentActivity: ActivityItem[];
}

interface ActivityItem {
  id: string;
  type: 'push' | 'pr_created' | 'pr_merged' | 'issue_created' | 'issue_resolved';
  actor: { displayName: string; avatarUrl: string };
  repo: string;
  message: string;
  timestamp: string;
}

async function fetchDashboard(slug: string): Promise<DashboardData> {
  const res = await fetch(`/api/workspaces/${slug}/dashboard`);
  if (!res.ok) throw new Error('Failed to fetch dashboard');
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

const activityIcons: Record<string, React.ReactNode> = {
  push: <GitBranch className="h-4 w-4 text-blue-500" />,
  pr_created: <GitPullRequest className="h-4 w-4 text-green-500" />,
  pr_merged: <GitPullRequest className="h-4 w-4 text-purple-500" />,
  issue_created: <CircleDot className="h-4 w-4 text-green-500" />,
  issue_resolved: <CircleDot className="h-4 w-4 text-purple-500" />,
};

export default function WorkspaceDashboard({ workspaceSlug, onRepoClick }: WorkspaceDashboardProps) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['workspace-dashboard', workspaceSlug],
    queryFn: () => fetchDashboard(workspaceSlug),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md dark:bg-red-900/20 dark:border-red-800">
        <AlertCircle className="h-5 w-5 text-red-500" />
        <p className="text-sm text-red-700 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load dashboard'}
        </p>
      </div>
    );
  }

  const { workspace, recentRepos, stats, recentActivity } = data;

  return (
    <div className="space-y-6">
      {/* Workspace header */}
      <div className="flex items-center gap-4">
        <img
          src={workspace.avatarUrl}
          alt={workspace.name}
          className="h-12 w-12 rounded-lg"
        />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{workspace.name}</h1>
          {workspace.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{workspace.description}</p>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Repositories', value: stats.totalRepos, icon: <GitBranch className="h-5 w-5 text-blue-500" /> },
          { label: 'Members', value: stats.totalMembers, icon: <Users className="h-5 w-5 text-green-500" /> },
          { label: 'Open PRs', value: stats.openPRs, icon: <GitPullRequest className="h-5 w-5 text-purple-500" /> },
          { label: 'Open Issues', value: stats.openIssues, icon: <CircleDot className="h-5 w-5 text-orange-500" /> },
        ].map((stat) => (
          <div
            key={stat.label}
            className="p-4 border border-gray-200 rounded-lg dark:border-gray-700"
          >
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
              {stat.icon}
              {stat.label}
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent repositories */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
            Recent repositories
          </h2>
          <div className="border border-gray-200 rounded-md divide-y divide-gray-200 dark:border-gray-700 dark:divide-gray-700">
            {recentRepos.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                No repositories yet.
              </div>
            ) : (
              recentRepos.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => onRepoClick?.(repo.fullName)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-blue-600 dark:text-blue-400 truncate">
                      {repo.fullName}
                    </span>
                    {repo.language && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">{repo.language}</span>
                    )}
                  </div>
                  {repo.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{repo.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span className="inline-flex items-center gap-0.5">
                      <Star className="h-3 w-3" /> {repo.starsCount}
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <Clock className="h-3 w-3" /> {relativeTime(repo.updatedAt)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
            Recent activity
          </h2>
          <div className="border border-gray-200 rounded-md dark:border-gray-700">
            {recentActivity.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                No recent activity.
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {recentActivity.map((activity) => (
                  <li key={activity.id} className="px-4 py-3 flex items-start gap-3">
                    {activityIcons[activity.type] || <Activity className="h-4 w-4 text-gray-400" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="font-medium">{activity.actor.displayName}</span>{' '}
                        {activity.message}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-mono">{activity.repo}</span>
                        <span>{relativeTime(activity.timestamp)}</span>
                      </div>
                    </div>
                    <img
                      src={activity.actor.avatarUrl}
                      alt=""
                      className="h-6 w-6 rounded-full shrink-0"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
