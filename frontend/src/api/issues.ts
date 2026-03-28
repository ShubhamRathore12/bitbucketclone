import { apiClient } from "./client";
import type { ApiResponse, PaginatedResponse } from "@/types/common";
import type {
  Issue,
  CreateIssueRequest,
  UpdateIssueRequest,
  IssueComment,
  CreateIssueCommentRequest,
  Label,
  CreateLabelRequest,
  ListIssuesParams,
} from "@/types/issues";

const issueBase = (ws: string, repo: string) =>
  `/repositories/${ws}/${repo}/issues`;

export async function listIssues(
  workspaceSlug: string,
  repoSlug: string,
  params?: ListIssuesParams,
): Promise<PaginatedResponse<Issue>> {
  const { data } = await apiClient.get<PaginatedResponse<Issue>>(
    issueBase(workspaceSlug, repoSlug),
    { params },
  );
  return data;
}

export async function createIssue(
  workspaceSlug: string,
  repoSlug: string,
  payload: CreateIssueRequest,
): Promise<Issue> {
  const { data } = await apiClient.post<ApiResponse<Issue>>(
    issueBase(workspaceSlug, repoSlug),
    payload,
  );
  return data.data;
}

export async function getIssue(
  workspaceSlug: string,
  repoSlug: string,
  issueId: number,
): Promise<Issue> {
  const { data } = await apiClient.get<ApiResponse<Issue>>(
    `${issueBase(workspaceSlug, repoSlug)}/${issueId}`,
  );
  return data.data;
}

export async function updateIssue(
  workspaceSlug: string,
  repoSlug: string,
  issueId: number,
  payload: UpdateIssueRequest,
): Promise<Issue> {
  const { data } = await apiClient.put<ApiResponse<Issue>>(
    `${issueBase(workspaceSlug, repoSlug)}/${issueId}`,
    payload,
  );
  return data.data;
}

export async function deleteIssue(
  workspaceSlug: string,
  repoSlug: string,
  issueId: number,
): Promise<void> {
  await apiClient.delete(`${issueBase(workspaceSlug, repoSlug)}/${issueId}`);
}

// --- Comments ---

export async function listComments(
  workspaceSlug: string,
  repoSlug: string,
  issueId: number,
  params?: { page?: number; pageSize?: number },
): Promise<PaginatedResponse<IssueComment>> {
  const { data } = await apiClient.get<PaginatedResponse<IssueComment>>(
    `${issueBase(workspaceSlug, repoSlug)}/${issueId}/comments`,
    { params },
  );
  return data;
}

export async function createComment(
  workspaceSlug: string,
  repoSlug: string,
  issueId: number,
  payload: CreateIssueCommentRequest,
): Promise<IssueComment> {
  const { data } = await apiClient.post<ApiResponse<IssueComment>>(
    `${issueBase(workspaceSlug, repoSlug)}/${issueId}/comments`,
    payload,
  );
  return data.data;
}

// --- Labels ---

export async function listLabels(
  workspaceSlug: string,
  repoSlug: string,
): Promise<Label[]> {
  const { data } = await apiClient.get<ApiResponse<Label[]>>(
    `${issueBase(workspaceSlug, repoSlug)}/labels`,
  );
  return data.data;
}

export async function createLabel(
  workspaceSlug: string,
  repoSlug: string,
  payload: CreateLabelRequest,
): Promise<Label> {
  const { data } = await apiClient.post<ApiResponse<Label>>(
    `${issueBase(workspaceSlug, repoSlug)}/labels`,
    payload,
  );
  return data.data;
}
