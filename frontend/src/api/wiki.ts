import { apiClient } from "./client";
import type { ApiResponse, PaginatedResponse } from "@/types/common";
import type {
  WikiPage,
  CreateWikiPageRequest,
  UpdateWikiPageRequest,
  WikiRevision,
  ListWikiPagesParams,
} from "@/types/wiki";

const wikiBase = (ws: string, repo: string) =>
  `/repositories/${ws}/${repo}/wiki`;

export async function listPages(
  workspaceSlug: string,
  repoSlug: string,
  params?: ListWikiPagesParams,
): Promise<PaginatedResponse<WikiPage>> {
  const { data } = await apiClient.get<PaginatedResponse<WikiPage>>(
    wikiBase(workspaceSlug, repoSlug),
    { params },
  );
  return data;
}

export async function createPage(
  workspaceSlug: string,
  repoSlug: string,
  payload: CreateWikiPageRequest,
): Promise<WikiPage> {
  const { data } = await apiClient.post<ApiResponse<WikiPage>>(
    wikiBase(workspaceSlug, repoSlug),
    payload,
  );
  return data.data;
}

export async function getPage(
  workspaceSlug: string,
  repoSlug: string,
  pageSlug: string,
): Promise<WikiPage> {
  const { data } = await apiClient.get<ApiResponse<WikiPage>>(
    `${wikiBase(workspaceSlug, repoSlug)}/${pageSlug}`,
  );
  return data.data;
}

export async function updatePage(
  workspaceSlug: string,
  repoSlug: string,
  pageSlug: string,
  payload: UpdateWikiPageRequest,
): Promise<WikiPage> {
  const { data } = await apiClient.put<ApiResponse<WikiPage>>(
    `${wikiBase(workspaceSlug, repoSlug)}/${pageSlug}`,
    payload,
  );
  return data.data;
}

export async function deletePage(
  workspaceSlug: string,
  repoSlug: string,
  pageSlug: string,
): Promise<void> {
  await apiClient.delete(`${wikiBase(workspaceSlug, repoSlug)}/${pageSlug}`);
}

export async function listRevisions(
  workspaceSlug: string,
  repoSlug: string,
  pageSlug: string,
  params?: { page?: number; pageSize?: number },
): Promise<PaginatedResponse<WikiRevision>> {
  const { data } = await apiClient.get<PaginatedResponse<WikiRevision>>(
    `${wikiBase(workspaceSlug, repoSlug)}/${pageSlug}/revisions`,
    { params },
  );
  return data;
}
