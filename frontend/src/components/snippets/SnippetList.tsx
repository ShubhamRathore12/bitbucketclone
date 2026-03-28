import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  FileCode,
  Lock,
  Globe,
  Clock,
  Plus,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { Snippet, ListSnippetsParams } from '@/types/snippets';
import type { PaginatedResponse } from '@/types/common';

interface SnippetListProps {
  onSnippetClick?: (snippet: Snippet) => void;
  onCreateSnippet?: () => void;
}

async function fetchSnippets(params: ListSnippetsParams): Promise<PaginatedResponse<Snippet>> {
  const query = new URLSearchParams();
  if (params.query) query.set('query', params.query);
  if (params.role) query.set('role', params.role);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  const res = await fetch(`/api/snippets?${query}`);
  if (!res.ok) throw new Error('Failed to fetch snippets');
  return res.json();
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

export default function SnippetList({ onSnippetClick, onCreateSnippet }: SnippetListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['snippets', searchQuery, visibilityFilter, page],
    queryFn: () =>
      fetchSnippets({
        query: searchQuery || undefined,
        page,
        pageSize: 25,
      }),
    placeholderData: (prev) => prev,
  });

  const filteredSnippets = data?.data.filter((s) => {
    if (visibilityFilter === 'public') return !s.isPrivate;
    if (visibilityFilter === 'private') return s.isPrivate;
    return true;
  }) ?? [];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search snippets..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md bg-white
              focus:outline-none focus:ring-2 focus:ring-blue-500
              dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
          />
        </div>

        <div className="flex border border-gray-200 rounded-md overflow-hidden dark:border-gray-700">
          {(['all', 'public', 'private'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVisibilityFilter(v)}
              className={[
                'px-3 py-1.5 text-sm font-medium capitalize transition-colors',
                visibilityFilter === v
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
              ].join(' ')}
            >
              {v}
            </button>
          ))}
        </div>

        {onCreateSnippet && (
          <button
            onClick={onCreateSnippet}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white
              bg-blue-600 hover:bg-blue-700 rounded-md transition-colors ml-auto"
          >
            <Plus className="h-4 w-4" />
            Create snippet
          </button>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md dark:bg-red-900/20 dark:border-red-800">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-700 dark:text-red-400">
            {error instanceof Error ? error.message : 'Failed to load snippets'}
          </p>
        </div>
      )}

      {data && !isLoading && (
        <>
          {filteredSnippets.length === 0 ? (
            <div className="text-center py-12">
              <FileCode className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No snippets found.</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-md divide-y divide-gray-200 dark:border-gray-700 dark:divide-gray-700">
              {filteredSnippets.map((snippet) => (
                <button
                  key={snippet.id}
                  onClick={() => onSnippetClick?.(snippet)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex items-start gap-3"
                >
                  <FileCode className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{snippet.title}</span>
                      {snippet.isPrivate ? (
                        <Lock className="h-3.5 w-3.5 text-orange-500" />
                      ) : (
                        <Globe className="h-3.5 w-3.5 text-green-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <img src={snippet.owner.avatarUrl} alt="" className="h-3.5 w-3.5 rounded-full" />
                        {snippet.owner.displayName}
                      </span>
                      <span>{snippet.files.length} file{snippet.files.length !== 1 ? 's' : ''}</span>
                      <span className="inline-flex items-center gap-1">
                        {snippet.files.map((f) => f.language).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {relativeTime(snippet.updatedAt)}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                disabled={!data.hasPrevious}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50
                  hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">Page {page} of {data.totalPages}</span>
              <button
                disabled={!data.hasNext}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50
                  hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
