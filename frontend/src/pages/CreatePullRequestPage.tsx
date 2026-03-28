import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  GitPullRequest,
  GitBranch,
  ChevronDown,
  ArrowRight,
  Eye,
  Edit3,
  X,
  AlertCircle,
  Users,
  FileCode2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import type { Branch, Repository } from '@/types/repo';
import type { CreatePRRequest, DiffFile } from '@/types/pr';
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

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`} />;
}

// ---------------------------------------------------------------------------
// Branch dropdown
// ---------------------------------------------------------------------------

function BranchDropdown({
  label,
  branches,
  selected,
  onSelect,
}: {
  label: string;
  branches: Branch[];
  selected: string;
  onSelect: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const filtered = filter
    ? branches.filter((b) => b.name.toLowerCase().includes(filter.toLowerCase()))
    : branches;

  return (
    <div className="flex-1">
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between gap-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2 truncate">
            <GitBranch className="h-4 w-4 text-gray-400 shrink-0" />
            {selected || 'Select branch'}
          </span>
          <ChevronDown className="h-3 w-3 text-gray-400 shrink-0" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute left-0 mt-1 w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-60 overflow-y-auto">
              <div className="p-2 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
                <input
                  type="text"
                  placeholder="Filter branches..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <ul className="py-1">
                {filtered.map((b) => (
                  <li key={b.name}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(b.name);
                        setOpen(false);
                        setFilter('');
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer ${
                        b.name === selected
                          ? 'font-semibold text-blue-600 dark:text-blue-400'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {b.name}
                      {b.isDefault && (
                        <span className="ml-2 text-xs text-gray-400">(default)</span>
                      )}
                    </button>
                  </li>
                ))}
                {filtered.length === 0 && (
                  <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                    No branches found.
                  </li>
                )}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reviewer multi-select
// ---------------------------------------------------------------------------

function ReviewerSelector({
  workspace,
  selected,
  onToggle,
}: {
  workspace: string;
  selected: string[];
  onToggle: (userId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const membersQuery = useQuery<PaginatedResponse<{ user: UserReference }>>({
    queryKey: ['workspace-members', workspace],
    queryFn: () => fetchJson(`/api/workspaces/${workspace}/members?pageSize=50`),
    enabled: open,
  });

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Reviewers
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between gap-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {selected.length === 0
              ? 'Select reviewers'
              : `${selected.length} reviewer${selected.length > 1 ? 's' : ''} selected`}
          </span>
          <ChevronDown className="h-3 w-3" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute left-0 mt-1 w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-60 overflow-y-auto">
              {membersQuery.isLoading ? (
                <div className="p-3 space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <ul className="py-1">
                  {membersQuery.data?.data.map((m) => (
                    <li key={m.user.id}>
                      <button
                        type="button"
                        onClick={() => onToggle(m.user.id)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(m.user.id)}
                          readOnly
                          className="h-4 w-4 rounded border-gray-300 text-blue-600"
                        />
                        <Avatar
                          src={m.user.avatarUrl}
                          name={m.user.displayName}
                          size="xs"
                        />
                        <span className="text-gray-700 dark:text-gray-300">
                          {m.user.displayName}
                        </span>
                        <span className="text-gray-400 text-xs">@{m.user.username}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CreatePullRequestPage
// ---------------------------------------------------------------------------

export default function CreatePullRequestPage() {
  const { workspace, repo } = useParams<{ workspace: string; repo: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [sourceBranch, setSourceBranch] = useState(searchParams.get('source') || '');
  const [destBranch, setDestBranch] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reviewers, setReviewers] = useState<string[]>([]);
  const [closeSourceBranch, setCloseSourceBranch] = useState(true);
  const [previewMarkdown, setPreviewMarkdown] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Branches
  const branchesQuery = useQuery<PaginatedResponse<Branch>>({
    queryKey: ['branches', workspace, repo],
    queryFn: () =>
      fetchJson(`/api/repositories/${workspace}/${repo}/branches?pageSize=100`),
    enabled: !!workspace && !!repo,
  });

  const branches = branchesQuery.data?.data || [];
  const defaultBranch = branches.find((b) => b.isDefault);

  // Set default destination branch
  useEffect(() => {
    if (defaultBranch && !destBranch) {
      setDestBranch(defaultBranch.name);
    }
  }, [defaultBranch, destBranch]);

  // Auto-generate title from branch name
  useEffect(() => {
    if (sourceBranch && !title) {
      const generated = sourceBranch
        .replace(/^(feature|bugfix|hotfix|release)\//i, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      setTitle(generated);
    }
  }, [sourceBranch, title]);

  // Diff preview
  const diffQuery = useQuery<DiffFile[]>({
    queryKey: ['diff-preview', workspace, repo, sourceBranch, destBranch],
    queryFn: () =>
      fetchJson(
        `/api/repositories/${workspace}/${repo}/diff/${encodeURIComponent(destBranch)}..${encodeURIComponent(sourceBranch)}`
      ),
    enabled: !!sourceBranch && !!destBranch && sourceBranch !== destBranch,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreatePRRequest) =>
      postJson(`/api/repositories/${workspace}/${repo}/pull-requests`, data),
    onSuccess: (data: any) => {
      navigate(`/${workspace}/${repo}/pull-requests/${data.number}`);
    },
    onError: (err: ApiError) => {
      if (err.errors) {
        const mapped: Record<string, string> = {};
        err.errors.forEach((e) => {
          mapped[e.field] = e.message;
        });
        setFieldErrors(mapped);
      }
    },
  });

  const handleToggleReviewer = (userId: string) => {
    setReviewers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!sourceBranch) errors.sourceBranch = 'Source branch is required';
    if (!destBranch) errors.destBranch = 'Destination branch is required';
    if (sourceBranch === destBranch) errors.sourceBranch = 'Source and destination must differ';
    if (!title.trim()) errors.title = 'Title is required';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    createMutation.mutate({
      title: title.trim(),
      description: description || undefined,
      sourceBranch,
      destinationBranch: destBranch,
      reviewers: reviewers.length > 0 ? reviewers : undefined,
      closeSourceBranch,
    });
  };

  // Diff stats summary
  const diffStats = useMemo(() => {
    if (!diffQuery.data) return null;
    return diffQuery.data.reduce(
      (acc, f) => ({
        files: acc.files + 1,
        additions: acc.additions + f.stats.additions,
        deletions: acc.deletions + f.stats.deletions,
      }),
      { files: 0, additions: 0, deletions: 0 }
    );
  }, [diffQuery.data]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GitPullRequest className="h-6 w-6 text-blue-600" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Create pull request
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Branch selectors */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-end gap-4">
            <BranchDropdown
              label="Source branch"
              branches={branches}
              selected={sourceBranch}
              onSelect={(b) => {
                setSourceBranch(b);
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.sourceBranch;
                  return next;
                });
              }}
            />
            <ArrowRight className="h-5 w-5 text-gray-400 shrink-0 mb-2" />
            <BranchDropdown
              label="Destination branch"
              branches={branches}
              selected={destBranch}
              onSelect={(b) => {
                setDestBranch(b);
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.destBranch;
                  return next;
                });
              }}
            />
          </div>
          {(fieldErrors.sourceBranch || fieldErrors.destBranch) && (
            <div className="mt-2 text-sm text-red-600 dark:text-red-400">
              {fieldErrors.sourceBranch || fieldErrors.destBranch}
            </div>
          )}
          {diffStats && (
            <div className="mt-3 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <FileCode2 className="h-4 w-4" />
                {diffStats.files} file{diffStats.files !== 1 ? 's' : ''} changed
              </span>
              <span className="text-green-600 dark:text-green-400">+{diffStats.additions}</span>
              <span className="text-red-600 dark:text-red-400">-{diffStats.deletions}</span>
            </div>
          )}
        </div>

        {/* Title */}
        <Input
          label="Title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setFieldErrors((prev) => {
              const next = { ...prev };
              delete next.title;
              return next;
            });
          }}
          placeholder="Pull request title"
          error={fieldErrors.title}
        />

        {/* Description */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Description
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPreviewMarkdown(false)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  !previewMarkdown
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Edit3 className="h-3 w-3 inline mr-1" />
                Write
              </button>
              <button
                type="button"
                onClick={() => setPreviewMarkdown(true)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  previewMarkdown
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Eye className="h-3 w-3 inline mr-1" />
                Preview
              </button>
            </div>
          </div>
          {previewMarkdown ? (
            <div className="min-h-[150px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-3">
              {description ? (
                <div className="prose dark:prose-invert max-w-none text-sm whitespace-pre-wrap">
                  {description}
                </div>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                  Nothing to preview.
                </p>
              )}
            </div>
          ) : (
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the changes in this pull request... (Markdown supported)"
              className="min-h-[150px]"
            />
          )}
        </div>

        {/* Reviewers */}
        <ReviewerSelector
          workspace={workspace!}
          selected={reviewers}
          onToggle={handleToggleReviewer}
        />

        {/* Close source branch */}
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={closeSourceBranch}
            onChange={(e) => setCloseSourceBranch(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
          />
          Close source branch when this pull request is merged
        </label>

        {/* Error */}
        {createMutation.isError && !(createMutation.error as ApiError)?.errors?.length && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-700 dark:text-red-300">
            {(createMutation.error as ApiError)?.message || 'Failed to create pull request.'}
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="secondary"
            type="button"
            onClick={() => navigate(`/${workspace}/${repo}/pull-requests`)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={createMutation.isPending}
            leftIcon={<GitPullRequest className="h-4 w-4" />}
          >
            Create pull request
          </Button>
        </div>
      </form>

      {/* Diff preview */}
      {sourceBranch && destBranch && sourceBranch !== destBranch && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <FileCode2 className="h-5 w-5 text-gray-400" />
            Diff preview
          </h2>

          {diffQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : diffQuery.isError ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
              <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">Failed to load diff preview.</p>
            </div>
          ) : !diffQuery.data?.length ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400 text-sm">No differences between branches.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {diffQuery.data.map((file) => (
                <div
                  key={file.oldPath || file.newPath}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center gap-2">
                    <Badge
                      color={
                        file.status === 'added'
                          ? 'green'
                          : file.status === 'deleted'
                            ? 'red'
                            : 'yellow'
                      }
                      size="sm"
                    >
                      {file.status}
                    </Badge>
                    <span className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate">
                      {file.newPath || file.oldPath}
                    </span>
                    <span className="ml-auto text-xs text-gray-400">
                      <span className="text-green-600">+{file.stats.additions}</span>{' '}
                      <span className="text-red-600">-{file.stats.deletions}</span>
                    </span>
                  </div>
                  {file.isBinary ? (
                    <div className="p-3 text-xs text-gray-500 text-center">Binary file</div>
                  ) : (
                    <div className="overflow-x-auto max-h-64">
                      {file.hunks.map((hunk, hi) => (
                        <div key={hi}>
                          <div className="px-4 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-600 dark:text-blue-400 font-mono">
                            {hunk.header}
                          </div>
                          {hunk.lines.map((line, li) => (
                            <div
                              key={li}
                              className={[
                                'flex font-mono text-xs leading-5',
                                line.type === 'addition'
                                  ? 'bg-green-50 dark:bg-green-900/10'
                                  : line.type === 'deletion'
                                    ? 'bg-red-50 dark:bg-red-900/10'
                                    : '',
                              ].join(' ')}
                            >
                              <span className="select-none w-8 text-right pr-1 text-gray-400 shrink-0">
                                {line.oldLineNumber ?? ''}
                              </span>
                              <span className="select-none w-8 text-right pr-1 text-gray-400 shrink-0">
                                {line.newLineNumber ?? ''}
                              </span>
                              <span
                                className={[
                                  'px-2 whitespace-pre flex-1',
                                  line.type === 'addition'
                                    ? 'text-green-800 dark:text-green-300'
                                    : line.type === 'deletion'
                                      ? 'text-red-800 dark:text-red-300'
                                      : 'text-gray-600 dark:text-gray-400',
                                ].join(' ')}
                              >
                                {line.type === 'addition'
                                  ? '+'
                                  : line.type === 'deletion'
                                    ? '-'
                                    : ' '}
                                {line.content}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
