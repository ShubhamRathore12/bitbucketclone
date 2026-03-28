import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Code2,
  Lock,
  Globe,
  Copy,
  Check,
  Download,
  Edit3,
  Trash2,
  MessageSquare,
  AlertCircle,
  ArrowLeft,
  FileCode2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import type { UserReference } from '@/types/common';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SnippetDetail {
  id: string;
  title: string;
  isPrivate: boolean;
  creator: UserReference;
  files: SnippetFile[];
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

interface SnippetFile {
  filename: string;
  language: string;
  content: string;
  size: number;
  lineCount: number;
}

interface SnippetComment {
  id: string;
  author: UserReference;
  content: string;
  renderedContent: string;
  createdAt: string;
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

async function deleteRequest(url: string): Promise<void> {
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
  });
  if (!res.ok) throw new Error('API error');
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
// SnippetDetailPage
// ---------------------------------------------------------------------------

export default function SnippetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [showDelete, setShowDelete] = useState(false);

  const snippetQuery = useQuery<SnippetDetail>({
    queryKey: ['snippet', id],
    queryFn: () => fetchJson(`/api/snippets/${id}`),
    enabled: !!id,
  });

  const commentsQuery = useQuery<SnippetComment[]>({
    queryKey: ['snippet-comments', id],
    queryFn: () => fetchJson(`/api/snippets/${id}/comments`),
    enabled: !!id,
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) => postJson(`/api/snippets/${id}/comments`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snippet-comments', id] });
      setCommentText('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteRequest(`/api/snippets/${id}`),
    onSuccess: () => navigate('/snippets'),
  });

  const handleCopyFile = async (filename: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedFile(filename);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  const snippet = snippetQuery.data;

  // Loading
  if (snippetQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (snippetQuery.isError || !snippet) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Snippet not found
          </h2>
          <Button variant="primary" onClick={() => navigate('/snippets')}>
            Back to snippets
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <Link
          to="/snippets"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to snippets
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <Avatar
              src={snippet.creator.avatarUrl}
              name={snippet.creator.displayName}
              size="md"
            />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                {snippet.title || 'Untitled snippet'}
                {snippet.isPrivate ? (
                  <Lock className="h-4 w-4 text-gray-400" />
                ) : (
                  <Globe className="h-4 w-4 text-gray-400" />
                )}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Created by {snippet.creator.displayName} {relativeTime(snippet.createdAt)}
                {snippet.updatedAt !== snippet.createdAt &&
                  ` (updated ${relativeTime(snippet.updatedAt)})`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Edit3 className="h-4 w-4" />}
              onClick={() => navigate(`/snippets/${id}/edit`)}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Files */}
        <div className="space-y-4 mb-8">
          {snippet.files.map((file) => (
            <div
              key={file.filename}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <FileCode2 className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {file.filename}
                  </span>
                  {file.language && (
                    <Badge color="blue" size="sm">{file.language}</Badge>
                  )}
                  <span className="text-gray-400 text-xs">
                    {file.lineCount} lines &middot; {(file.size / 1024).toFixed(1)} KB
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyFile(file.filename, file.content)}
                  >
                    {copiedFile === file.filename ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <pre className="text-sm font-mono overflow-x-auto">
                <code>
                  {file.content.split('\n').map((line, idx) => (
                    <div key={idx} className="flex hover:bg-blue-50 dark:hover:bg-blue-900/10">
                      <span className="select-none text-gray-400 dark:text-gray-600 text-right w-10 pr-3 shrink-0 border-r border-gray-100 dark:border-gray-700">
                        {idx + 1}
                      </span>
                      <span className="pl-3 text-gray-800 dark:text-gray-200 whitespace-pre">
                        {line}
                      </span>
                    </div>
                  ))}
                </code>
              </pre>
            </div>
          ))}
        </div>

        {/* Comments */}
        <div className="space-y-4">
          <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-gray-400" />
            Comments ({commentsQuery.data?.length || 0})
          </h3>

          {commentsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : commentsQuery.data?.length ? (
            <div className="space-y-3">
              {commentsQuery.data.map((comment) => (
                <div
                  key={comment.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar src={comment.author.avatarUrl} name={comment.author.displayName} size="xs" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {comment.author.displayName}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {relativeTime(comment.createdAt)}
                    </span>
                  </div>
                  <div
                    className="prose dark:prose-invert max-w-none text-sm"
                    dangerouslySetInnerHTML={{ __html: comment.renderedContent }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No comments yet.</p>
          )}

          {/* Add comment */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Leave a comment..."
              className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-y"
            />
            <div className="flex justify-end mt-2">
              <Button
                variant="primary"
                size="sm"
                loading={commentMutation.isPending}
                disabled={!commentText.trim()}
                onClick={() => commentMutation.mutate(commentText)}
              >
                Comment
              </Button>
            </div>
          </div>
        </div>

        {/* Delete modal */}
        <Modal
          open={showDelete}
          onClose={() => setShowDelete(false)}
          title="Delete snippet"
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowDelete(false)}>Cancel</Button>
              <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
                Delete
              </Button>
            </>
          }
        >
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to delete this snippet? This action cannot be undone.
          </p>
        </Modal>
      </div>
    </div>
  );
}
