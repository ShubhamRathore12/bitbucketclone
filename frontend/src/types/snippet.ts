import type { Timestamps, UserReference } from './common';

export interface Snippet extends Timestamps {
  id: string;
  title: string;
  isPrivate: boolean;
  owner: UserReference;
  files: SnippetFile[];
}

export interface SnippetFile {
  filename: string;
  language: string;
  content: string;
  size: number;
}

export interface CreateSnippetRequest {
  title: string;
  isPrivate: boolean;
  files: { filename: string; content: string }[];
}

export interface UpdateSnippetRequest {
  title?: string;
  isPrivate?: boolean;
  files?: { filename: string; content: string }[];
}
