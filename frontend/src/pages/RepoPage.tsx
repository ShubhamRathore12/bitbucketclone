import React, { useState } from 'react';
import { useParams, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Code2,
  GitCommitHorizontal,
  GitBranch,
  GitPullRequest,
  AlertCircle,
  Workflow,
  BookOpen,
  Settings,
  Star,
  Eye,
  GitFork,
  Lock,
  Globe,
  Copy,
  Check,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { Repository } from '@/types/repo';

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
// Tab configuration
// ---------------------------------------------------------------------------

interface TabDef {
  label: string;
  path: string;
  icon: React.ReactNode;
  count?: number;
}

// ---------------------------------------------------------------------------
// RepoPage
// ---------------------------------------------------------------------------

export default function RepoPage() {
  const { workspace, repo: repoSlug } = useParams<{ workspace: string; repo: string }>();
  const navigate = useNavigate();
  const [cloneUrl, setCloneUrl] = useState<'ssh' | 'https'>('https');
  const [copied, setCopied] = useState(false);
  const [showClone, setShowClone] = useState(false);

  const repoQuery = useQuery<Repository>({
    queryKey: ['repo', workspace, repoSlug],
    queryFn: () => fetchJson(`/api/repositories/${workspace}/${repoSlug}`),
    enabled: !!workspace && !!repoSlug,
  });

  const repoData = repoQuery.data;

  const basePath = `/${workspace}/${repoSlug}`;

  const tabs: TabDef[] = [
    { label: 'Source', path: `${basePath}/src`, icon: <Code2 className="h-4 w-4" /> },
    { label: 'Commits', path: `${basePath}/commits`, icon: <GitCommitHorizontal className="h-4 w-4" /> },
    { label: 'Branches', path: `${basePath}/branches`, icon: <GitBranch className="h-4 w-4" /> },
    {
      label: 'Pull Requests',
      path: `${basePath}/pull-requests`,
      icon: <GitPullRequest className="h-4 w-4" />,
      count: repoData?.openPRCount,
    },
    {
      label: 'Issues',
      path: `${basePath}/issues`,
      icon: <AlertCircle className="h-4 w-4" />,
      count: repoData?.openIssueCount,
    },
    { label: 'Pipelines', path: `${basePath}/pipelines`, icon: <Workflow className="h-4 w-4" /> },
    { label: 'Wiki', path: `${basePath}/wiki`, icon: <BookOpen className="h-4 w-4" /> },
    { label: 'Settings', path: `${basePath}/settings`, icon: <Settings className="h-4 w-4" /> },
  ];

  const httpsUrl = `https://bitbucket.org/${workspace}/${repoSlug}.git`;
  const sshUrl = `git@bitbucket.org:${workspace}/${repoSlug}.git`;
  const displayUrl = cloneUrl === 'https' ? httpsUrl : sshUrl;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (repoQuery.isError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Repository not found
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            The repository &ldquo;{workspace}/{repoSlug}&rdquo; does not exist or you do not have
            access.
          </p>
          <Button variant="primary" onClick={() => navigate('/')}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Repo header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top row */}
          <div className="py-4">
            {repoQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-7 w-64" />
                <Skeleton className="h-4 w-96" />
              </div>
            ) : repoData ? (
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="min-w-0">
                  {/* Name + visibility */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                      <span className="text-gray-500 dark:text-gray-400 font-normal">
                        {workspace} /{' '}
                      </span>
                      {repoData.name}
                    </h1>
                    {repoData.isPrivate ? (
                      <Badge color="gray" size="sm">
                        <Lock className="h-3 w-3 mr-1" />
                        Private
                      </Badge>
                    ) : (
                      <Badge color="blue" size="sm">
                        <Globe className="h-3 w-3 mr-1" />
                        Public
                      </Badge>
                    )}
                    {repoData.isFork && repoData.forkedFrom && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Forked from{' '}
                        <Link
                          to={`/${repoData.forkedFrom.fullName}`}
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {repoData.forkedFrom.fullName}
                        </Link>
                      </span>
                    )}
                  </div>

                  {repoData.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
                      {repoData.description}
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" leftIcon={<Star className="h-4 w-4" />}>
                    Star
                    {repoData.starCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-full">
                        {repoData.starCount}
                      </span>
                    )}
                  </Button>
                  <Button variant="outline" size="sm" leftIcon={<Eye className="h-4 w-4" />}>
                    Watch
                  </Button>
                  <Button variant="outline" size="sm" leftIcon={<GitFork className="h-4 w-4" />}>
                    Fork
                    {repoData.forkCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-full">
                        {repoData.forkCount}
                      </span>
                    )}
                  </Button>

                  {/* Clone dropdown */}
                  <div className="relative">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setShowClone((prev) => !prev)}
                      rightIcon={<ChevronDown className="h-3 w-3" />}
                    >
                      Clone
                    </Button>
                    {showClone && (
                      <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 z-50">
                        <div className="flex items-center gap-2 mb-3">
                          <button
                            type="button"
                            onClick={() => setCloneUrl('https')}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors cursor-pointer ${
                              cloneUrl === 'https'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            HTTPS
                          </button>
                          <button
                            type="button"
                            onClick={() => setCloneUrl('ssh')}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors cursor-pointer ${
                              cloneUrl === 'ssh'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            SSH
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 truncate select-all">
                            {displayUrl}
                          </code>
                          <Button variant="ghost" size="sm" onClick={handleCopy}>
                            {copied ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Tab navigation */}
          <nav className="flex overflow-x-auto -mb-px" aria-label="Repository navigation">
            {tabs.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.label === 'Source'}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
                    isActive
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600',
                  ].join(' ')
                }
              >
                {tab.icon}
                {tab.label}
                {tab.count != null && tab.count > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-full">
                    {tab.count}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* Child route content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet context={{ repository: repoData, isLoading: repoQuery.isLoading }} />
      </div>
    </div>
  );
}

// Re-export a typed hook for child pages
import { useOutletContext } from 'react-router-dom';
export function useRepoContext() {
  return useOutletContext<{ repository: Repository | undefined; isLoading: boolean }>();
}
