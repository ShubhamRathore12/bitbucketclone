import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  File,
  Folder,
  ChevronRight,
  Loader2,
  AlertCircle,
  FileText,
  GitBranch as SubmoduleIcon,
  Link2,
} from 'lucide-react';
import type { SourceEntry, Commit } from '@/types/repos';
import BranchSelector from './BranchSelector';

interface FileBrowserProps {
  repoFullName: string;
  currentBranch: string;
  currentPath?: string;
  onBranchChange: (ref: string, type: 'branch' | 'tag') => void;
  onNavigate: (path: string) => void;
  onFileClick: (path: string) => void;
  onCreateBranch?: () => void;
}

async function fetchTree(
  repoFullName: string,
  ref: string,
  path: string
): Promise<SourceEntry[]> {
  const res = await fetch(
    `/api/repositories/${repoFullName}/src/${ref}/${path}`
  );
  if (!res.ok) throw new Error('Failed to fetch file tree');
  return res.json();
}

async function fetchReadme(
  repoFullName: string,
  ref: string,
  path: string
): Promise<string | null> {
  const readmePath = path ? `${path}/README.md` : 'README.md';
  const res = await fetch(
    `/api/repositories/${repoFullName}/src/${ref}/${readmePath}?raw=true`
  );
  if (!res.ok) return null;
  return res.text();
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

const typeIcons: Record<string, React.ReactNode> = {
  file: <File className="h-4 w-4 text-gray-400" />,
  directory: <Folder className="h-4 w-4 text-blue-500" />,
  submodule: <SubmoduleIcon className="h-4 w-4 text-purple-500" />,
  symlink: <Link2 className="h-4 w-4 text-green-500" />,
};

export default function FileBrowser({
  repoFullName,
  currentBranch,
  currentPath = '',
  onBranchChange,
  onNavigate,
  onFileClick,
  onCreateBranch,
}: FileBrowserProps) {
  const { data: entries, isLoading, isError, error } = useQuery({
    queryKey: ['file-tree', repoFullName, currentBranch, currentPath],
    queryFn: () => fetchTree(repoFullName, currentBranch, currentPath),
  });

  const { data: readmeContent } = useQuery({
    queryKey: ['readme', repoFullName, currentBranch, currentPath],
    queryFn: () => fetchReadme(repoFullName, currentBranch, currentPath),
    enabled: !!entries,
  });

  // Sort: directories first, then files, alphabetical within each group
  const sortedEntries = [...(entries ?? [])].sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });

  // Build breadcrumb segments
  const pathParts = currentPath ? currentPath.split('/').filter(Boolean) : [];
  const breadcrumbs = pathParts.map((part, i) => ({
    label: part,
    path: pathParts.slice(0, i + 1).join('/'),
  }));

  return (
    <div className="space-y-4">
      {/* Top bar: Branch selector + Breadcrumbs */}
      <div className="flex flex-wrap items-center gap-3">
        <BranchSelector
          repoFullName={repoFullName}
          currentRef={currentBranch}
          onSelect={onBranchChange}
          onCreateBranch={onCreateBranch}
        />

        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
          <button
            onClick={() => onNavigate('')}
            className="hover:text-blue-600 dark:hover:text-blue-400 font-medium"
          >
            {repoFullName.split('/').pop()}
          </button>
          {breadcrumbs.map((bc) => (
            <React.Fragment key={bc.path}>
              <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <button
                onClick={() => onNavigate(bc.path)}
                className="hover:text-blue-600 dark:hover:text-blue-400"
              >
                {bc.label}
              </button>
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md dark:bg-red-900/20 dark:border-red-800">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">
            {error instanceof Error ? error.message : 'Failed to load files'}
          </p>
        </div>
      )}

      {/* File table */}
      {sortedEntries.length > 0 && (
        <div className="border border-gray-200 rounded-md overflow-hidden dark:border-gray-700">
          {/* Header row (latest commit info) */}
          {sortedEntries[0]?.lastCommit && (
            <div className="px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 text-sm">
              <img
                src={sortedEntries[0].lastCommit.author.avatarUrl}
                alt=""
                className="h-5 w-5 rounded-full"
              />
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {sortedEntries[0].lastCommit.author.displayName}
              </span>
              <span className="text-gray-600 dark:text-gray-400 truncate flex-1">
                {sortedEntries[0].lastCommit.message}
              </span>
              <span className="text-gray-500 dark:text-gray-500 text-xs shrink-0">
                {relativeTime(sortedEntries[0].lastCommit.date)}
              </span>
            </div>
          )}

          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {/* Go up row */}
              {currentPath && (
                <tr
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                  onClick={() => {
                    const parent = pathParts.slice(0, -1).join('/');
                    onNavigate(parent);
                  }}
                >
                  <td className="px-4 py-2 text-blue-600 dark:text-blue-400" colSpan={3}>
                    ..
                  </td>
                </tr>
              )}

              {sortedEntries.map((entry) => (
                <tr
                  key={entry.path}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                  onClick={() => {
                    if (entry.type === 'directory') {
                      onNavigate(entry.path);
                    } else {
                      onFileClick(entry.path);
                    }
                  }}
                >
                  <td className="px-4 py-2 w-[40%]">
                    <div className="flex items-center gap-2">
                      {typeIcons[entry.type] || typeIcons.file}
                      <span
                        className={
                          entry.type === 'directory'
                            ? 'text-blue-600 dark:text-blue-400 font-medium'
                            : 'text-gray-800 dark:text-gray-200'
                        }
                      >
                        {entry.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-500 dark:text-gray-400 truncate max-w-0">
                    {entry.lastCommit?.message}
                  </td>
                  <td className="px-4 py-2 text-gray-400 dark:text-gray-500 text-right whitespace-nowrap text-xs">
                    {entry.lastCommit ? relativeTime(entry.lastCommit.date) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* README.md rendered at bottom */}
      {readmeContent && (
        <div className="border border-gray-200 rounded-md dark:border-gray-700">
          <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 bg-gray-50 dark:bg-gray-800">
            <FileText className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              README.md
            </span>
          </div>
          <div
            className="px-6 py-4 prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: readmeContent }}
          />
        </div>
      )}
    </div>
  );
}
