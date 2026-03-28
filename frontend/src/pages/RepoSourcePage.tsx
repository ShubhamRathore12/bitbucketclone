import React, { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronRight,
  File,
  Folder,
  GitBranch,
  ChevronDown,
  Download,
  Copy,
  Check,
  FileCode2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { Branch, TreeEntry, FileContent, CommitSummary } from '@/types/repo';
import type { PaginatedResponse } from '@/types/common';

// ---------------------------------------------------------------------------
// API helpers
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
// BranchSelector (inline)
// ---------------------------------------------------------------------------

function BranchSelector({
  workspace,
  repo,
  currentRef,
  onSelect,
}: {
  workspace: string;
  repo: string;
  currentRef: string;
  onSelect: (branchName: string) => void;
}) {
  const [open, setOpen] = React.useState(false);

  const branchesQuery = useQuery<PaginatedResponse<Branch>>({
    queryKey: ['branches', workspace, repo],
    queryFn: () => fetchJson(`/api/repositories/${workspace}/${repo}/branches?pageSize=100`),
    enabled: open,
  });

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        leftIcon={<GitBranch className="h-4 w-4" />}
        rightIcon={<ChevronDown className="h-3 w-3" />}
        onClick={() => setOpen(!open)}
      >
        {currentRef}
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-80 overflow-y-auto">
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <input
                type="text"
                placeholder="Filter branches..."
                className="w-full px-3 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>
            {branchesQuery.isLoading ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : (
              <ul className="py-1">
                {branchesQuery.data?.data.map((branch) => (
                  <li key={branch.name}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(branch.name);
                        setOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer ${
                        branch.name === currentRef
                          ? 'font-semibold text-blue-600 dark:text-blue-400'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <GitBranch className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{branch.name}</span>
                      {branch.isDefault && (
                        <Badge color="blue" size="sm" className="ml-auto shrink-0">
                          default
                        </Badge>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RepoSourcePage
// ---------------------------------------------------------------------------

export default function RepoSourcePage() {
  const { workspace, repo, '*': pathWild } = useParams<{
    workspace: string;
    repo: string;
    '*': string;
  }>();
  const navigate = useNavigate();
  const [copied, setCopied] = React.useState(false);

  // Parse ref and path from the wildcard portion
  // URL pattern: /:workspace/:repo/src/:ref/*path
  const segments = (pathWild || '').split('/').filter(Boolean);
  const currentRef = segments[0] || 'main';
  const filePath = segments.slice(1).join('/');

  const basePath = `/${workspace}/${repo}/src`;

  // Fetch directory listing or file content depending on path
  const treeQuery = useQuery<TreeEntry[]>({
    queryKey: ['tree', workspace, repo, currentRef, filePath],
    queryFn: () =>
      fetchJson(
        `/api/repositories/${workspace}/${repo}/src/${currentRef}/${filePath}?format=meta`
      ),
    enabled: !!workspace && !!repo,
  });

  const fileQuery = useQuery<FileContent>({
    queryKey: ['file', workspace, repo, currentRef, filePath],
    queryFn: () =>
      fetchJson(
        `/api/repositories/${workspace}/${repo}/src/${currentRef}/${filePath}?format=content`
      ),
    enabled:
      !!workspace &&
      !!repo &&
      !!filePath &&
      treeQuery.isError, // only fetch file content if tree fails (path is a file)
  });

  // Determine if viewing a file or directory
  const isFile =
    treeQuery.isError ||
    (treeQuery.data && !Array.isArray(treeQuery.data)) ||
    fileQuery.isSuccess;
  const isDir = treeQuery.isSuccess && Array.isArray(treeQuery.data);
  const entries = isDir ? (treeQuery.data as TreeEntry[]) : [];
  const fileContent = fileQuery.data;

  // Breadcrumb segments
  const breadcrumbs = useMemo(() => {
    const parts = filePath ? filePath.split('/') : [];
    return parts.map((part, idx) => ({
      label: part,
      path: `${basePath}/${currentRef}/${parts.slice(0, idx + 1).join('/')}`,
    }));
  }, [filePath, basePath, currentRef]);

  const handleBranchChange = (branch: string) => {
    navigate(`${basePath}/${branch}/${filePath}`);
  };

  const handleCopy = async () => {
    if (fileContent) {
      await navigator.clipboard.writeText(fileContent.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  // ---------------------------------------------------------------------------
  // Render: loading
  // ---------------------------------------------------------------------------

  if (treeQuery.isLoading && !fileQuery.isSuccess) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
            >
              <Skeleton className="h-4 w-4 shrink-0" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-48 ml-auto" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error
  // ---------------------------------------------------------------------------

  if (treeQuery.isError && fileQuery.isError) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Path not found
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          The path &ldquo;{filePath || '/'}&rdquo; does not exist at ref &ldquo;{currentRef}&rdquo;.
        </p>
        <Button variant="primary" onClick={() => navigate(`${basePath}/${currentRef}`)}>
          Go to root
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: file viewer
  // ---------------------------------------------------------------------------

  if (isFile && fileContent) {
    const lines = fileContent.content.split('\n');
    return (
      <div className="space-y-4">
        {/* Branch selector + breadcrumbs */}
        <div className="flex items-center gap-3 flex-wrap">
          <BranchSelector
            workspace={workspace!}
            repo={repo!}
            currentRef={currentRef}
            onSelect={handleBranchChange}
          />
          <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
            <Link
              to={`${basePath}/${currentRef}`}
              className="hover:text-blue-600 dark:hover:text-blue-400"
            >
              {repo}
            </Link>
            {breadcrumbs.map((bc, idx) => (
              <React.Fragment key={bc.path}>
                <ChevronRight className="h-3 w-3" />
                {idx === breadcrumbs.length - 1 ? (
                  <span className="font-medium text-gray-900 dark:text-white">{bc.label}</span>
                ) : (
                  <Link
                    to={bc.path}
                    className="hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    {bc.label}
                  </Link>
                )}
              </React.Fragment>
            ))}
          </nav>
        </div>

        {/* File card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* File header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <FileCode2 className="h-4 w-4" />
              <span>{fileContent.lineCount} lines</span>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span>{(fileContent.size / 1024).toFixed(1)} KB</span>
              {fileContent.language && (
                <>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <span>{fileContent.language}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* File content */}
          {fileContent.isBinary ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <p>Binary file not shown.</p>
              <Button variant="outline" size="sm" className="mt-3">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          ) : fileContent.isTruncated ? (
            <div className="p-4">
              <pre className="text-sm font-mono overflow-x-auto">
                <code>
                  {lines.map((line, idx) => (
                    <div key={idx} className="flex hover:bg-yellow-50 dark:hover:bg-yellow-900/10">
                      <span className="select-none text-gray-400 dark:text-gray-600 text-right w-12 pr-4 shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-gray-800 dark:text-gray-200 whitespace-pre">
                        {line}
                      </span>
                    </div>
                  ))}
                </code>
              </pre>
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm text-yellow-700 dark:text-yellow-300">
                File truncated. Download to see full content.
              </div>
            </div>
          ) : (
            <pre className="text-sm font-mono overflow-x-auto">
              <code>
                {lines.map((line, idx) => (
                  <div key={idx} className="flex hover:bg-blue-50 dark:hover:bg-blue-900/10">
                    <span className="select-none text-gray-400 dark:text-gray-600 text-right w-12 pr-4 shrink-0 border-r border-gray-100 dark:border-gray-700">
                      {idx + 1}
                    </span>
                    <span className="pl-4 text-gray-800 dark:text-gray-200 whitespace-pre">
                      {line}
                    </span>
                  </div>
                ))}
              </code>
            </pre>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: directory browser
  // ---------------------------------------------------------------------------

  // Sort entries: directories first, then files
  const sortedEntries = [...entries].sort((a, b) => {
    if (a.type === 'dir' && b.type !== 'dir') return -1;
    if (a.type !== 'dir' && b.type === 'dir') return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-4">
      {/* Branch selector + breadcrumbs */}
      <div className="flex items-center gap-3 flex-wrap">
        <BranchSelector
          workspace={workspace!}
          repo={repo!}
          currentRef={currentRef}
          onSelect={handleBranchChange}
        />
        <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
          <Link
            to={`${basePath}/${currentRef}`}
            className="hover:text-blue-600 dark:hover:text-blue-400 font-medium"
          >
            {repo}
          </Link>
          {breadcrumbs.map((bc, idx) => (
            <React.Fragment key={bc.path}>
              <ChevronRight className="h-3 w-3" />
              {idx === breadcrumbs.length - 1 ? (
                <span className="font-medium text-gray-900 dark:text-white">{bc.label}</span>
              ) : (
                <Link
                  to={bc.path}
                  className="hover:text-blue-600 dark:hover:text-blue-400"
                >
                  {bc.label}
                </Link>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* File browser table */}
      {sortedEntries.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-10 text-center">
          <Folder className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">This directory is empty.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {sortedEntries.map((entry, idx) => (
            <Link
              key={entry.path}
              to={`${basePath}/${currentRef}/${entry.path}`}
              className={[
                'flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors',
                idx < sortedEntries.length - 1
                  ? 'border-b border-gray-100 dark:border-gray-700/50'
                  : '',
              ].join(' ')}
            >
              {entry.type === 'dir' ? (
                <Folder className="h-4 w-4 text-blue-500 shrink-0" />
              ) : (
                <File className="h-4 w-4 text-gray-400 shrink-0" />
              )}
              <span className="font-medium text-gray-900 dark:text-white truncate min-w-[120px]">
                {entry.name}
              </span>
              {entry.lastCommit && (
                <>
                  <span className="text-gray-500 dark:text-gray-400 truncate flex-1">
                    {entry.lastCommit.subject}
                  </span>
                  <span className="text-gray-400 dark:text-gray-500 shrink-0 text-xs">
                    {relativeTime(entry.lastCommit.date)}
                  </span>
                </>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
