export type NotificationType =
  | 'pr_created'
  | 'pr_approved'
  | 'pr_declined'
  | 'pr_merged'
  | 'pr_comment'
  | 'issue_created'
  | 'issue_assigned'
  | 'issue_comment'
  | 'pipeline_failed'
  | 'pipeline_completed'
  | 'repo_push'
  | 'mention';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  link: string;
  actor: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
  };
  repository?: {
    id: string;
    fullName: string;
  };
}

export interface ListNotificationsParams {
  read?: boolean;
  page?: number;
  pageSize?: number;
}
