import type { Timestamps, UserReference } from './common';

export type PipelineRunState = 'pending' | 'running' | 'completed' | 'failed' | 'stopped' | 'skipped';
export type PipelineStepState = 'pending' | 'running' | 'completed' | 'failed' | 'stopped' | 'skipped';

export interface PipelineRun extends Timestamps {
  id: string;
  buildNumber: number;
  state: PipelineRunState;
  trigger: PipelineTrigger;
  target: PipelineTarget;
  duration: number; // seconds
  creator?: UserReference;
  completedAt?: string;
}

export interface PipelineTrigger {
  type: 'push' | 'pull_request' | 'manual' | 'schedule' | 'tag';
  name?: string;
}

export interface PipelineTarget {
  type: 'branch' | 'tag' | 'pull_request';
  refName: string;
  commit: {
    hash: string;
    message: string;
  };
}

export interface PipelineStep {
  id: string;
  name: string;
  state: PipelineStepState;
  duration: number;
  startedAt?: string;
  completedAt?: string;
  logUrl: string;
}

export interface PipelineStepLog {
  stepId: string;
  lines: string[];
  hasMore: boolean;
  nextOffset?: number;
}

export interface PipelineConfig {
  yaml: string;
  path: string;
  lastModified: string;
}

export interface UpdatePipelineConfigRequest {
  yaml: string;
  commitMessage?: string;
}

export interface TriggerPipelineRequest {
  target: {
    type: 'branch' | 'tag';
    refName: string;
  };
  variables?: Record<string, string>;
}

export interface ListPipelineRunsParams {
  state?: PipelineRunState;
  page?: number;
  pageSize?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
}
