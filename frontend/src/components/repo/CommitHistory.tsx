import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  GitCommit,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { Commit } from '@/types/repos';
import type { PaginatedResponse } from '@/types/common';

interface CommitHistoryProps {
  repoFullName: string;
  branch: string;
  filePath?: string;
  onCommitClick?: (hash: string) => void;
  onBrowseAtCommit?: (hash: string) => void;
}

async function fetchCommits(
  repoFullName: string,
  branch: string,
  page: number,
  filePath?: string
): Promise<PaginatedResponse<Commit>> {
  const params = new URLSearchParams({
    ref: branch,
    page: String(page),
    pageSize: '30',
  });
  if (filePath) params.set('path', filePath);
  const res = await fetch(`/api/repositories/${repoFullName}/commits?${params}`);
  if (!res.ok) throw new Error('Failed to fetch commits');
  return res.json();
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)} weeks ago`;
  return new Date(dateStr).toLocaleDateString();
}

function CommitRow({
  commit,
  onCommitClick,
  onBrowseAtCommit,
}: {
  commit: Commit;
  onCommitClick?: (hash: string) => void;
  onBrowseAtCommit?: (hash: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const lines = commit.message.split('\n');
  const title = lines[0];
  const body = lines.slice(1).join('\n').trim();
  const shortHash = commit.hash.substring(0, 7);

  const handleCopySha = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(commit.hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <img
          src={commit.author.avatarUrl}
          alt={commit.author.displayName}
          className="h-8 w-8 rounded-full shrink-0 mt-0.5"
        />

        <div className="flex-1 min-w-0">
          {/* Title line */}
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <button
                onClick={() => onCommitClick?.(commit.hash)}
                className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600
                  dark:hover:text-blue-400 text-left break-words"
              >
                {title}
              </button>
              {body && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="ml-2 inline-flex items-center text-xs text-gray-500 hover:text-gray-700
                    dark:text-gray-400 dark:hover:text-gray-300"
                >
                  {expanded ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* SHA + copy */}
              <div className="flex items-center border border-gray-200 rounded-md dark:border-gray-700 overflow-hidden">
                <button
                  onClick={() => onCommitClick?.(commit.hash)}
                  className="px-2 py-1 text-xs font-mono text-blue-600 dark:text-blue-400 hover:bg-gray-100
                    dark:hover:bg-gray-700"
                >
                  {shortHash}
                </button>
                <button
                  onClick={handleCopySha}
                  className="px-1.5 py-1 border-l border-gray-200 dark:border-gray-700
                    hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                  title="Copy full SHA"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              {/* Browse at commit */}
              {onBrowseAtCommit && (
                <button
                  onClick={() => onBrowseAtCommit(commit.hash)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  title="Browse repository at this point"
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Author + timestamp */}
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium">{commit.author.displayName}</span>
            <span>committed {relativeTime(commit.date)}</span>
            {commit.stats && (
              <span className="ml-auto">
                <span className="text-green-600 dark:text-green-400">+{commit.stats.additions}</span>
                {' / '}
                <span className="text-red-600 dark:text-red-400">-{commit.stats.deletions}</span>
              </span>
            )}
          </div>

          {/* Expanded body */}
          {expanded && body && (
            <pre className="mt-2 text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800 rounded-md p-3 border border-gray-100 dark:border-gray-700">
              {body}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CommitHistory({
  repoFullName,
  branch,
  filePath,
  onCommitClick,
  onBrowseAtCommit,
}: CommitHistoryProps) {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['commits', repoFullName, branch, filePath, page],
    queryFn: () => fetchCommits(repoFullName, branch, page, filePath),
    placeholderData: (prev) => prev,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md dark:bg-red-900/20 dark:border-red-800">
        <AlertCircle className="h-5 w-5 text-red-500" />
        <p className="text-sm text-red-700 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load commits'}
        </p>
      </div>
    );
  }

  const commits = data?.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <GitCommit className="h-4 w-4" />
        <span className="font-medium">
          {data?.totalItems ?? 0} commits
        </span>
      </div>

      <div className="border border-gray-200 rounded-md divide-y divide-gray-200 dark:border-gray-700 dark:divide-gray-700">
        {commits.map((commit) => (
          <CommitRow
            key={commit.hash}
            commit={commit}
            onCommitClick={onCommitClick}
            onBrowseAtCommit={onBrowseAtCommit}
          />
        ))}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            disabled={!data.hasPrevious}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50
              hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200"
          >
            Newer
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Page {page} of {data.totalPages}
          </span>
          <button
            disabled={!data.hasNext}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50
              hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200"
          >
            Older
          </button>
        </div>
      )}
    </div>
  );
}
