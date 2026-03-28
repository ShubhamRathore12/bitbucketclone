import { apiClient } from "./client";
import type { PaginatedResponse } from "@/types/common";
import type {
  CodeSearchResult,
  RepoSearchResult,
  UserSearchResult,
  SearchCodeParams,
  SearchReposParams,
  SearchUsersParams,
} from "@/types/search";

export async function searchCode(
  params: SearchCodeParams,
): Promise<PaginatedResponse<CodeSearchResult>> {
  const { data } = await apiClient.get<PaginatedResponse<CodeSearchResult>>(
    "/search/code",
    { params },
  );
  return data;
}

export async function searchRepos(
  params: SearchReposParams,
): Promise<PaginatedResponse<RepoSearchResult>> {
  const { data } = await apiClient.get<PaginatedResponse<RepoSearchResult>>(
    "/search/repositories",
    { params },
  );
  return data;
}

export async function searchUsers(
  params: SearchUsersParams,
): Promise<PaginatedResponse<UserSearchResult>> {
  const { data } = await apiClient.get<PaginatedResponse<UserSearchResult>>(
    "/search/users",
    { params },
  );
  return data;
}
