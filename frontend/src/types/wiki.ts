import type { Timestamps, UserReference } from './common';

export interface WikiPage extends Timestamps {
  id: string;
  slug: string;
  title: string;
  content: string;
  author: UserReference;
  lastEditor: UserReference;
  revision: number;
}

export interface CreateWikiPageRequest {
  title: string;
  content: string;
}

export interface UpdateWikiPageRequest {
  title?: string;
  content?: string;
}

export interface WikiRevision {
  id: string;
  revision: number;
  author: UserReference;
  message: string;
  createdAt: string;
}

export interface ListWikiPagesParams {
  query?: string;
  page?: number;
  pageSize?: number;
}
