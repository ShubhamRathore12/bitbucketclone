import type { Timestamps, UserReference } from './common';

export type IssueState = 'new' | 'open' | 'resolved' | 'on_hold' | 'invalid' | 'duplicate' | 'wontfix' | 'closed';
export type IssuePriority = 'trivial' | 'minor' | 'major' | 'critical' | 'blocker';
export type IssueKind = 'bug' | 'enhancement' | 'proposal' | 'task';

export interface Issue extends Timestamps {
  id: number;
  title: string;
  content: string;
  state: IssueState;
  priority: IssuePriority;
  kind: IssueKind;
  reporter: UserReference;
  assignee?: UserReference;
  labels: Label[];
  votes: number;
  watchers: number;
  commentCount: number;
}

export interface CreateIssueRequest {
  title: string;
  content?: string;
  priority?: IssuePriority;
  kind?: IssueKind;
  assigneeId?: string;
  labels?: string[];
}

export interface UpdateIssueRequest {
  title?: string;
  content?: string;
  state?: IssueState;
  priority?: IssuePriority;
  kind?: IssueKind;
  assigneeId?: string;
  labels?: string[];
}

export interface IssueComment extends Timestamps {
  id: number;
  content: string;
  author: UserReference;
}

export interface CreateIssueCommentRequest {
  content: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface CreateLabelRequest {
  name: string;
  color: string;
}

export interface ListIssuesParams {
  state?: IssueState | 'all';
  priority?: IssuePriority;
  kind?: IssueKind;
  assigneeId?: string;
  query?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
}
