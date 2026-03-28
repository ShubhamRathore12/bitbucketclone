import type { Timestamps, UserReference } from './common';
import type { CommitDiff } from './repos';

export type PRState = 'open' | 'merged' | 'declined' | 'superseded';

export interface PullRequest extends Timestamps {
  id: number;
  title: string;
  description: string;
  state: PRState;
  author: UserReference;
  sourceBranch: string;
  sourceRepo: { id: string; fullName: string };
  destinationBranch: string;
  destinationRepo: { id: string; fullName: string };
  reviewers: Reviewer[];
  participants: Participant[];
  commentCount: number;
  taskCount: number;
  resolvedTaskCount: number;
  closeSourceBranch: boolean;
  mergeCommit?: { hash: string };
}

export interface Reviewer {
  user: UserReference;
  approved: boolean;
  role: 'reviewer';
}

export interface Participant {
  user: UserReference;
  role: 'author' | 'reviewer' | 'participant';
  approved: boolean;
}

export interface CreatePRRequest {
  title: string;
  description?: string;
  sourceBranch: string;
  destinationBranch: string;
  reviewers?: string[]; // user IDs
  closeSourceBranch?: boolean;
}

export interface UpdatePRRequest {
  title?: string;
  description?: string;
  reviewers?: string[];
  destinationBranch?: string;
}

export interface MergePRRequest {
  mergeStrategy?: 'merge_commit' | 'squash' | 'fast_forward';
  closeSourceBranch?: boolean;
  commitMessage?: string;
}

export interface PRComment extends Timestamps {
  id: number;
  content: string;
  author: UserReference;
  parentId?: number;
  inline?: {
    path: string;
    from?: number;
    to: number;
  };
  resolved: boolean;
  deleted: boolean;
}

export interface CreatePRCommentRequest {
  content: string;
  parentId?: number;
  inline?: {
    path: string;
    from?: number;
    to: number;
  };
}

export interface UpdatePRCommentRequest {
  content: string;
}

export interface PRDiff extends CommitDiff {
  sourceBranch: string;
  destinationBranch: string;
}

export interface AIReviewRequest {
  pullRequestId: number;
}

export interface AIReviewStatus {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  summary?: string;
  suggestions?: AIReviewSuggestion[];
  completedAt?: string;
}

export interface AIReviewSuggestion {
  path: string;
  line: number;
  severity: 'info' | 'warning' | 'error';
  message: string;
  suggestedCode?: string;
}

export interface ListPRsParams {
  state?: PRState | 'all';
  page?: number;
  pageSize?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
}
