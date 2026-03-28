import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  Check,
  RotateCcw,
  Pencil,
  Trash2,
  Bot,
  CornerDownRight,
} from 'lucide-react';
import type { PRComment } from '@/types/pr';

interface InlineCommentProps {
  comment: PRComment;
  repoFullName: string;
  prNumber: number;
  isReply?: boolean;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function InlineComment({ comment, repoFullName, prNumber, isReply = false }: InlineCommentProps) {
  const [replying, setReplying] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);

  const queryClient = useQueryClient();

  const isAI = comment.author.username === 'claude-ai' || comment.author.username.startsWith('ai-');

  const replyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/repositories/${repoFullName}/pull-requests/${prNumber}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: replyContent,
            parentId: comment.id,
            inline: comment.inline,
          }),
        }
      );
      if (!res.ok) throw new Error('Failed to post reply');
      return res.json();
    },
    onSuccess: () => {
      setReplying(false);
      setReplyContent('');
      queryClient.invalidateQueries({ queryKey: ['pr-inline-comments', repoFullName, prNumber] });
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/repositories/${repoFullName}/pull-requests/${prNumber}/comments/${comment.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: editContent }),
        }
      );
      if (!res.ok) throw new Error('Failed to edit comment');
      return res.json();
    },
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['pr-inline-comments', repoFullName, prNumber] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/repositories/${repoFullName}/pull-requests/${prNumber}/comments/${comment.id}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Failed to delete comment');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pr-inline-comments', repoFullName, prNumber] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/repositories/${repoFullName}/pull-requests/${prNumber}/comments/${comment.id}/resolve`,
        { method: 'PUT' }
      );
      if (!res.ok) throw new Error('Failed to toggle resolve');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pr-inline-comments', repoFullName, prNumber] });
    },
  });

  if (comment.isDeleted) {
    return (
      <div className="text-sm text-gray-400 italic dark:text-gray-500 py-1">
        This comment has been deleted.
      </div>
    );
  }

  return (
    <div
      className={[
        'rounded-md',
        isAI ? 'border-l-4 border-l-purple-500 bg-purple-50/50 dark:bg-purple-900/10' : '',
        isReply ? 'ml-6' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Header */}
      <div className="flex items-center gap-2 text-sm">
        <img
          src={comment.author.avatarUrl}
          alt=""
          className="h-5 w-5 rounded-full"
        />
        <span className="font-medium text-gray-800 dark:text-gray-200">
          {comment.author.displayName}
        </span>
        {isAI && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full dark:bg-purple-900/30 dark:text-purple-300">
            <Bot className="h-3 w-3" />
            AI
          </span>
        )}
        <span className="text-gray-400 dark:text-gray-500 text-xs">
          {relativeTime(comment.createdAt)}
        </span>
        {comment.isResolved && (
          <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 ml-auto">
            <Check className="h-3.5 w-3.5" />
            Resolved
          </span>
        )}
      </div>

      {/* Content */}
      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md resize-y
              focus:outline-none focus:ring-2 focus:ring-blue-500
              dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setEditing(false); setEditContent(comment.content); }}
              className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded dark:text-gray-400 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={() => editMutation.mutate()}
              disabled={editMutation.isPending}
              className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div
          className="mt-1 text-sm text-gray-700 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: comment.renderedContent }}
        />
      )}

      {/* Actions */}
      {!editing && (
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={() => setReplying(!replying)}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Reply
          </button>
          {!isReply && (
            <button
              onClick={() => resolveMutation.mutate()}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400"
            >
              {comment.isResolved ? (
                <>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Unresolve
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Resolve
                </>
              )}
            </button>
          )}
          {!isAI && (
            <>
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                onClick={() => {
                  if (confirm('Delete this comment?')) deleteMutation.mutate();
                }}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </>
          )}
        </div>
      )}

      {/* Reply form */}
      {replying && (
        <div className="mt-3 ml-6 space-y-2">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <CornerDownRight className="h-3.5 w-3.5" />
            Reply
          </div>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            rows={2}
            placeholder="Write a reply..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md resize-y
              focus:outline-none focus:ring-2 focus:ring-blue-500
              dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setReplying(false); setReplyContent(''); }}
              className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded dark:text-gray-400 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={() => replyMutation.mutate()}
              disabled={!replyContent.trim() || replyMutation.isPending}
              className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
            >
              {replyMutation.isPending ? 'Posting...' : 'Reply'}
            </button>
          </div>
        </div>
      )}

      {/* Threaded replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {comment.replies.map((reply) => (
            <InlineComment
              key={reply.id}
              comment={reply}
              repoFullName={repoFullName}
              prNumber={prNumber}
              isReply
            />
          ))}
        </div>
      )}
    </div>
  );
}
