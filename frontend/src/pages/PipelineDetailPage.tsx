import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  Square,
  RotateCw,
  GitBranch,
  GitCommitHorizontal,
  Timer,
  Terminal,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PipelineState = 'pending' | 'running' | 'successful' | 'failed' | 'stopped' | 'paused';
type StepState = 'pending' | 'running' | 'successful' | 'failed' | 'stopped' | 'not_run';

interface PipelineDetail {
  id: string;
  number: number;
  state: PipelineState;
  trigger: { type: string; name: string };
  target: { branch: string; commit: { hash: string; message: string; author: string } };
  creator: { id: string; displayName: string; avatarUrl: string };
  duration: number;
  createdAt: string;
  completedAt?: string;
  stages: PipelineStage[];
}

interface PipelineStage {
  name: string;
  steps: PipelineStep[];
}

interface PipelineStep {
  id: string;
  name: string;
  state: StepState;
  duration: number;
  startedAt?: string;
  completedAt?: string;
  image: string;
  script: string[];
  logUrl: string;
}

interface StepLog {
  stepId: string;
  lines: LogLine[];
}

interface LogLine {
  number: number;
  content: string;
  timestamp: string;
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

function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`} style={style} />;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

const stepStateConfig: Record<StepState, { icon: React.ReactNode }> = {
  successful: { icon: <CheckCircle2 className="h-4 w-4 text-green-500" /> },
  failed: { icon: <XCircle className="h-4 w-4 text-red-500" /> },
  running: { icon: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" /> },
  pending: { icon: <Clock className="h-4 w-4 text-gray-400" /> },
  stopped: { icon: <Square className="h-4 w-4 text-gray-400" /> },
  not_run: { icon: <Clock className="h-4 w-4 text-gray-300" /> },
};

const pipelineStateConfig: Record<PipelineState, { color: 'green' | 'red' | 'blue' | 'yellow' | 'gray'; icon: React.ReactNode }> = {
  successful: { color: 'green', icon: <CheckCircle2 className="h-6 w-6" /> },
  failed: { color: 'red', icon: <XCircle className="h-6 w-6" /> },
  running: { color: 'blue', icon: <Loader2 className="h-6 w-6 animate-spin" /> },
  pending: { color: 'yellow', icon: <Clock className="h-6 w-6" /> },
  stopped: { color: 'gray', icon: <Square className="h-6 w-6" /> },
  paused: { color: 'yellow', icon: <Clock className="h-6 w-6" /> },
};

// ---------------------------------------------------------------------------
// PipelineDetailPage
// ---------------------------------------------------------------------------

export default function PipelineDetailPage() {
  const { workspace, repo, pipelineId } = useParams<{
    workspace: string;
    repo: string;
    pipelineId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const basePath = `/api/repositories/${workspace}/${repo}/pipelines/${pipelineId}`;

  const pipelineQuery = useQuery<PipelineDetail>({
    queryKey: ['pipeline', workspace, repo, pipelineId],
    queryFn: () => fetchJson(basePath),
    enabled: !!workspace && !!repo && !!pipelineId,
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state === 'running' || state === 'pending' ? 5000 : false;
    },
  });

  const logQuery = useQuery<StepLog>({
    queryKey: ['step-log', workspace, repo, pipelineId, selectedStepId],
    queryFn: () => fetchJson(`${basePath}/steps/${selectedStepId}/log`),
    enabled: !!selectedStepId,
    refetchInterval: () => {
      const step = pipelineQuery.data?.stages
        .flatMap((s) => s.steps)
        .find((s) => s.id === selectedStepId);
      return step?.state === 'running' ? 3000 : false;
    },
  });

  const rerunMutation = useMutation({
    mutationFn: () => postJson(`${basePath}/rerun`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipeline', workspace, repo, pipelineId] }),
  });

  const stopMutation = useMutation({
    mutationFn: () => postJson(`${basePath}/stop`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipeline', workspace, repo, pipelineId] }),
  });

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logQuery.data]);

  useEffect(() => {
    if (pipelineQuery.data && !selectedStepId) {
      const allSteps = pipelineQuery.data.stages.flatMap((s) => s.steps);
      const target = allSteps.find((s) => s.state === 'failed' || s.state === 'running');
      setSelectedStepId(target?.id || allSteps[0]?.id || null);
    }
  }, [pipelineQuery.data, selectedStepId]);

  const pipeline = pipelineQuery.data;

  if (pipelineQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (pipelineQuery.isError || !pipeline) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Pipeline not found
        </h2>
        <Button variant="primary" onClick={() => navigate(`/${workspace}/${repo}/pipelines`)}>
          Back to pipelines
        </Button>
      </div>
    );
  }

  const sc = pipelineStateConfig[pipeline.state];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-3">
          <span className={`text-${sc.color}-500 mt-0.5`}>{sc.icon}</span>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Pipeline #{pipeline.number}
            </h1>
            <div className="flex items-center gap-3 mt-1 text-sm flex-wrap">
              <Badge color={sc.color}>{pipeline.state}</Badge>
              <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                <GitBranch className="h-3.5 w-3.5" /> {pipeline.target.branch}
              </span>
              <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                <GitCommitHorizontal className="h-3.5 w-3.5" />
                {pipeline.target.commit.hash.slice(0, 7)} - {pipeline.target.commit.message}
              </span>
              {pipeline.duration > 0 && (
                <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                  <Timer className="h-3.5 w-3.5" /> {formatDuration(pipeline.duration)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(pipeline.state === 'running' || pipeline.state === 'pending') && (
            <Button variant="danger" size="sm" leftIcon={<Square className="h-4 w-4" />} loading={stopMutation.isPending} onClick={() => stopMutation.mutate()}>
              Stop
            </Button>
          )}
          {(pipeline.state === 'failed' || pipeline.state === 'stopped' || pipeline.state === 'successful') && (
            <Button variant="primary" size="sm" leftIcon={<RotateCw className="h-4 w-4" />} loading={rerunMutation.isPending} onClick={() => rerunMutation.mutate()}>
              Rerun
            </Button>
          )}
        </div>
      </div>

      {/* Steps + Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {pipeline.stages.map((stage) => (
            <div key={stage.name}>
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{stage.name}</h3>
              </div>
              <ul className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {stage.steps.map((step) => (
                  <li key={step.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedStepId(step.id)}
                      className={[
                        'w-full text-left px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer',
                        selectedStepId === step.id
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/30',
                      ].join(' ')}
                    >
                      {stepStateConfig[step.state].icon}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{step.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {step.image}{step.duration > 0 && ` - ${formatDuration(step.duration)}`}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="lg:col-span-2 bg-gray-900 rounded-lg border border-gray-700 overflow-hidden flex flex-col min-h-[400px] max-h-[700px]">
          <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2 bg-gray-800">
            <Terminal className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-300">
              {selectedStepId
                ? pipeline.stages.flatMap((s) => s.steps).find((s) => s.id === selectedStepId)?.name || 'Log output'
                : 'Select a step to view logs'}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
            {!selectedStepId ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>Select a step from the left panel to view its log output.</p>
              </div>
            ) : logQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 bg-gray-700" style={{ width: `${40 + Math.random() * 50}%` }} />
                ))}
              </div>
            ) : logQuery.isError ? (
              <div className="text-red-400 text-center py-8">Failed to load logs.</div>
            ) : !logQuery.data?.lines.length ? (
              <div className="text-gray-500 text-center py-8">No log output yet.</div>
            ) : (
              <>
                {logQuery.data.lines.map((line) => (
                  <div key={line.number} className="flex hover:bg-gray-800/50 py-px">
                    <span className="select-none text-gray-600 w-10 text-right pr-3 shrink-0">{line.number}</span>
                    <span className="text-gray-300 whitespace-pre-wrap break-all">{line.content}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
