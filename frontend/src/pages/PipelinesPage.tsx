import React from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Workflow,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  GitBranch,
  GitCommitHorizontal,
  Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import type { PaginatedResponse, ApiError } from '@/types/common';

// ---------------------------------------------------------------------------
// Pipeline types
// ---------------------------------------------------------------------------

type PipelineState = 'pending' | 'running' | 'successful' | 'failed' | 'stopped' | 'paused';

interface Pipeline {
  id: string;
  number: number;
  state: PipelineState;
  trigger: { type: 'push' | 'manual' | 'schedule' | 'pr'; name: string };
  target: { branch: string; commit: { hash: string; message: string } };
  creator: { id: string; displayName: string; avatarUrl: string };
  duration: number; // seconds
  createdAt: string;
  completedAt?: string;
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

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`} />;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
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

const stateConfig: Record<PipelineState, { icon: React.ReactNode; color: 'green' | 'red' | 'blue' | 'yellow' | 'gray' }> = {
  successful: { icon: <CheckCircle2 className="h-4 w-4" />, color: 'green' },
  failed: { icon: <XCircle className="h-4 w-4" />, color: 'red' },
  running: { icon: <Loader2 className="h-4 w-4 animate-spin" />, color: 'blue' },
  pending: { icon: <Clock className="h-4 w-4" />, color: 'yellow' },
  stopped: { icon: <XCircle className="h-4 w-4" />, color: 'gray' },
  paused: { icon: <Clock className="h-4 w-4" />, color: 'yellow' },
};

// ---------------------------------------------------------------------------
// PipelinesPage
// ---------------------------------------------------------------------------

export default function PipelinesPage() {
  const { workspace, repo } = useParams<{ workspace: string; repo: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1', 10);

  const pipelinesQuery = useQuery<PaginatedResponse<Pipeline>>({
    queryKey: ['pipelines', workspace, repo, page],
    queryFn: () =>
      fetchJson(
        `/api/repositories/${workspace}/${repo}/pipelines?page=${page}&pageSize=20`
      ),
    enabled: !!workspace && !!repo,
    refetchInterval: 10000, // Refresh every 10s for live status
  });

  const triggerMutation = useMutation({
    mutationFn: () =>
      postJson(`/api/repositories/${workspace}/${repo}/pipelines`, {
        target: { type: 'branch', selector: 'main' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines', workspace, repo] });
    },
  });

  const handlePageChange = (p: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(p));
    setSearchParams(params);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Workflow className="h-5 w-5 text-gray-400" />
          Pipelines
          {pipelinesQuery.data && (
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              ({pipelinesQuery.data.totalItems})
            </span>
          )}
        </h2>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Play className="h-4 w-4" />}
          loading={triggerMutation.isPending}
          onClick={() => triggerMutation.mutate()}
        >
          Run pipeline
        </Button>
      </div>

      {/* Pipeline list */}
      {pipelinesQuery.isLoading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-4 flex items-center gap-4">
              <Skeleton className="h-6 w-6 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ) : pipelinesQuery.isError ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-10 text-center">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Failed to load pipelines.</p>
        </div>
      ) : !pipelinesQuery.data?.data.length ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-10 text-center">
          <Workflow className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="text-gray-900 dark:text-white font-medium mb-1">No pipelines</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Configure your bitbucket-pipelines.yml to get started.
          </p>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Play className="h-4 w-4" />}
            onClick={() => triggerMutation.mutate()}
          >
            Run pipeline
          </Button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
          {pipelinesQuery.data.data.map((pipeline) => {
            const sc = stateConfig[pipeline.state];
            return (
              <Link
                key={pipeline.id}
                to={`/${workspace}/${repo}/pipelines/${pipeline.number}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <span className={`shrink-0 text-${sc.color}-500`}>{sc.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      #{pipeline.number}
                    </span>
                    <Badge color={sc.color} size="sm">
                      {pipeline.state}
                    </Badge>
                    <Badge color="gray" size="sm">{pipeline.trigger.type}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      {pipeline.target.branch}
                    </span>
                    <span className="flex items-center gap-1">
                      <GitCommitHorizontal className="h-3 w-3" />
                      {pipeline.target.commit.hash.slice(0, 7)}
                    </span>
                    <span className="truncate max-w-xs">
                      {pipeline.target.commit.message}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-xs text-gray-500 dark:text-gray-400">
                  {pipeline.duration > 0 && (
                    <span className="flex items-center gap-1">
                      <Timer className="h-3 w-3" />
                      {formatDuration(pipeline.duration)}
                    </span>
                  )}
                  <span>{relativeTime(pipeline.createdAt)}</span>
                  <Avatar
                    src={pipeline.creator.avatarUrl}
                    name={pipeline.creator.displayName}
                    size="xs"
                  />
                  <ChevronRight className="h-4 w-4 text-gray-300" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pipelinesQuery.data && pipelinesQuery.data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={!pipelinesQuery.data.hasPrevious}
            onClick={() => handlePageChange(page - 1)}
            leftIcon={<ChevronLeft className="h-4 w-4" />}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-500 dark:text-gray-400 px-3">
            Page {pipelinesQuery.data.page} of {pipelinesQuery.data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!pipelinesQuery.data.hasNext}
            onClick={() => handlePageChange(page + 1)}
            rightIcon={<ChevronRight className="h-4 w-4" />}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
