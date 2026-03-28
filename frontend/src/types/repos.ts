import type { Timestamps, UserReference } from './common';

export type RepoVisibility = 'public' | 'private';
export type RepoLanguage = string;

export interface Repository extends Timestamps {
  id: string;
  name: string;
  slug: string;
  fullName: string; // workspace/repo-slug
  description: string;
  visibility: RepoVisibility;
  language: RepoLanguage;
  defaultBranch: string;
  owner: UserReference;
  workspaceId: string;
  workspaceName: string;
  forksCount: number;
  starsCount: number;
  watchersCount: number;
  size: number;
  isEmpty: boolean;
  isFork: boolean;
  parentRepo?: Pick<Repository, 'id' | 'name' | 'fullName'>;
}

export interface CreateRepoRequest {
  name: string;
  description?: string;
  visibility: RepoVisibility;
  defaultBranch?: string;
  workspaceId: string;
}

export interface UpdateRepoRequest {
  description?: string;
  visibility?: RepoVisibility;
  defaultBranch?: string;
}

export interface ForkRepoRequest {
  name?: string;
  workspaceId: string;
}

export interface Branch {
  name: string;
  target: Commit;
  isDefault: boolean;
}

export interface CreateBranchRequest {
  name: string;
  sourceBranch?: string;
  sourceCommit?: string;
}

export interface Tag {
  name: string;
  target: Commit;
  message: string;
}

export interface Commit {
  hash: string;
  message: string;
  author: UserReference;
  date: string;
  parents: { hash: string }[];
  stats?: {
    additions: number;
    deletions: number;
    filesChanged: number;
  };
}

export interface CommitDiff {
  files: DiffFile[];
  stats: {
    additions: number;
    deletions: number;
    filesChanged: number;
  };
}

export interface DiffFile {
  path: string;
  previousPath?: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
  isBinary: boolean;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  content: string;
}

export interface SourceEntry {
  path: string;
  name: string;
  type: 'file' | 'directory' | 'submodule';
  size?: number;
  lastCommit?: Pick<Commit, 'hash' | 'message' | 'date' | 'author'>;
}

export interface FileContent {
  path: string;
  content: string;
  encoding: 'utf-8' | 'base64';
  size: number;
  mimeType: string;
}

export interface ListReposParams {
  workspaceId?: string;
  query?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
}
