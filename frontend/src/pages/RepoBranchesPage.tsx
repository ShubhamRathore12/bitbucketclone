import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GitBranch,
  Plus,
  Search,
  Trash2,
  Shield,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import type { Branch } from '@/types/repo';
import type { PaginatedResponse, ApiError } from '@/types/common';

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

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('access_token')}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err: ApiError = await res.json();
    throw err;
  }
  return res.json();
}

async function deleteRequest(url: string): Promise<void> {
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`} />;
}

// ---------------------------------------------------------------------------
// RepoBranchesPage
// ---------------------------------------------------------------------------

export default function RepoBranchesPage() {
  const { workspace, repo } = useParams<{ workspace: string; repo: string }>();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [sourceBranch, setSourceBranch] = useState('main');
  const [deletingBranch, setDeletingBranch] = useState<string | null>(null);

  const branchesQuery = useQuery<PaginatedResponse<Branch>>({
    queryKey: ['branches', workspace, repo],
    queryFn: () =>
      fetchJson(`/api/repositories/${workspace}/${repo}/branches?pageSize=100`),
    enabled: !!workspace && !!repo,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; sourceBranch: string }) =>
      postJson(`/api/repositories/${workspace}/${repo}/branches`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches', workspace, repo] });
      setShowCreate(false);
      setNewBranchName('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (branchName: string) =>
      deleteRequest(
        `/api/repositories/${workspace}/${repo}/branches/${encodeURIComponent(branchName)}`
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches', workspace, repo] });
      setDeletingBranch(null);
    },
  });

  // Filter branches by search
  const branches = branchesQuery.data?.data || [];
  const filtered = search
    ? branches.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()))
    : branches;

  // Separate default from non-default
  const defaultBranch = filtered.find((b) => b.isDefault);
  const otherBranches = filtered.filter((b) => !b.isDefault);

  function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  // ---------------------------------------------------------------------------
  // Branch row
  // ---------------------------------------------------------------------------

  function BranchRow({ branch }: { branch: Branch }) {
    return (
      <div className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
        <GitBranch className="h-4 w-4 text-gray-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              to={`/${workspace}/${repo}/src/${encodeURIComponent(branch.name)}`}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline truncate"
            >
              {branch.name}
            </Link>
            {branch.isDefault && <Badge color="blue" size="sm">default</Badge>}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2">
            <Avatar
              src={branch.target.author.user?.avatarUrl}
              name={branch.target.author.name}
              size="xs"
            />
            {branch.target.author.name} &middot;{' '}
            <span className="truncate max-w-xs">{branch.target.subject}</span> &middot;{' '}
            {relativeTime(branch.target.date)}
          </p>
        </div>

        {/* Ahead/behind indicators */}
        {!branch.isDefault && (
          <div className="flex items-center gap-3 text-xs shrink-0">
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <ArrowUp className="h-3 w-3" />
              {branch.aheadCount} ahead
            </span>
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <ArrowDown className="h-3 w-3" />
              {branch.behindCount} behind
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {!branch.isDefault && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeletingBranch(branch.name)}
              className="text-gray-400 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {branch.isDefault && (
            <Shield className="h-4 w-4 text-blue-500" title="Protected branch" />
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Input
            placeholder="Search branches..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            prefixIcon={<Search className="h-4 w-4" />}
            inputSize="sm"
            wrapperClassName="w-64"
          />
          {branchesQuery.data && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {branches.length} branch{branches.length !== 1 ? 'es' : ''}
            </span>
          )}
        </div>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setShowCreate(true)}
        >
          Create branch
        </Button>
      </div>

      {/* Branch list */}
      {branchesQuery.isLoading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3">
              <Skeleton className="h-4 w-4 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      ) : branchesQuery.isError ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-10 text-center">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Failed to load branches.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-10 text-center">
          <GitBranch className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            {search ? 'No branches match your search.' : 'No branches found.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
          {defaultBranch && <BranchRow branch={defaultBranch} />}
          {otherBranches.map((branch) => (
            <BranchRow key={branch.name} branch={branch} />
          ))}
        </div>
      )}

      {/* Create branch modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create a branch"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={createMutation.isPending}
              onClick={() =>
                createMutation.mutate({ name: newBranchName, sourceBranch })
              }
              disabled={!newBranchName.trim()}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {createMutation.isError && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-700 dark:text-red-300">
              {(createMutation.error as ApiError)?.message || 'Failed to create branch.'}
            </div>
          )}
          <Input
            label="Branch name"
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            placeholder="feature/my-feature"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Source branch
            </label>
            <select
              value={sourceBranch}
              onChange={(e) => setSourceBranch(e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {branches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                  {b.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={!!deletingBranch}
        onClose={() => setDeletingBranch(null)}
        title="Delete branch"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingBranch(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleteMutation.isPending}
              onClick={() => deletingBranch && deleteMutation.mutate(deletingBranch)}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Are you sure you want to delete the branch{' '}
          <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono">
            {deletingBranch}
          </code>
          ? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
