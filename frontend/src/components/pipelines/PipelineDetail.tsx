import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  StopCircle,
  PauseCircle,
  SkipForward,
  GitBranch,
  GitCommit,
  Timer,
  Play,
  Square,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { PipelineRun, PipelineStep, PipelineStatus } from '@/types/pipelines';
import Button from '@/components/ui/Button';
import StepLog from './StepLog';

interface PipelineDetailProps {
  repoFullName: string;
  pipelineId: string;
}

async function fetchPipeline(repoFullName: string, pipelineId: string): Promise<PipelineRun> {
  const res = await fetch(`/api/repositories/${repoFullName}/pipelines/${pipelineId}`);
  if (!res.ok) throw new Error('Failed to fetch pipeline');
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

const statusConfig: Record<PipelineStatus, { icon: React.ReactNode; color: string; bg: string }> = {
  pending: { icon: <Clock className="h-5 w-5" />, color: 'text-yellow-500', bg: 'bg-yellow-500' },
  running: { icon: <Loader2 className="h-5 w-5 animate-spin" />, color: 'text-blue-500', bg: 'bg-blue-500' },
  successful: { icon: <CheckCircle2 className="h-5 w-5" />, color: 'text-green-500', bg: 'bg-green-500' },
  failed: { icon: <XCircle className="h-5 w-5" />, color: 'text-red-500', bg: 'bg-red-500' },
  stopped: { icon: <StopCircle className="h-5 w-5" />, color: 'text-gray-500', bg: 'bg-gray-500' },
  paused: { icon: <PauseCircle className="h-5 w-5" />, color: 'text-yellow-600', bg: 'bg-yellow-600' },
  skipped: { icon: <SkipForward className="h-5 w-5" />, color: 'text-gray-400', bg: 'bg-gray-400' },
};

export default function PipelineDetail({ repoFullName, pipelineId }: PipelineDetailProps) {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: pipeline, isLoading, isError, error } = useQuery({
    queryKey: ['pipeline', repoFullName, pipelineId],
    queryFn: () => fetchPipeline(repoFullName, pipelineId),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data && (data.status === 'running' || data.status === 'pending') ? 5000 : false;
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/repositories/${repoFullName}/pipelines/${pipelineId}/stop`,
        { method: 'POST' }
      );
      if (!res.ok) throw new Error('Failed to stop pipeline');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', repoFullName, pipelineId] });
    },
  });

  const rerunMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/repositories/${repoFullName}/pipelines/${pipelineId}/rerun`,
        { method: 'POST' }
      );
      if (!res.ok) throw new Error('Failed to rerun pipeline');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines', repoFullName] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (isError || !pipeline) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md dark:bg-red-900/20 dark:border-red-800">
        <AlertCircle className="h-5 w-5 text-red-500" />
        <p className="text-sm text-red-700 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load pipeline'}
        </p>
      </div>
    );
  }

  const overallStatus = statusConfig[pipeline.status];
  const selectedStep = selectedStepId
    ? pipeline.steps.find((s) => s.id === selectedStepId)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className={overallStatus.color}>{overallStatus.icon}</span>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Pipeline #{pipeline.number}
            </h1>
            <span className={[
              'px-2 py-0.5 text-sm rounded capitalize',
              overallStatus.color,
            ].join(' ')}>
              {pipeline.status}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1">
              <GitBranch className="h-4 w-4" />
              {pipeline.branch}
            </span>
            <span className="inline-flex items-center gap-1">
              <GitCommit className="h-4 w-4" />
              <code>{pipeline.commit.hash.substring(0, 7)}</code>
              <span className="truncate max-w-[300px]">{pipeline.commit.message}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Timer className="h-4 w-4" />
              {formatDuration(pipeline.durationSeconds)}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {(pipeline.status === 'running' || pipeline.status === 'pending') && (
            <Button
              variant="danger"
              size="sm"
              loading={stopMutation.isPending}
              onClick={() => stopMutation.mutate()}
              leftIcon={<Square className="h-3.5 w-3.5" />}
            >
              Stop
            </Button>
          )}
          {(pipeline.status === 'failed' || pipeline.status === 'stopped' || pipeline.status === 'successful') && (
            <Button
              variant="outline"
              size="sm"
              loading={rerunMutation.isPending}
              onClick={() => rerunMutation.mutate()}
              leftIcon={<Play className="h-3.5 w-3.5" />}
            >
              Rerun
            </Button>
          )}
        </div>
      </div>

      {/* Steps timeline */}
      <div className="flex gap-6">
        <div className="w-72 shrink-0">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Steps</h2>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

            <ul className="space-y-1 relative">
              {pipeline.steps.map((step, i) => {
                const stepStatus = statusConfig[step.status];
                const isSelected = selectedStepId === step.id;
                return (
                  <li key={step.id}>
                    <button
                      onClick={() => setSelectedStepId(step.id)}
                      className={[
                        'w-full text-left flex items-center gap-3 px-3 py-2 rounded-md transition-colors relative',
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800',
                      ].join(' ')}
                    >
                      {/* Status dot */}
                      <span className={[
                        'h-6 w-6 rounded-full flex items-center justify-center shrink-0 z-10 bg-white dark:bg-gray-900 border-2',
                        step.status === 'successful' ? 'border-green-500' :
                        step.status === 'failed' ? 'border-red-500' :
                        step.status === 'running' ? 'border-blue-500' :
                        'border-gray-300 dark:border-gray-600',
                      ].join(' ')}>
                        {step.status === 'successful' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        {step.status === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
                        {step.status === 'running' && <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />}
                        {step.status === 'pending' && <Clock className="h-4 w-4 text-gray-400" />}
                        {step.status === 'stopped' && <StopCircle className="h-4 w-4 text-gray-500" />}
                        {step.status === 'skipped' && <SkipForward className="h-4 w-4 text-gray-400" />}
                        {step.status === 'paused' && <PauseCircle className="h-4 w-4 text-yellow-600" />}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          {step.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {step.durationSeconds > 0 ? formatDuration(step.durationSeconds) : '--'}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Step details / logs */}
        <div className="flex-1 min-w-0">
          {selectedStep ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  {selectedStep.name}
                </h3>
                <span className={[
                  'px-2 py-0.5 text-xs rounded capitalize',
                  statusConfig[selectedStep.status].color,
                ].join(' ')}>
                  {selectedStep.status}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">
                  Image: <code className="text-xs">{selectedStep.image}</code>
                </span>
              </div>
              <StepLog
                repoFullName={repoFullName}
                pipelineId={pipelineId}
                stepId={selectedStep.id}
                isRunning={selectedStep.status === 'running'}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
              <p className="text-sm">Select a step to view its logs</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
