import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  PlayCircle,
  StopCircle,
  PauseCircle,
  SkipForward,
  GitBranch,
  GitCommit,
  User,
  Timer,
  Zap,
  Tag,
  Hand,
  Calendar,
} from 'lucide-react';
import type { PipelineRun, PipelineStatus, PipelineTrigger } from '@/types/pipelines';
import type { PaginatedResponse } from '@/types/common';

interface PipelineListProps {
  repoFullName: string;
  onPipelineClick?: (pipeline: PipelineRun) => void;
}

async function fetchPipelines(
  repoFullName: string,
  page: number
): Promise<PaginatedResponse<PipelineRun>> {
  const res = await fetch(`/api/repositories/${repoFullName}/pipelines?page=${page}&pageSize=25`);
  if (!res.ok) throw new Error('Failed to fetch pipelines');
  return res.json();
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min < 60) return `${min}m ${sec}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
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

const statusConfig: Record<PipelineStatus, { icon: React.ReactNode; color: string }> = {
  pending: { icon: <Clock className="h-4 w-4" />, color: 'text-yellow-500' },
  running: { icon: <Loader2 className="h-4 w-4 animate-spin" />, color: 'text-blue-500' },
  successful: { icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-green-500' },
  failed: { icon: <XCircle className="h-4 w-4" />, color: 'text-red-500' },
  stopped: { icon: <StopCircle className="h-4 w-4" />, color: 'text-gray-500' },
  paused: { icon: <PauseCircle className="h-4 w-4" />, color: 'text-yellow-600' },
  skipped: { icon: <SkipForward className="h-4 w-4" />, color: 'text-gray-400' },
};

const triggerIcons: Record<PipelineTrigger, React.ReactNode> = {
  push: <Zap className="h-3.5 w-3.5" />,
  pull_request: <GitBranch className="h-3.5 w-3.5" />,
  manual: <Hand className="h-3.5 w-3.5" />,
  schedule: <Calendar className="h-3.5 w-3.5" />,
  tag: <Tag className="h-3.5 w-3.5" />,
};

export default function PipelineList({ repoFullName, onPipelineClick }: PipelineListProps) {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['pipelines', repoFullName, page],
    queryFn: () => fetchPipelines(repoFullName, page),
    placeholderData: (prev) => prev,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md dark:bg-red-900/20 dark:border-red-800">
        <AlertCircle className="h-5 w-5 text-red-500" />
        <p className="text-sm text-red-700 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load pipelines'}
        </p>
      </div>
    );
  }

  const pipelines = data?.data ?? [];

  return (
    <div className="space-y-4">
      {pipelines.length === 0 ? (
        <div className="text-center py-12">
          <PlayCircle className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No pipeline runs found.</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-md divide-y divide-gray-200 dark:border-gray-700 dark:divide-gray-700">
          {pipelines.map((pipeline) => {
            const statusInfo = statusConfig[pipeline.status];
            return (
              <button
                key={pipeline.id}
                onClick={() => onPipelineClick?.(pipeline)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex items-center gap-4"
              >
                {/* Status icon */}
                <span className={statusInfo.color}>{statusInfo.icon}</span>

                {/* Pipeline info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      #{pipeline.number}
                    </span>
                    <span className={[
                      'px-1.5 py-0.5 text-xs rounded capitalize',
                      statusInfo.color,
                      pipeline.status === 'successful' ? 'bg-green-50 dark:bg-green-900/20' :
                      pipeline.status === 'failed' ? 'bg-red-50 dark:bg-red-900/20' :
                      pipeline.status === 'running' ? 'bg-blue-50 dark:bg-blue-900/20' :
                      'bg-gray-50 dark:bg-gray-800',
                    ].join(' ')}>
                      {pipeline.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      {pipeline.branch}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <GitCommit className="h-3 w-3" />
                      <code>{pipeline.commit.hash.substring(0, 7)}</code>
                    </span>
                    <span className="truncate max-w-[200px]">{pipeline.commit.message}</span>
                  </div>
                </div>

                {/* Trigger */}
                <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 capitalize shrink-0">
                  {triggerIcons[pipeline.trigger]}
                  {pipeline.trigger.replace('_', ' ')}
                </span>

                {/* Duration */}
                <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 shrink-0 w-16 justify-end">
                  <Timer className="h-3 w-3" />
                  {formatDuration(pipeline.durationSeconds)}
                </span>

                {/* Time */}
                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 w-20 text-right">
                  {relativeTime(pipeline.createdAt)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            disabled={!data.hasPrevious}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50
              hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {page} of {data.totalPages}</span>
          <button
            disabled={!data.hasNext}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50
              hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
