import type { Timestamps, UserReference } from './common';
import type { RepositorySummary, CommitSummary } from './repo';

export type PRState = 'open' | 'merged' | 'declined' | 'superseded';
export type ReviewStatus = 'approved' | 'changes_requested' | 'commented' | 'pending';
export type MergeStrategy = 'merge' | 'squash' | 'fast_forward';

export interface PullRequest extends Timestamps {
  id: number;
  title: string;
  description: string;
  state: PRState;
  author: UserReference;
  sourceBranch: string;
  destinationBranch: string;
  sourceRepo: RepositorySummary;
  destinationRepo: RepositorySummary;
  commitCount: number;
  commentCount: number;
  taskCount: number;
  resolvedTaskCount: number;
  reviewers: Reviewer[];
  participants: Participant[];
  mergeCommit?: CommitSummary;
  closeSourceBranch: boolean;
  buildStatus?: BuildStatus;
  aiReview?: AIReviewStatus;
}

export interface PullRequestSummary {
  id: number;
  title: string;
  state: PRState;
  author: UserReference;
  sourceBranch: string;
  destinationBranch: string;
  commentCount: number;
  commitCount: number;
  reviewers: Reviewer[];
  createdAt: string;
  updatedAt: string;
}

export interface Reviewer {
  user: UserReference;
  status: ReviewStatus;
  role: 'reviewer' | 'default_reviewer';
}

export interface Participant {
  user: UserReference;
  role: 'author' | 'reviewer' | 'participant';
  lastActivity: string;
}

export interface BuildStatus {
  state: 'successful' | 'failed' | 'inprogress' | 'stopped';
  name: string;
  url: string;
  description: string;
}

export interface AIReviewStatus {
  state: 'pending' | 'in_progress' | 'completed' | 'failed';
  score?: number;
  summary?: string;
  commentCount?: number;
  completedAt?: string;
}

export interface DiffFile {
  oldPath: string;
  newPath: string;
  status: 'added' | 'deleted' | 'modified' | 'renamed' | 'binary';
  additions: number;
  deletions: number;
  isBinary: boolean;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'add' | 'delete' | 'context';
  content: string;
  oldNumber?: number;
  newNumber?: number;
}

export interface InlineComment extends Timestamps {
  id: string;
  content: string;
  author: UserReference;
  filePath: string;
  lineNumber: number;
  lineType: 'old' | 'new';
  parentId?: string;
  replies: InlineComment[];
  isResolved: boolean;
  resolvedBy?: UserReference;
  isAIGenerated: boolean;
}

export interface ReviewSubmission {
  body: string;
  status: 'approve' | 'request_changes' | 'comment';
}
