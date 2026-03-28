import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Code2,
  Plus,
  Search,
  Lock,
  Globe,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import type { PaginatedResponse, UserReference } from '@/types/common';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Snippet {
  id: string;
  title: string;
  isPrivate: boolean;
  creator: UserReference;
  language: string;
  files: { filename: string; language: string }[];
  commentCount: number;
  createdAt: string;
  updatedAt: string;
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
// SnippetsPage (aliased as SnippetListPage)
// ---------------------------------------------------------------------------

export default function SnippetsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1', 10);
  const query = searchParams.get('q') || '';
  const [searchInput, setSearchInput] = useState(query);

  const snippetsQuery = useQuery<PaginatedResponse<Snippet>>({
    queryKey: ['snippets', page, query],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', '20');
      if (query) params.set('q', query);
      return fetchJson(`/api/snippets?${params.toString()}`);
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchInput) params.set('q', searchInput);
    else params.delete('q');
    params.delete('page');
    setSearchParams(params);
  };

  const handlePageChange = (p: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(p));
    setSearchParams(params);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Code2 className="h-6 w-6 text-gray-400" />
              Snippets
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Share code snippets with your team
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => navigate('/snippets/create')}
          >
            Create snippet
          </Button>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="mb-4 max-w-md">
          <Input
            placeholder="Search snippets..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            prefixIcon={<Search className="h-4 w-4" />}
            inputSize="sm"
          />
        </form>

        {/* List */}
        {snippetsQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : snippetsQuery.isError ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-10 text-center">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Failed to load snippets.</p>
          </div>
        ) : !snippetsQuery.data?.data.length ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-10 text-center">
            <Code2 className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <h3 className="text-gray-900 dark:text-white font-medium mb-1">No snippets</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {query ? 'No snippets match your search.' : 'Create your first snippet to share code.'}
            </p>
            {!query && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => navigate('/snippets/create')}
              >
                Create snippet
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {snippetsQuery.data.data.map((snippet) => (
              <Link
                key={snippet.id}
                to={`/snippets/${snippet.id}`}
                className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-3">
                  <Avatar
                    src={snippet.creator.avatarUrl}
                    name={snippet.creator.displayName}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {snippet.title || 'Untitled snippet'}
                      </h3>
                      {snippet.isPrivate ? (
                        <Lock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      ) : (
                        <Globe className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>{snippet.creator.displayName}</span>
                      <span>{relativeTime(snippet.updatedAt)}</span>
                      {snippet.language && (
                        <Badge color="blue" size="sm">{snippet.language}</Badge>
                      )}
                      {snippet.files.length > 0 && (
                        <span>{snippet.files.length} file{snippet.files.length > 1 ? 's' : ''}</span>
                      )}
                      {snippet.commentCount > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {snippet.commentCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {snippetsQuery.data && snippetsQuery.data.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-6">
            <Button
              variant="outline"
              size="sm"
              disabled={!snippetsQuery.data.hasPrevious}
              onClick={() => handlePageChange(page - 1)}
              leftIcon={<ChevronLeft className="h-4 w-4" />}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-500 dark:text-gray-400 px-3">
              Page {snippetsQuery.data.page} of {snippetsQuery.data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!snippetsQuery.data.hasNext}
              onClick={() => handlePageChange(page + 1)}
              rightIcon={<ChevronRight className="h-4 w-4" />}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
