import type { UserReference } from './common';

export interface CodeSearchResult {
  file: string;
  repo: { id: string; fullName: string };
  matches: CodeMatch[];
}

export interface CodeMatch {
  lineNumber: number;
  content: string;
  highlights: { start: number; end: number }[];
}

export interface RepoSearchResult {
  id: string;
  fullName: string;
  description: string;
  language: string;
  updatedAt: string;
  isPrivate: boolean;
}

export interface UserSearchResult {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
}

export interface SearchCodeParams {
  query: string;
  repoFullName?: string;
  language?: string;
  page?: number;
  pageSize?: number;
}

export interface SearchReposParams {
  query: string;
  language?: string;
  page?: number;
  pageSize?: number;
}

export interface SearchUsersParams {
  query: string;
  page?: number;
  pageSize?: number;
}
