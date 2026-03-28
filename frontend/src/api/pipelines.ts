import { apiClient } from "./client";
import type { ApiResponse, PaginatedResponse } from "@/types/common";
import type {
  PipelineRun,
  PipelineStep,
  PipelineStepLog,
  PipelineConfig,
  UpdatePipelineConfigRequest,
  TriggerPipelineRequest,
  ListPipelineRunsParams,
} from "@/types/pipelines";

const pipeBase = (ws: string, repo: string) =>
  `/repositories/${ws}/${repo}/pipelines`;

export async function listRuns(
  workspaceSlug: string,
  repoSlug: string,
  params?: ListPipelineRunsParams,
): Promise<PaginatedResponse<PipelineRun>> {
  const { data } = await apiClient.get<PaginatedResponse<PipelineRun>>(
    pipeBase(workspaceSlug, repoSlug),
    { params },
  );
  return data;
}

export async function triggerRun(
  workspaceSlug: string,
  repoSlug: string,
  payload: TriggerPipelineRequest,
): Promise<PipelineRun> {
  const { data } = await apiClient.post<ApiResponse<PipelineRun>>(
    pipeBase(workspaceSlug, repoSlug),
    payload,
  );
  return data.data;
}

export async function getRun(
  workspaceSlug: string,
  repoSlug: string,
  runId: string,
): Promise<PipelineRun> {
  const { data } = await apiClient.get<ApiResponse<PipelineRun>>(
    `${pipeBase(workspaceSlug, repoSlug)}/${runId}`,
  );
  return data.data;
}

export async function stopRun(
  workspaceSlug: string,
  repoSlug: string,
  runId: string,
): Promise<void> {
  await apiClient.post(`${pipeBase(workspaceSlug, repoSlug)}/${runId}/stop`);
}

export async function listSteps(
  workspaceSlug: string,
  repoSlug: string,
  runId: string,
): Promise<PipelineStep[]> {
  const { data } = await apiClient.get<ApiResponse<PipelineStep[]>>(
    `${pipeBase(workspaceSlug, repoSlug)}/${runId}/steps`,
  );
  return data.data;
}

export async function getStepLog(
  workspaceSlug: string,
  repoSlug: string,
  runId: string,
  stepId: string,
  params?: { offset?: number; limit?: number },
): Promise<PipelineStepLog> {
  const { data } = await apiClient.get<ApiResponse<PipelineStepLog>>(
    `${pipeBase(workspaceSlug, repoSlug)}/${runId}/steps/${stepId}/log`,
    { params },
  );
  return data.data;
}

export async function getConfig(
  workspaceSlug: string,
  repoSlug: string,
): Promise<PipelineConfig> {
  const { data } = await apiClient.get<ApiResponse<PipelineConfig>>(
    `${pipeBase(workspaceSlug, repoSlug)}/config`,
  );
  return data.data;
}

export async function updateConfig(
  workspaceSlug: string,
  repoSlug: string,
  payload: UpdatePipelineConfigRequest,
): Promise<PipelineConfig> {
  const { data } = await apiClient.put<ApiResponse<PipelineConfig>>(
    `${pipeBase(workspaceSlug, repoSlug)}/config`,
    payload,
  );
  return data.data;
}
