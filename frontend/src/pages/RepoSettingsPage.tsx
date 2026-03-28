import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  Shield,
  Webhook,
  AlertTriangle,
  Save,
  Trash2,
  Archive,
  ArrowRightLeft,
  Plus,
  X,
  Lock,
  Globe,
  Users,
  GitBranch,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import type { Repository, Branch } from '@/types/repo';
import type { PaginatedResponse, UserReference, ApiError } from '@/types/common';

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function putJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const err: ApiError = await res.json(); throw err; }
  return res.json();
}

async function deleteRequest(url: string): Promise<void> {
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
  });
  if (!res.ok) throw new Error('API error');
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('API error');
  return res.json();
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`} />;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SettingsSection = 'general' | 'access' | 'branches' | 'webhooks' | 'danger';

interface WebhookEntry {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

interface PermissionEntry {
  user: UserReference;
  permission: 'read' | 'write' | 'admin';
}

interface BranchRestriction {
  id: string;
  branch: string;
  type: 'push' | 'merge' | 'delete';
  users: UserReference[];
}

// ---------------------------------------------------------------------------
// SettingsPage (RepoSettingsPage)
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { workspace, repo: repoSlug } = useParams<{ workspace: string; repo: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  const apiBase = `/api/repositories/${workspace}/${repoSlug}`;

  // Repo data
  const repoQuery = useQuery<Repository>({
    queryKey: ['repo', workspace, repoSlug],
    queryFn: () => fetchJson(apiBase),
    enabled: !!workspace && !!repoSlug,
  });

  // General settings state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    if (repoQuery.data) {
      setName(repoQuery.data.name);
      setDescription(repoQuery.data.description || '');
      setDefaultBranch(repoQuery.data.defaultBranch);
      setIsPrivate(repoQuery.data.isPrivate);
    }
  }, [repoQuery.data]);

  const branches = useQuery<PaginatedResponse<Branch>>({
    queryKey: ['branches', workspace, repoSlug],
    queryFn: () => fetchJson(`${apiBase}/branches?pageSize=100`),
    enabled: !!workspace && !!repoSlug,
  });

  // Permissions
  const permissionsQuery = useQuery<PermissionEntry[]>({
    queryKey: ['repo-permissions', workspace, repoSlug],
    queryFn: () => fetchJson(`${apiBase}/permissions`),
    enabled: activeSection === 'access',
  });

  // Branch restrictions
  const restrictionsQuery = useQuery<BranchRestriction[]>({
    queryKey: ['branch-restrictions', workspace, repoSlug],
    queryFn: () => fetchJson(`${apiBase}/branch-restrictions`),
    enabled: activeSection === 'branches',
  });

  // Webhooks
  const webhooksQuery = useQuery<WebhookEntry[]>({
    queryKey: ['webhooks', workspace, repoSlug],
    queryFn: () => fetchJson(`${apiBase}/webhooks`),
    enabled: activeSection === 'webhooks',
  });

  // Mutations
  const saveGeneralMutation = useMutation({
    mutationFn: () => putJson(apiBase, { name, description, defaultBranch, isPrivate }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['repo', workspace, repoSlug] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteRequest(apiBase),
    onSuccess: () => navigate(`/${workspace}`),
  });

  const archiveMutation = useMutation({
    mutationFn: () => postJson(`${apiBase}/archive`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['repo', workspace, repoSlug] }),
  });

  const sections: { key: SettingsSection; label: string; icon: React.ReactNode }[] = [
    { key: 'general', label: 'General', icon: <Settings className="h-4 w-4" /> },
    { key: 'access', label: 'Access', icon: <Users className="h-4 w-4" /> },
    { key: 'branches', label: 'Branch Restrictions', icon: <GitBranch className="h-4 w-4" /> },
    { key: 'webhooks', label: 'Webhooks', icon: <Webhook className="h-4 w-4" /> },
    { key: 'danger', label: 'Danger Zone', icon: <AlertTriangle className="h-4 w-4" /> },
  ];

  if (repoQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 hidden lg:block">
        <nav className="space-y-1 sticky top-6">
          {sections.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setActiveSection(s.key)}
              className={[
                'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer',
                activeSection === s.key
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50',
                s.key === 'danger' ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10' : '',
              ].join(' ')}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* General */}
        {activeSection === 'general' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">General Settings</h2>

            <Input label="Repository name" value={name} onChange={(e) => setName(e.target.value)} />
            <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A short description of this repository" />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default branch</label>
              <select
                value={defaultBranch}
                onChange={(e) => setDefaultBranch(e.target.value)}
                className="w-full max-w-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {branches.data?.data.map((b) => (
                  <option key={b.name} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Visibility</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={!isPrivate} onChange={() => setIsPrivate(false)} className="h-4 w-4 text-blue-600" />
                  <Globe className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Public</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={isPrivate} onChange={() => setIsPrivate(true)} className="h-4 w-4 text-blue-600" />
                  <Lock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Private</span>
                </label>
              </div>
            </div>

            {saveGeneralMutation.isError && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-700 dark:text-red-300">
                {(saveGeneralMutation.error as ApiError)?.message || 'Failed to save settings.'}
              </div>
            )}
            {saveGeneralMutation.isSuccess && (
              <div className="rounded-md bg-green-50 dark:bg-green-900/30 p-3 text-sm text-green-700 dark:text-green-300">
                Settings saved successfully.
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="primary" leftIcon={<Save className="h-4 w-4" />} loading={saveGeneralMutation.isPending} onClick={() => saveGeneralMutation.mutate()}>
                Save changes
              </Button>
            </div>
          </div>
        )}

        {/* Access / Permissions */}
        {activeSection === 'access' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Access & Permissions</h2>
              <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>Add user</Button>
            </div>
            {permissionsQuery.isLoading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : !permissionsQuery.data?.length ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No explicit permissions set. Using workspace defaults.</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {permissionsQuery.data.map((p) => (
                  <div key={p.user.id} className="py-3 flex items-center gap-3">
                    <Avatar src={p.user.avatarUrl} name={p.user.displayName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{p.user.displayName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">@{p.user.username}</p>
                    </div>
                    <select
                      defaultValue={p.permission}
                      className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                    >
                      <option value="read">Read</option>
                      <option value="write">Write</option>
                      <option value="admin">Admin</option>
                    </select>
                    <Button variant="ghost" size="sm"><X className="h-4 w-4 text-gray-400" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Branch restrictions */}
        {activeSection === 'branches' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Branch Restrictions</h2>
              <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>Add restriction</Button>
            </div>
            {restrictionsQuery.isLoading ? (
              <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : !restrictionsQuery.data?.length ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No branch restrictions configured.</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {restrictionsQuery.data.map((r) => (
                  <div key={r.id} className="py-3 flex items-center gap-3">
                    <Shield className="h-4 w-4 text-yellow-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">{r.branch}</code>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        No direct {r.type} &middot; {r.users.length} exception{r.users.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Badge color="yellow" size="sm">{r.type}</Badge>
                    <Button variant="ghost" size="sm"><Trash2 className="h-4 w-4 text-gray-400" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Webhooks */}
        {activeSection === 'webhooks' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Webhooks</h2>
              <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>Add webhook</Button>
            </div>
            {webhooksQuery.isLoading ? (
              <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : !webhooksQuery.data?.length ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No webhooks configured.</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {webhooksQuery.data.map((wh) => (
                  <div key={wh.id} className="py-3 flex items-center gap-3">
                    <Webhook className="h-4 w-4 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono text-gray-900 dark:text-white truncate">{wh.url}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {wh.events.join(', ')}
                      </p>
                    </div>
                    <Badge color={wh.active ? 'green' : 'gray'} size="sm" dot>{wh.active ? 'Active' : 'Inactive'}</Badge>
                    <Button variant="ghost" size="sm"><Trash2 className="h-4 w-4 text-gray-400" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Danger Zone */}
        {activeSection === 'danger' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-red-200 dark:border-red-900/50 p-6 space-y-6">
            <h2 className="text-lg font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </h2>

            {/* Transfer */}
            <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">Transfer repository</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Transfer this repository to another workspace.</p>
              </div>
              <Button variant="outline" size="sm" leftIcon={<ArrowRightLeft className="h-4 w-4" />}>Transfer</Button>
            </div>

            {/* Archive */}
            <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">Archive repository</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Make this repository read-only.</p>
              </div>
              <Button variant="outline" size="sm" loading={archiveMutation.isPending} leftIcon={<Archive className="h-4 w-4" />} onClick={() => archiveMutation.mutate()}>
                Archive
              </Button>
            </div>

            {/* Delete */}
            <div className="flex items-center justify-between py-3">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">Delete repository</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Once you delete a repository, there is no going back.</p>
              </div>
              <Button variant="danger" size="sm" leftIcon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete repository" size="sm" footer={
        <>
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="danger" loading={deleteMutation.isPending} disabled={deleteInput !== `${workspace}/${repoSlug}`} onClick={() => deleteMutation.mutate()}>
            Delete this repository
          </Button>
        </>
      }>
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            This action <strong>cannot</strong> be undone. This will permanently delete the
            <code className="mx-1 px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono">{workspace}/{repoSlug}</code>
            repository and all of its data.
          </p>
          <Input
            label={`Type "${workspace}/${repoSlug}" to confirm`}
            value={deleteInput}
            onChange={(e) => setDeleteInput(e.target.value)}
            placeholder={`${workspace}/${repoSlug}`}
          />
        </div>
      </Modal>
    </div>
  );
}
