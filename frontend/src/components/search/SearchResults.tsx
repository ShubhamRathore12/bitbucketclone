import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Code,
  GitBranch,
  User,
  FileText,
  Lock,
  Globe,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type {
  CodeSearchResult,
  CodeMatch,
  RepoSearchResult,
  UserSearchResult,
  SearchCodeParams,
  SearchReposParams,
  SearchUsersParams,
} from '@/types/search';
import type { PaginatedResponse } from '@/types/common';

type SearchTab = 'code' | 'repositories' | 'users';

interface SearchResultsProps {
  query: string;
  onRepoClick?: (fullName: string) => void;
  onUserClick?: (username: string) => void;
  onFileClick?: (repoFullName: string, path: string) => void;
}

async function searchCode(params: SearchCodeParams): Promise<PaginatedResponse<CodeSearchResult>> {
  const query = new URLSearchParams({ query: params.query, page: String(params.page ?? 1), pageSize: String(params.pageSize ?? 25) });
  const res = await fetch(`/api/search/code?${query}`);
  if (!res.ok) throw new Error('Failed to search code');
  return res.json();
}

async function searchRepos(params: SearchReposParams): Promise<PaginatedResponse<RepoSearchResult>> {
  const query = new URLSearchParams({ query: params.query, page: String(params.page ?? 1), pageSize: String(params.pageSize ?? 25) });
  const res = await fetch(`/api/search/repositories?${query}`);
  if (!res.ok) throw new Error('Failed to search repositories');
  return res.json();
}

async function searchUsers(params: SearchUsersParams): Promise<PaginatedResponse<UserSearchResult>> {
  const query = new URLSearchParams({ query: params.query, page: String(params.page ?? 1), pageSize: String(params.pageSize ?? 25) });
  const res = await fetch(`/api/search/users?${query}`);
  if (!res.ok) throw new Error('Failed to search users');
  return res.json();
}

function HighlightMatch({ content, highlights }: { content: string; highlights: { start: number; end: number }[] }) {
  if (!highlights.length) return <span>{content}</span>;

  const parts: React.ReactNode[] = [];
  let lastEnd = 0;

  highlights.forEach((h, i) => {
    if (h.start > lastEnd) {
      parts.push(<span key={`t-${i}`}>{content.slice(lastEnd, h.start)}</span>);
    }
    parts.push(
      <mark key={`h-${i}`} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
        {content.slice(h.start, h.end)}
      </mark>
    );
    lastEnd = h.end;
  });

  if (lastEnd < content.length) {
    parts.push(<span key="tail">{content.slice(lastEnd)}</span>);
  }

  return <>{parts}</>;
}

