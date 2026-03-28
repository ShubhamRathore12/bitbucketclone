import { apiClient } from "./client";
import type { ApiResponse, PaginatedResponse } from "@/types/common";
import type {
  Snippet,
  CreateSnippetRequest,
  UpdateSnippetRequest,
  ListSnippetsParams,
} from "@/types/snippets";

export async function listSnippets(
  params?: ListSnippetsParams,
): Promise<PaginatedResponse<Snippet>> {
  const { data } = await apiClient.get<PaginatedResponse<Snippet>>("/snippets", {
    params,
  });
  return data;
}

export async function createSnippet(
  payload: CreateSnippetRequest,
): Promise<Snippet> {
  const { data } = await apiClient.post<ApiResponse<Snippet>>("/snippets", payload);
  return data.data;
}

export async function getSnippet(snippetId: string): Promise<Snippet> {
  const { data } = await apiClient.get<ApiResponse<Snippet>>(
    `/snippets/${snippetId}`,
  );
  return data.data;
}

export async function updateSnippet(
  snippetId: string,
  payload: UpdateSnippetRequest,
): Promise<Snippet> {
  const { data } = await apiClient.put<ApiResponse<Snippet>>(
    `/snippets/${snippetId}`,
    payload,
  );
  return data.data;
}

export async function deleteSnippet(snippetId: string): Promise<void> {
  await apiClient.delete(`/snippets/${snippetId}`);
}
