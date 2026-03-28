import type { Timestamps, UserReference } from "./common";

export interface Repository extends Timestamps {
  id: string;
  name: string;
  slug: string;
  fullName: string;
  description: string;
  workspace: WorkspaceSummary;
  owner: UserReference;
  isPrivate: boolean;
  isFork: boolean;
  forkedFrom?: RepositorySummary;
  language: string;
  size: number;
  defaultBranch: string;
  hasIssues: boolean;
  hasWiki: boolean;
  hasPipelines: boolean;
  openIssueCount: number;
  openPRCount: number;
  forkCount: number;
  starCount: number;
}

export interface RepositorySummary {
  id: string;
  name: string;
  slug: string;
  fullName: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
}

export interface Workspace extends Timestamps {
  id: string;
  name: string;
  slug: string;
  description: string;
  avatarUrl: string;
  isPersonal: boolean;
  owner: UserReference;
  memberCount: number;
}

export interface WorkspaceMember extends Timestamps {
  id: string;
  user: UserReference;
  workspace: WorkspaceSummary;
  role: WorkspaceRole;
}

export type WorkspaceRole = "owner" | "admin" | "member" | "contributor";

export interface Branch {
  name: string;
  target: CommitSummary;
  isDefault: boolean;
  behindCount: number;
  aheadCount: number;
}

export interface Tag {
  name: string;
  target: CommitSummary;
  message: string;
  tagger: UserReference;
  date: string;
}

export interface Commit {
  hash: string;
  abbreviatedHash: string;
  message: string;
  subject: string;
  body: string;
  author: CommitAuthor;
  committer: CommitAuthor;
  date: string;
  parents: string[];
  stats: CommitStats;
}

export interface CommitSummary {
  hash: string;
  abbreviatedHash: string;
  subject: string;
  author: CommitAuthor;
  date: string;
}

export interface CommitAuthor {
  name: string;
  email: string;
  user?: UserReference;
}

export interface CommitStats {
  additions: number;
  deletions: number;
  filesChanged: number;
}

export interface TreeEntry {
  name: string;
  path: string;
  type: "file" | "dir" | "submodule" | "symlink";
  size: number;
  hash: string;
  lastCommit?: CommitSummary;
}

export interface FileContent {
  path: string;
  name: string;
  size: number;
  encoding: "utf-8" | "base64";
  content: string;
  hash: string;
  language: string;
  lineCount: number;
  isBinary: boolean;
  isTruncated: boolean;
}

export interface CreateRepositoryRequest {
  name: string;
  description?: string;
  workspace: string;
  isPrivate: boolean;
  defaultBranch?: string;
  hasIssues?: boolean;
  hasWiki?: boolean;
  hasPipelines?: boolean;
  language?: string;
}

export interface RepositorySearchResult {
  repository: Repository;
  matchField: string;
  matchHighlight: string;
}

export interface CodeSearchResult {
  repository: RepositorySummary;
  path: string;
  matchLines: CodeSearchLine[];
}

export interface CodeSearchLine {
  lineNumber: number;
  content: string;
  isMatch: boolean;
}
