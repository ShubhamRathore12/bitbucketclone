import type { Timestamps, UserReference } from './common';

export interface Workspace extends Timestamps {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string;
  description: string;
  isPersonal: boolean;
  owner: UserReference;
  membersCount: number;
}
