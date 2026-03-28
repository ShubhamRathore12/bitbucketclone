import type { Timestamps, UserReference } from "./common";
import type { RepositorySummary } from "./repo";

export type IssueState = "new" | "open" | "on_hold" | "resolved" | "closed" | "duplicate" | "invalid" | "wontfix";

export type IssuePriority = "trivial" | "minor" | "major" | "critical" | "blocker";

export type IssueKind = "bug" | "enhancement" | "proposal" | "task";

export interface Issue extends Timestamps {
  id: string;
  number: number;
  title: string;
  content: string;
  renderedContent: string;
  state: IssueState;
  priority: IssuePriority;
  kind: IssueKind;
  reporter: UserReference;
  assignee?: UserReference;
  repository: RepositorySummary;
  labels: Label[];
  milestone?: Milestone;
  votes: number;
  watchers: number;
  commentCount: number;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  description: string;
}

export interface Milestone extends Timestamps {
  id: string;
  name: string;
  description: string;
  dueDate?: string;
  openCount: number;
  closedCount: number;
  isCompleted: boolean;
}

export interface IssueComment extends Timestamps {
  id: string;
  issueId: string;
  author: UserReference;
  content: string;
  renderedContent: string;
  isDeleted: boolean;
}

export interface CreateIssueRequest {
  title: string;
  content?: string;
  kind: IssueKind;
  priority: IssuePriority;
  assignee?: string;
  labels?: string[];
  milestone?: string;
}

export interface UpdateIssueRequest {
  title?: string;
  content?: string;
  state?: IssueState;
  kind?: IssueKind;
  priority?: IssuePriority;
  assignee?: string | null;
  labels?: string[];
  milestone?: string | null;
}

export interface IssueChange {
  id: string;
  issueId: string;
  author: UserReference;
  timestamp: string;
  changes: IssueFieldChange[];
}

export interface IssueFieldChange {
  field: string;
  oldValue: string;
  newValue: string;
}
