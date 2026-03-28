import type { Timestamps, UserReference } from "./common";
import type { CommitSummary, RepositorySummary } from "./repo";

export type PipelineStatus =
  | "pending"
  | "running"
  | "successful"
  | "failed"
  | "stopped"
  | "paused"
  | "skipped";

export type PipelineTrigger = "push" | "pull_request" | "manual" | "schedule" | "tag";

export interface PipelineRun extends Timestamps {
  id: string;
  number: number;
  repository: RepositorySummary;
  status: PipelineStatus;
  trigger: PipelineTrigger;
  triggeredBy: UserReference;
  commit: CommitSummary;
  branch: string;
  tag?: string;
  pullRequestId?: string;
  steps: PipelineStep[];
  durationSeconds: number;
  startedAt?: string;
  completedAt?: string;
}

export interface PipelineStep {
  id: string;
  name: string;
  status: PipelineStatus;
  image: string;
  commands: string[];
  logUrl: string;
  durationSeconds: number;
  startedAt?: string;
  completedAt?: string;
  exitCode?: number;
  artifacts: PipelineArtifact[];
  caches: string[];
  services: PipelineService[];
}

export interface PipelineArtifact {
  name: string;
  path: string;
  size: number;
  downloadUrl: string;
}

export interface PipelineService {
  name: string;
  image: string;
  variables: Record<string, string>;
}

export interface PipelineConfig {
  image: string;
  pipelines: {
    default?: PipelineStepConfig[];
    branches?: Record<string, PipelineStepConfig[]>;
    tags?: Record<string, PipelineStepConfig[]>;
    pullRequests?: Record<string, PipelineStepConfig[]>;
    custom?: Record<string, PipelineCustomConfig>;
  };
  definitions?: {
    caches?: Record<string, string>;
    services?: Record<string, PipelineServiceConfig>;
  };
  options?: PipelineOptions;
}

export interface PipelineStepConfig {
  step: {
    name: string;
    image?: string;
    script: string[];
    caches?: string[];
    services?: string[];
    artifacts?: {
      paths: string[];
    };
    afterScript?: string[];
    condition?: {
      changesets: {
        includePaths: string[];
      };
    };
  };
}

export interface PipelineCustomConfig {
  variables?: PipelineVariable[];
  steps: PipelineStepConfig[];
}

export interface PipelineVariable {
  name: string;
  default?: string;
  allowedValues?: string[];
}

export interface PipelineServiceConfig {
  image: string;
  variables?: Record<string, string>;
  memory?: number;
}

export interface PipelineOptions {
  maxTime?: number;
  size?: "1x" | "2x";
  docker?: boolean;
}

export interface PipelineLog {
  stepId: string;
  lines: PipelineLogLine[];
  isComplete: boolean;
}

export interface PipelineLogLine {
  lineNumber: number;
  timestamp: string;
  content: string;
  stream: "stdout" | "stderr";
}

export interface TriggerPipelineRequest {
  branch: string;
  custom?: string;
  variables?: Record<string, string>;
}
