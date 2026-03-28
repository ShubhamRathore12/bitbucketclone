import type { Timestamps, UserReference } from "./common";
import type { CommitSummary, RepositorySummary } from "./repo";

export type PRState = "open" | "merged" | "declined" | "superseded";

export type PRMergeStrategy = "merge" | "squash" | "rebase";

export type ReviewStatus = "pending" | "approved" | "changes_requested" | "dismissed";

export interface PullRequest extends Timestamps {
  id: string;
  number: number;
  title: string;
  description: string;
  state: PRState;
  author: UserReference;
  repository: RepositorySummary;
  sourceBranch: string;
  destinationBranch: string;
  sourceRepo?: RepositorySummary;
  reviewers: PRReviewer[];
  participants: PRParticipant[];
  mergeCommit?: CommitSummary;
  mergedBy?: UserReference;
  mergedAt?: string;
  closedBy?: UserReference;
  closedAt?: string;
  commitCount: number;
  commentCount: number;
  taskCount: number;
  resolvedTaskCount: number;
  isDraft: boolean;
  hasConflicts: boolean;
  diffStats: PRDiffStats;
}

export interface PRReviewer {
  user: UserReference;
  status: ReviewStatus;
  reviewedAt?: string;
}

export interface PRParticipant {
  user: UserReference;
  role: "author" | "reviewer" | "participant";
  lastActivityAt: string;
}

export interface PRDiffStats {
  additions: number;
  deletions: number;
  filesChanged: number;
}

export interface PRComment extends Timestamps {
  id: string;
  pullRequestId: string;
  author: UserReference;
  content: string;
  renderedContent: string;
  parentId?: string;
  replies: PRComment[];
  isDeleted: boolean;
  isResolved: boolean;
  resolvedBy?: UserReference;
  inline?: PRInlineComment;
}

export interface PRInlineComment {
  path: string;
  oldLine?: number;
  newLine?: number;
  fromHash: string;
  toHash: string;
}

export interface DiffFile {
  oldPath: string;
  newPath: string;
  status: DiffFileStatus;
  isBinary: boolean;
  oldHash: string;
  newHash: string;
  hunks: DiffHunk[];
  stats: {
    additions: number;
    deletions: number;
  };
}

export type DiffFileStatus = "added" | "deleted" | "modified" | "renamed" | "copied";

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: DiffLine[];
}

export interface DiffLine {
  type: "context" | "addition" | "deletion";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface CreatePRRequest {
  title: string;
  description?: string;
  sourceBranch: string;
  destinationBranch: string;
  sourceRepo?: string;
  reviewers?: string[];
  isDraft?: boolean;
  closeSourceBranch?: boolean;
}

export interface MergePRRequest {
  strategy: PRMergeStrategy;
  commitMessage?: string;
  closeSourceBranch?: boolean;
}

export interface PRActivity {
  id: string;
  type: "comment" | "approval" | "update" | "merge" | "decline" | "status_change";
  author: UserReference;
  timestamp: string;
  comment?: PRComment;
  update?: PRUpdateActivity;
}

export interface PRUpdateActivity {
  oldTitle?: string;
  newTitle?: string;
  oldDescription?: string;
  newDescription?: string;
  addedReviewers?: UserReference[];
  removedReviewers?: UserReference[];
}
