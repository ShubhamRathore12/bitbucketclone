import React, { useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Plus,
  Search,
  Edit3,
  Trash2,
  Eye,
  ChevronRight,
  ChevronDown,
  FileText,
  AlertCircle,
  Clock,
  Save,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import type { UserReference, ApiError } from '@/types/common';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WikiPageEntry {
  slug: string;
  title: string;
  children: WikiPageEntry[];
}

interface WikiPageContent {
  slug: string;
  title: string;
  content: string;
  renderedContent: string;
  author: UserReference;
  updatedAt: string;
  version: number;
}

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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('access_token')}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('API error');
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
  if (!res.ok) throw new Error('API error');
  return res.json();
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`} />;
}

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
// Sidebar navigation tree
// ---------------------------------------------------------------------------

function NavTree({
  pages,
  currentSlug,
  basePath,
  depth = 0,
}: {
  pages: WikiPageEntry[];
  currentSlug: string;
  basePath: string;
  depth?: number;
}) {
  return (
    <ul className={depth > 0 ? 'ml-4' : ''}>
      {pages.map((page) => {
        const isActive = page.slug === currentSlug;
        const [expanded, setExpanded] = React.useState(true);
        const hasChildren = page.children.length > 0;

        return (
          <li key={page.slug}>
            <div className="flex items-center group">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer"
                >
                  {expanded ? (
                    <ChevronDown className="h-3 w-3 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-gray-400" />
                  )}
                </button>
              ) : (
                <span className="w-4" />
              )}
              <Link
                to={`${basePath}/${page.slug}`}
                className={[
                  'flex-1 px-2 py-1 rounded text-sm truncate transition-colors',
                  isActive
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50',
                ].join(' ')}
              >
                {page.title}
              </Link>
            </div>
            {hasChildren && expanded && (
              <NavTree
                pages={page.children}
                currentSlug={currentSlug}
                basePath={basePath}
                depth={depth + 1}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// WikiPage
// ---------------------------------------------------------------------------

export default function WikiPage() {
  const { workspace, repo, '*': slugWild } = useParams<{
    workspace: string;
    repo: string;
    '*': string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const currentSlug = slugWild || 'home';
  const basePath = `/${workspace}/${repo}/wiki`;
  const apiBase = `/api/repositories/${workspace}/${repo}/wiki`;

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  // Navigation tree
  const treeQuery = useQuery<WikiPageEntry[]>({
    queryKey: ['wiki-tree', workspace, repo],
    queryFn: () => fetchJson(`${apiBase}/pages`),
    enabled: !!workspace && !!repo,
  });

  // Current page content
  const pageQuery = useQuery<WikiPageContent>({
    queryKey: ['wiki-page', workspace, repo, currentSlug],
    queryFn: () => fetchJson(`${apiBase}/pages/${currentSlug}`),
    enabled: !!workspace && !!repo,
  });

  // Save edits
  const saveMutation = useMutation({
    mutationFn: () =>
      putJson(`${apiBase}/pages/${currentSlug}`, {
        title: editTitle,
        content: editContent,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki-page', workspace, repo, currentSlug] });
      queryClient.invalidateQueries({ queryKey: ['wiki-tree', workspace, repo] });
      setEditing(false);
    },
  });

  // Create new page
  const createMutation = useMutation({
    mutationFn: () =>
      postJson(`${apiBase}/pages`, {
        title: newTitle,
        content: newContent,
        parentSlug: currentSlug !== 'home' ? currentSlug : undefined,
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['wiki-tree', workspace, repo] });
      setShowCreate(false);
      setNewTitle('');
      setNewContent('');
      navigate(`${basePath}/${data.slug}`);
    },
  });

  const startEditing = () => {
    if (pageQuery.data) {
      setEditTitle(pageQuery.data.title);
      setEditContent(pageQuery.data.content);
      setEditing(true);
    }
  };

  const page = pageQuery.data;

  return (
    <div className="flex gap-6 min-h-[500px]">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 hidden lg:block">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sticky top-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-gray-400" />
              Pages
            </h3>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              title="New page"
            >
              <Plus className="h-4 w-4 text-gray-400" />
            </button>
          </div>

          {treeQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          ) : treeQuery.isError ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">Failed to load pages.</p>
          ) : !treeQuery.data?.length ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">No pages yet.</p>
          ) : (
            <NavTree
              pages={treeQuery.data}
              currentSlug={currentSlug}
              basePath={basePath}
            />
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {editing ? (
          /* Wiki Editor */
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-gray-400" />
                Editing: {editTitle}
              </h2>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  <X className="h-4 w-4" /> Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Save className="h-4 w-4" />}
                  loading={saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  Save
                </Button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <Input
                label="Title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
              <Textarea
                label="Content (Markdown)"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
              />
            </div>
          </div>
        ) : pageQuery.isLoading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : pageQuery.isError ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-10 text-center">
            <FileText className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <h3 className="text-gray-900 dark:text-white font-medium mb-1">Page not found</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              The page &ldquo;{currentSlug}&rdquo; does not exist yet.
            </p>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setNewTitle(currentSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
                setShowCreate(true);
              }}
            >
              Create this page
            </Button>
          </div>
        ) : page ? (
          /* Wiki page content */
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{page.title}</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
                  <Avatar
                    src={page.author.avatarUrl}
                    name={page.author.displayName}
                    size="xs"
                  />
                  Last edited by {page.author.displayName} {relativeTime(page.updatedAt)}
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  v{page.version}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Edit3 className="h-4 w-4" />}
                  onClick={startEditing}
                >
                  Edit
                </Button>
              </div>
            </div>
            <div className="p-5">
              <div
                className="prose dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: page.renderedContent }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Create page modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create wiki page"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={createMutation.isPending}
              disabled={!newTitle.trim()}
              onClick={() => createMutation.mutate()}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Page title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Getting Started"
          />
          <Textarea
            label="Content (Markdown)"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Write your page content..."
            className="min-h-[200px]"
          />
        </div>
      </Modal>
    </div>
  );
}
