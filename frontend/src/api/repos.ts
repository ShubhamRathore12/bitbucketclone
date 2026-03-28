import { apiClient } from "./client";
import type { ApiResponse, PaginatedResponse } from "@/types/common";
import type {
  Repository,
  CreateRepoRequest,
  UpdateRepoRequest,
  ForkRepoRequest,
  Branch,
  CreateBranchRequest,
  Commit,
  CommitDiff,
  SourceEntry,
  FileContent,
  ListReposParams,
} from "@/types/repos";

// --- Repository CRUD ---

export async function listRepos(
  params?: ListReposParams,
): Promise<PaginatedResponse<Repository>> {
  const { data } = await apiClient.get<PaginatedResponse<Repository>>("/repositories", {
    params,
  });
  return data;
}

export async function createRepo(payload: CreateRepoRequest): Promise<Repository> {
  const { data } = await apiClient.post<ApiResponse<Repository>>("/repositories", payload);
  return data.data;
}

export async function getRepo(
  workspaceSlug: string,
  repoSlug: string,
): Promise<Repository> {
  const { data } = await apiClient.get<ApiResponse<Repository>>(
    `/repositories/${workspaceSlug}/${repoSlug}`,
  );
  return data.data;
}

export async function updateRepo(
  workspaceSlug: string,
  repoSlug: string,
  payload: UpdateRepoRequest,
): Promise<Repository> {
  const { data } = await apiClient.put<ApiResponse<Repository>>(
    `/repositories/${workspaceSlug}/${repoSlug}`,
    payload,
  );
  return data.data;
}

export async function deleteRepo(
  workspaceSlug: string,
  repoSlug: string,
): Promise<void> {
  await apiClient.delete(`/repositories/${workspaceSlug}/${repoSlug}`);
}

// --- Forks ---

export async function forkRepo(
  workspaceSlug: string,
  repoSlug: string,
  payload: ForkRepoRequest,
): Promise<Repository> {
  const { data } = await apiClient.post<ApiResponse<Repository>>(
    `/repositories/${workspaceSlug}/${repoSlug}/forks`,
    payload,
  );
  return data.data;
}

export async function listForks(
  workspaceSlug: string,
  repoSlug: string,
  params?: { page?: number; pageSize?: number },
): Promise<PaginatedResponse<Repository>> {
  const { data } = await apiClient.get<PaginatedResponse<Repository>>(
    `/repositories/${workspaceSlug}/${repoSlug}/forks`,
    { params },
  );
  return data;
}

// --- Source browsing ---

export async function browseSource(
  workspaceSlug: string,
  repoSlug: string,
  ref: string,
  path = "",
): Promise<SourceEntry[]> {
  const { data } = await apiClient.get<ApiResponse<SourceEntry[]>>(
    `/repositories/${workspaceSlug}/${repoSlug}/src/${ref}/${path}`,
  );
  return data.data;
}

export async function getRawFile(
  workspaceSlug: string,
  repoSlug: string,
  ref: string,
  path: string,
): Promise<FileContent> {
  const { data } = await apiClient.get<ApiResponse<FileContent>>(
    `/repositories/${workspaceSlug}/${repoSlug}/src/${ref}/${path}`,
    { params: { format: "raw" } },
  );
  return data.data;
}

// --- Commits ---

export async function listCommits(
  workspaceSlug: string,
  repoSlug: string,
  params?: { branch?: string; page?: number; pageSize?: number },
): Promise<PaginatedResponse<Commit>> {
  const { data } = await apiClient.get<PaginatedResponse<Commit>>(
    `/repositories/${workspaceSlug}/${repoSlug}/commits`,
    { params },
  );
  return data;
}

export async function getCommit(
  workspaceSlug: string,
  repoSlug: string,
  commitHash: string,
): Promise<Commit> {
  const { data } = await apiClient.get<ApiResponse<Commit>>(
    `/repositories/${workspaceSlug}/${repoSlug}/commits/${commitHash}`,
  );
  return data.data;
}

export async function getCommitDiff(
  workspaceSlug: string,
  repoSlug: string,
  commitHash: string,
): Promise<CommitDiff> {
  const { data } = await apiClient.get<ApiResponse<CommitDiff>>(
    `/repositories/${workspaceSlug}/${repoSlug}/commits/${commitHash}/diff`,
  );
  return data.data;
}

// --- Branches ---

export async function listBranches(
  workspaceSlug: string,
  repoSlug: string,
  params?: { page?: number; pageSize?: number; query?: string },
): Promise<PaginatedResponse<Branch>> {
  const { data } = await apiClient.get<PaginatedResponse<Branch>>(
    `/repositories/${workspaceSlug}/${repoSlug}/branches`,
    { params },
  );
  return data;
}

export async function createBranch(
  workspaceSlug: string,
  repoSlug: string,
  payload: CreateBranchRequest,
): Promise<Branch> {
  const { data } = await apiClient.post<ApiResponse<Branch>>(
    `/repositories/${workspaceSlug}/${repoSlug}/branches`,
    payload,
  );
  return data.data;
}

export async function deleteBranch(
  workspaceSlug: string,
  repoSlug: string,
  branchName: string,
): Promise<void> {
  await apiClient.delete(
    `/repositories/${workspaceSlug}/${repoSlug}/branches/${encodeURIComponent(branchName)}`,
  );
}
