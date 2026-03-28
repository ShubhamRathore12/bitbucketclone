import type { Timestamps, UserReference } from './common';

export interface Snippet extends Timestamps {
  id: string;
  title: string;
  isPrivate: boolean;
  owner: UserReference;
  files: SnippetFile[];
  scm: 'git';
}

export interface SnippetFile {
  filename: string;
  content: string;
  language: string;
}

export interface CreateSnippetRequest {
  title: string;
  isPrivate?: boolean;
  files: { filename: string; content: string }[];
}

export interface UpdateSnippetRequest {
  title?: string;
  isPrivate?: boolean;
  files?: { filename: string; content: string }[];
}

export interface ListSnippetsParams {
  role?: 'owner' | 'contributor' | 'member';
  query?: string;
  page?: number;
  pageSize?: number;
}
