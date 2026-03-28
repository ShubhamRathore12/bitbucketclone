import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Settings,
  Users,
  FolderGit2,
  AlertCircle,
  Star,
  Lock,
  Globe,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import type { Workspace, Repository } from '@/types/repo';
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

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`} />;
}

// ---------------------------------------------------------------------------
// WorkspacePage
// ---------------------------------------------------------------------------

export default function WorkspacePage() {
  const { workspace: workspaceSlug } = useParams<{ workspace: string }>();
  const navigate = useNavigate();
  const [repoSearch, setRepoSearch] = useState('');

  // Workspace details
  const wsQuery = useQuery<Workspace>({
    queryKey: ['workspace', workspaceSlug],
    queryFn: () => fetchJson(`/api/workspaces/${workspaceSlug}`),
    enabled: !!workspaceSlug,
  });

  // Repositories in this workspace
  const reposQuery = useQuery<PaginatedResponse<Repository>>({
    queryKey: ['workspace', workspaceSlug, 'repos', repoSearch],
    queryFn: () =>
      fetchJson(
        `/api/workspaces/${workspaceSlug}/repositories?pageSize=50&query=${encodeURIComponent(repoSearch)}`
      ),
    enabled: !!workspaceSlug,
  });

  const ws = wsQuery.data;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (wsQuery.isError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Workspace not found
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            The workspace &ldquo;{workspaceSlug}&rdquo; does not exist or you do not have access.
          </p>
          <Button variant="primary" onClick={() => navigate('/')}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Workspace header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
          {wsQuery.isLoading ? (
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-lg" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-72" />
              </div>
            </div>
          ) : ws ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <Avatar src={ws.avatarUrl} name={ws.name} size="xl" shape="square" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white truncate">
                    {ws.name}
                  </h1>
                  {ws.isPersonal && <Badge color="blue">Personal</Badge>}
                </div>
                {ws.description && (
                  <p className="text-gray-500 dark:text-gray-400 mt-1">{ws.description}</p>
                )}
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {ws.memberCount} member{ws.memberCount !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <FolderGit2 className="h-4 w-4" />
                    {reposQuery.data?.totalItems ?? '...'} repositories
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={() => navigate(`/${workspaceSlug}/repo/create`)}
                >
                  New repository
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/${workspaceSlug}/settings`)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Search + repo list */}
        <div className="mb-4">
          <Input
            placeholder="Search repositories..."
            value={repoSearch}
            onChange={(e) => setRepoSearch(e.target.value)}
            prefixIcon={<Search className="h-4 w-4" />}
            inputSize="md"
            wrapperClassName="max-w-md"
          />
        </div>

        {reposQuery.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3.5 w-full" />
                <div className="flex gap-3">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : reposQuery.isError ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-10 text-center">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Failed to load repositories.</p>
          </div>
        ) : !reposQuery.data?.data.length ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-10 text-center">
            <FolderGit2 className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <h3 className="text-gray-900 dark:text-white font-medium mb-1">
              {repoSearch ? 'No matching repositories' : 'No repositories yet'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {repoSearch
                ? 'Try a different search term.'
                : 'Create your first repository to get started.'}
            </p>
            {!repoSearch && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => navigate(`/${workspaceSlug}/repo/create`)}
              >
                Create repository
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reposQuery.data.data.map((repo) => (
              <Link
                key={repo.id}
                to={`/${workspaceSlug}/${repo.slug}`}
                className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 group-hover:underline truncate">
                        {repo.name}
                      </h3>
                      {repo.isPrivate ? (
                        <Lock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      ) : (
                        <Globe className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      )}
                      {repo.isFork && <Badge color="gray" size="sm">Fork</Badge>}
                    </div>
                    {repo.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {repo.description}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600 shrink-0 mt-0.5" />
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                  {repo.language && (
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block" />
                      {repo.language}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3" /> {repo.starCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <FolderGit2 className="h-3 w-3" /> {repo.forkCount}
                  </span>
                  <span>Updated {new Date(repo.updatedAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
