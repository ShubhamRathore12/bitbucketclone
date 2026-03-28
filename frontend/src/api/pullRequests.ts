import { apiClient } from "./client";
import type { ApiResponse, PaginatedResponse } from "@/types/common";
import type {
  PullRequest,
  CreatePRRequest,
  UpdatePRRequest,
  MergePRRequest,
  PRComment,
  CreatePRCommentRequest,
  UpdatePRCommentRequest,
  PRDiff,
  AIReviewStatus,
  ListPRsParams,
} from "@/types/pullRequests";

const prBase = (ws: string, repo: string) =>
  `/repositories/${ws}/${repo}/pull-requests`;

export async function listPullRequests(
  workspaceSlug: string,
  repoSlug: string,
  params?: ListPRsParams,
): Promise<PaginatedResponse<PullRequest>> {
  const { data } = await apiClient.get<PaginatedResponse<PullRequest>>(
    prBase(workspaceSlug, repoSlug),
    { params },
  );
  return data;
}

export async function createPullRequest(
  workspaceSlug: string,
  repoSlug: string,
  payload: CreatePRRequest,
): Promise<PullRequest> {
  const { data } = await apiClient.post<ApiResponse<PullRequest>>(
    prBase(workspaceSlug, repoSlug),
    payload,
  );
  return data.data;
}

export async function getPullRequest(
  workspaceSlug: string,
  repoSlug: string,
  prId: number,
): Promise<PullRequest> {
  const { data } = await apiClient.get<ApiResponse<PullRequest>>(
    `${prBase(workspaceSlug, repoSlug)}/${prId}`,
  );
  return data.data;
}

export async function updatePullRequest(
  workspaceSlug: string,
  repoSlug: string,
  prId: number,
  payload: UpdatePRRequest,
): Promise<PullRequest> {
  const { data } = await apiClient.put<ApiResponse<PullRequest>>(
    `${prBase(workspaceSlug, repoSlug)}/${prId}`,
    payload,
  );
  return data.data;
}

export async function mergePullRequest(
  workspaceSlug: string,
  repoSlug: string,
  prId: number,
  payload?: MergePRRequest,
): Promise<PullRequest> {
  const { data } = await apiClient.post<ApiResponse<PullRequest>>(
    `${prBase(workspaceSlug, repoSlug)}/${prId}/merge`,
    payload,
  );
  return data.data;
}

export async function declinePullRequest(
  workspaceSlug: string,
  repoSlug: string,
  prId: number,
): Promise<PullRequest> {
  const { data } = await apiClient.post<ApiResponse<PullRequest>>(
    `${prBase(workspaceSlug, repoSlug)}/${prId}/decline`,
  );
  return data.data;
}

export async function approvePullRequest(
  workspaceSlug: string,
  repoSlug: string,
  prId: number,
): Promise<void> {
  await apiClient.post(`${prBase(workspaceSlug, repoSlug)}/${prId}/approve`);
}

export async function unapprovePullRequest(
  workspaceSlug: string,
  repoSlug: string,
  prId: number,
): Promise<void> {
  await apiClient.delete(`${prBase(workspaceSlug, repoSlug)}/${prId}/approve`);
}

export async function getDiff(
  workspaceSlug: string,
  repoSlug: string,
  prId: number,
): Promise<PRDiff> {
  const { data } = await apiClient.get<ApiResponse<PRDiff>>(
    `${prBase(workspaceSlug, repoSlug)}/${prId}/diff`,
  );
  return data.data;
}

// --- Comments ---

export async function listComments(
  workspaceSlug: string,
  repoSlug: string,
  prId: number,
  params?: { page?: number; pageSize?: number },
): Promise<PaginatedResponse<PRComment>> {
  const { data } = await apiClient.get<PaginatedResponse<PRComment>>(
    `${prBase(workspaceSlug, repoSlug)}/${prId}/comments`,
    { params },
  );
  return data;
}

export async function createComment(
  workspaceSlug: string,
  repoSlug: string,
  prId: number,
  payload: CreatePRCommentRequest,
): Promise<PRComment> {
  const { data } = await apiClient.post<ApiResponse<PRComment>>(
    `${prBase(workspaceSlug, repoSlug)}/${prId}/comments`,
    payload,
  );
  return data.data;
}

export async function updateComment(
  workspaceSlug: string,
  repoSlug: string,
  prId: number,
  commentId: number,
  payload: UpdatePRCommentRequest,
): Promise<PRComment> {
  const { data } = await apiClient.put<ApiResponse<PRComment>>(
    `${prBase(workspaceSlug, repoSlug)}/${prId}/comments/${commentId}`,
    payload,
  );
  return data.data;
}

export async function deleteComment(
  workspaceSlug: string,
  repoSlug: string,
  prId: number,
  commentId: number,
): Promise<void> {
  await apiClient.delete(
    `${prBase(workspaceSlug, repoSlug)}/${prId}/comments/${commentId}`,
  );
}

export async function resolveComment(
  workspaceSlug: string,
  repoSlug: string,
  prId: number,
  commentId: number,
  resolved: boolean,
): Promise<PRComment> {
  const { data } = await apiClient.put<ApiResponse<PRComment>>(
    `${prBase(workspaceSlug, repoSlug)}/${prId}/comments/${commentId}/resolve`,
    { resolved },
  );
  return data.data;
}

// --- AI Review ---

export async function requestAIReview(
  workspaceSlug: string,
  repoSlug: string,
  prId: number,
): Promise<AIReviewStatus> {
  const { data } = await apiClient.post<ApiResponse<AIReviewStatus>>(
    `${prBase(workspaceSlug, repoSlug)}/${prId}/ai-review`,
  );
  return data.data;
}

export async function getAIReviewStatus(
  workspaceSlug: string,
  repoSlug: string,
  prId: number,
  reviewId: string,
): Promise<AIReviewStatus> {
  const { data } = await apiClient.get<ApiResponse<AIReviewStatus>>(
    `${prBase(workspaceSlug, repoSlug)}/${prId}/ai-review/${reviewId}`,
  );
  return data.data;
}