export default function SearchResults({ query, onRepoClick, onUserClick, onFileClick }: SearchResultsProps) {
  const [activeTab, setActiveTab] = useState<SearchTab>('code');
  const [page, setPage] = useState(1);

  const codeQuery = useQuery({
    queryKey: ['search-code', query, page],
    queryFn: () => searchCode({ query, page, pageSize: 25 }),
    enabled: activeTab === 'code' && !!query,
    placeholderData: (prev) => prev,
  });

  const repoQuery = useQuery({
    queryKey: ['search-repos', query, page],
    queryFn: () => searchRepos({ query, page, pageSize: 25 }),
    enabled: activeTab === 'repositories' && !!query,
    placeholderData: (prev) => prev,
  });

  const userQuery = useQuery({
    queryKey: ['search-users', query, page],
    queryFn: () => searchUsers({ query, page, pageSize: 25 }),
    enabled: activeTab === 'users' && !!query,
    placeholderData: (prev) => prev,
  });

  const currentQuery =
    activeTab === 'code' ? codeQuery :
    activeTab === 'repositories' ? repoQuery : userQuery;

  const tabs: { key: SearchTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'code', label: 'Code', icon: <Code className="h-4 w-4" />, count: codeQuery.data?.totalItems },
    { key: 'repositories', label: 'Repositories', icon: <GitBranch className="h-4 w-4" />, count: repoQuery.data?.totalItems },
    { key: 'users', label: 'Users', icon: <User className="h-4 w-4" />, count: userQuery.data?.totalItems },
  ];

  if (!query) {
    return (
      <div className="text-center py-16">
        <Search className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-gray-400">Enter a search query to find code, repositories, or users.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setPage(1); }}
              className={[
                'pb-3 text-sm font-medium border-b-2 transition-colors inline-flex items-center gap-1.5',
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
              ].join(' ')}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && (
                <span className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Loading */}
      {currentQuery.isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      )}

      {/* Error */}
      {currentQuery.isError && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md dark:bg-red-900/20 dark:border-red-800">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-700 dark:text-red-400">Search failed. Please try again.</p>
        </div>
      )}

      {/* Code results */}
      {activeTab === 'code' && codeQuery.data && (
        <>
          {codeQuery.data.data.length === 0 ? (
            <p className="text-center py-8 text-gray-500">No code results found.</p>
          ) : (
            <div className="space-y-3">
              {codeQuery.data.data.map((result, i) => (
                <div key={i} className="border border-gray-200 rounded-md dark:border-gray-700 overflow-hidden">
                  <button
                    onClick={() => onFileClick?.(result.repo.fullName, result.file)}
                    className="w-full text-left px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700
                      text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className="text-blue-600 dark:text-blue-400 font-medium">{result.repo.fullName}</span>
                    <span className="text-gray-400">/</span>
                    <span className="text-gray-700 dark:text-gray-300 truncate">{result.file}</span>
                  </button>
                  <div className="font-mono text-xs">
                    {result.matches.map((match: CodeMatch, mi: number) => (
                      <div
                        key={mi}
                        className="flex hover:bg-yellow-50 dark:hover:bg-yellow-900/10"
                      >
                        <span className="px-3 py-0.5 text-right text-gray-400 dark:text-gray-600 select-none w-12 shrink-0 bg-gray-50 dark:bg-gray-800 border-r border-gray-100 dark:border-gray-800">
                          {match.lineNumber}
                        </span>
                        <span className="px-3 py-0.5 whitespace-pre overflow-x-auto text-gray-700 dark:text-gray-300">
                          <HighlightMatch content={match.content} highlights={match.highlights} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Repository results */}
      {activeTab === 'repositories' && repoQuery.data && (
        <>
          {repoQuery.data.data.length === 0 ? (
            <p className="text-center py-8 text-gray-500">No repositories found.</p>
          ) : (
            <div className="border border-gray-200 rounded-md divide-y divide-gray-200 dark:border-gray-700 dark:divide-gray-700">
              {repoQuery.data.data.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => onRepoClick?.(repo.fullName)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-blue-600 dark:text-blue-400">{repo.fullName}</span>
                    {repo.isPrivate ? (
                      <Lock className="h-3.5 w-3.5 text-orange-500" />
                    ) : (
                      <Globe className="h-3.5 w-3.5 text-green-500" />
                    )}
                    {repo.language && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">{repo.language}</span>
                    )}
                  </div>
                  {repo.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">{repo.description}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* User results */}
      {activeTab === 'users' && userQuery.data && (
        <>
          {userQuery.data.data.length === 0 ? (
            <p className="text-center py-8 text-gray-500">No users found.</p>
          ) : (
            <div className="border border-gray-200 rounded-md divide-y divide-gray-200 dark:border-gray-700 dark:divide-gray-700">
              {userQuery.data.data.map((user) => (
                <button
                  key={user.id}
                  onClick={() => onUserClick?.(user.username)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors flex items-center gap-3"
                >
                  <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{user.displayName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Pagination */}
      {currentQuery.data && (currentQuery.data as PaginatedResponse<unknown>).totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            disabled={!(currentQuery.data as PaginatedResponse<unknown>).hasPrevious}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50
              hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {(currentQuery.data as PaginatedResponse<unknown>).totalPages}
          </span>
          <button
            disabled={!(currentQuery.data as PaginatedResponse<unknown>).hasNext}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50
              hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
