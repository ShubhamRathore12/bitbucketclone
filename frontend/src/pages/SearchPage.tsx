import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Code2,
  FolderGit2,
  FileCode2,
  GitPullRequest,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import type { PaginatedResponse } from '@/types/common';
import type { RepositorySearchResult, CodeSearchResult } from '@/types/repo';

// ---------------------------------------------------------------------------
// Types for search results
// ---------------------------------------------------------------------------

interface PRSearchResult {
  id: string;
  number: number;
  title: string;
  state: string;
  repository: { fullName: string };
  author: { displayName: string };
  createdAt: string;
}

interface IssueSearchResult {
  id: string;
  number: number;
  title: string;
  state: string;
  repository: { fullName: string };
  reporter: { displayName: string };
  createdAt: string;
}

type SearchTab = 'code' | 'repositories' | 'pull-requests' | 'issues';

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

// ---------------------------------------------------------------------------
// SearchPage
// ---------------------------------------------------------------------------

const tabDefs: { value: SearchTab; label: string; icon: React.ReactNode }[] = [
  { value: 'code', label: 'Code', icon: <Code2 className="h-4 w-4" /> },
  { value: 'repositories', label: 'Repositories', icon: <FolderGit2 className="h-4 w-4" /> },
  { value: 'pull-requests', label: 'Pull Requests', icon: <GitPullRequest className="h-4 w-4" /> },
  { value: 'issues', label: 'Issues', icon: <AlertCircle className="h-4 w-4" /> },
];

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const tab = (searchParams.get('type') as SearchTab) || 'code';
  const page = parseInt(searchParams.get('page') || '1', 10);

  const [searchInput, setSearchInput] = useState(query);

  // Sync input when URL changes
  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    const params = new URLSearchParams();
    params.set('q', searchInput.trim());
    params.set('type', tab);
    setSearchParams(params);
  };

  const handleTabChange = (newTab: SearchTab) => {
    const params = new URLSearchParams(searchParams);
    params.set('type', newTab);
    params.delete('page');
    setSearchParams(params);
  };

  const handlePageChange = (p: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(p));
    setSearchParams(params);
  };

  // Code search
  const codeQuery = useQuery<PaginatedResponse<CodeSearchResult>>({
    queryKey: ['search', 'code', query, page],
    queryFn: () => fetchJson(`/api/search/code?q=${encodeURIComponent(query)}&page=${page}&pageSize=20`),
    enabled: !!query && tab === 'code',
  });

  // Repository search
  const repoQuery = useQuery<PaginatedResponse<RepositorySearchResult>>({
    queryKey: ['search', 'repositories', query, page],
    queryFn: () => fetchJson(`/api/search/repositories?q=${encodeURIComponent(query)}&page=${page}&pageSize=20`),
    enabled: !!query && tab === 'repositories',
  });

  // PR search
  const prQuery = useQuery<PaginatedResponse<PRSearchResult>>({
    queryKey: ['search', 'pull-requests', query, page],
    queryFn: () => fetchJson(`/api/search/pull-requests?q=${encodeURIComponent(query)}&page=${page}&pageSize=20`),
    enabled: !!query && tab === 'pull-requests',
  });

  // Issue search
  const issueQuery = useQuery<PaginatedResponse<IssueSearchResult>>({
    queryKey: ['search', 'issues', query, page],
    queryFn: () => fetchJson(`/api/search/issues?q=${encodeURIComponent(query)}&page=${page}&pageSize=20`),
    enabled: !!query && tab === 'issues',
  });

  const activeQuery =
    tab === 'code' ? codeQuery :
    tab === 'repositories' ? repoQuery :
    tab === 'pull-requests' ? prQuery : issueQuery;

  // ---------------------------------------------------------------------------
  // Render results
  // ---------------------------------------------------------------------------

  const renderCodeResults = () => {
    if (!codeQuery.data?.data.length) return null;
    return (
      <div className="space-y-4">
        {codeQuery.data.data.map((result, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <Link
                to={`/${result.repository.fullName}/src/main/${result.path}`}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-mono"
              >
                {result.repository.fullName}/{result.path}
              </Link>
            </div>
            <pre className="text-xs font-mono overflow-x-auto p-3">
              {result.matchLines.map((line) => (
                <div
                  key={line.lineNumber}
                  className={[
                    'flex',
                    line.isMatch ? 'bg-yellow-50 dark:bg-yellow-900/10' : '',
                  ].join(' ')}
                >
                  <span className="select-none text-gray-400 w-10 text-right pr-3 shrink-0">
                    {line.lineNumber}
                  </span>
                  <span className={line.isMatch ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}>
                    {line.content}
                  </span>
                </div>
              ))}
            </pre>
          </div>
        ))}
      </div>
    );
  };

  const renderRepoResults = () => {
    if (!repoQuery.data?.data.length) return null;
    return (
      <div className="space-y-3">
        {repoQuery.data.data.map((result) => (
          <Link
            key={result.repository.id}
            to={`/${result.repository.fullName}`}
            className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-all"
          >
            <div className="flex items-center gap-2">
              <FolderGit2 className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                {result.repository.fullName}
              </h3>
              {result.repository.isPrivate && <Badge color="gray" size="sm">Private</Badge>}
            </div>
            {result.repository.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                {result.repository.description}
              </p>
            )}
            {result.matchHighlight && (
              <p
                className="text-xs text-gray-600 dark:text-gray-300 mt-1"
                dangerouslySetInnerHTML={{ __html: result.matchHighlight }}
              />
            )}
          </Link>
        ))}
      </div>
    );
  };

  const renderPRResults = () => {
    if (!prQuery.data?.data.length) return null;
    return (
      <div className="space-y-3">
        {prQuery.data.data.map((pr) => (
          <Link
            key={pr.id}
            to={`/${pr.repository.fullName}/pull-requests/${pr.number}`}
            className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-all"
          >
            <div className="flex items-center gap-2">
              <GitPullRequest className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {pr.title}
              </h3>
              <Badge color={pr.state === 'open' ? 'blue' : pr.state === 'merged' ? 'green' : 'red'} size="sm">
                {pr.state}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              #{pr.number} &middot; {pr.repository.fullName} &middot; by {pr.author.displayName}
            </p>
          </Link>
        ))}
      </div>
    );
  };

  const renderIssueResults = () => {
    if (!issueQuery.data?.data.length) return null;
    return (
      <div className="space-y-3">
        {issueQuery.data.data.map((issue) => (
          <Link
            key={issue.id}
            to={`/${issue.repository.fullName}/issues/${issue.number}`}
            className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-all"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-green-500" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{issue.title}</h3>
              <Badge color={issue.state === 'open' || issue.state === 'new' ? 'blue' : 'gray'} size="sm">
                {issue.state}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              #{issue.number} &middot; {issue.repository.fullName} &middot; by {issue.reporter.displayName}
            </p>
          </Link>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search input */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search across all repositories..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                prefixIcon={<Search className="h-4 w-4" />}
                inputSize="lg"
              />
            </div>
            <Button type="submit" variant="primary" size="lg">
              Search
            </Button>
          </div>
        </form>

        {!query ? (
          <div className="text-center py-20">
            <Search className="h-16 w-16 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Search everything
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Search for code, repositories, pull requests, and issues across all your workspaces.
            </p>
          </div>
        ) : (
          <>
            {/* Tab navigation */}
            <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 mb-6">
              {tabDefs.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => handleTabChange(t.value)}
                  className={[
                    'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer',
                    tab === t.value
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
                  ].join(' ')}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            {/* Results */}
            {activeQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                    <Skeleton className="h-4 w-2/3 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : activeQuery.isError ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-10 text-center">
                <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">Search failed. Please try again.</p>
              </div>
            ) : !activeQuery.data?.data?.length ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-10 text-center">
                <Search className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <h3 className="text-gray-900 dark:text-white font-medium mb-1">No results</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No {tab.replace('-', ' ')} found for &ldquo;{query}&rdquo;.
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {activeQuery.data.totalItems} result{activeQuery.data.totalItems !== 1 ? 's' : ''}
                </p>
                {tab === 'code' && renderCodeResults()}
                {tab === 'repositories' && renderRepoResults()}
                {tab === 'pull-requests' && renderPRResults()}
                {tab === 'issues' && renderIssueResults()}
              </>
            )}

            {/* Pagination */}
            {activeQuery.data && activeQuery.data.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-6">
                <Button variant="outline" size="sm" disabled={!activeQuery.data.hasPrevious} onClick={() => handlePageChange(page - 1)} leftIcon={<ChevronLeft className="h-4 w-4" />}>
                  Previous
                </Button>
                <span className="text-sm text-gray-500 dark:text-gray-400 px-3">
                  Page {activeQuery.data.page} of {activeQuery.data.totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={!activeQuery.data.hasNext} onClick={() => handlePageChange(page + 1)} rightIcon={<ChevronRight className="h-4 w-4" />}>
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
