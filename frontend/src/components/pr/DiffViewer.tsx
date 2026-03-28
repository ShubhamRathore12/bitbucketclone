import React, { useState, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Minus,
  FileText,
  FilePlus,
  FileX,
  FileDiff,
  ArrowRightLeft,
  Columns,
  AlignJustify,
  Loader2,
  AlertCircle,
  Expand,
  Image,
} from 'lucide-react';
import type { DiffFile, DiffHunk, DiffLine, PRComment } from '@/types/pr';
import InlineComment from './InlineComment';

type DiffMode = 'unified' | 'side-by-side';

interface DiffViewerProps {
  repoFullName: string;
  prNumber: number;
}

async function fetchDiff(repoFullName: string, prNumber: number): Promise<{ files: DiffFile[] }> {
  const res = await fetch(`/api/repositories/${repoFullName}/pull-requests/${prNumber}/diff`);
  if (!res.ok) throw new Error('Failed to fetch diff');
  return res.json();
}

async function fetchInlineComments(repoFullName: string, prNumber: number): Promise<PRComment[]> {
  const res = await fetch(`/api/repositories/${repoFullName}/pull-requests/${prNumber}/comments?inline=true`);
  if (!res.ok) return [];
  return res.json();
}

const fileStatusIcons: Record<string, React.ReactNode> = {
  added: <FilePlus className="h-4 w-4 text-green-500" />,
  deleted: <FileX className="h-4 w-4 text-red-500" />,
  modified: <FileDiff className="h-4 w-4 text-yellow-500" />,
  renamed: <ArrowRightLeft className="h-4 w-4 text-blue-500" />,
  copied: <ArrowRightLeft className="h-4 w-4 text-blue-500" />,
};

function DiffStatBar({ additions, deletions }: { additions: number; deletions: number }) {
  const total = additions + deletions;
  if (total === 0) return null;
  const blocks = 5;
  const addBlocks = Math.round((additions / total) * blocks);
  const delBlocks = blocks - addBlocks;
  return (
    <span className="inline-flex gap-px ml-2">
      {Array.from({ length: addBlocks }).map((_, i) => (
        <span key={`a${i}`} className="w-2 h-2 bg-green-500 rounded-sm" />
      ))}
      {Array.from({ length: delBlocks }).map((_, i) => (
        <span key={`d${i}`} className="w-2 h-2 bg-red-500 rounded-sm" />
      ))}
    </span>
  );
}

interface FileSection {
  file: DiffFile;
  collapsed: boolean;
}

export default function DiffViewer({ repoFullName, prNumber }: DiffViewerProps) {
  const [diffMode, setDiffMode] = useState<DiffMode>('unified');
  const [fileSections, setFileSections] = useState<Record<string, boolean>>({});
  const [commentingOn, setCommentingOn] = useState<{ path: string; line: number; side: 'old' | 'new' } | null>(null);
  const [expandedContext, setExpandedContext] = useState<Record<string, boolean>>({});

  const { data: diffData, isLoading, isError, error } = useQuery({
    queryKey: ['pr-diff', repoFullName, prNumber],
    queryFn: () => fetchDiff(repoFullName, prNumber),
  });

  const { data: inlineComments = [] } = useQuery({
    queryKey: ['pr-inline-comments', repoFullName, prNumber],
    queryFn: () => fetchInlineComments(repoFullName, prNumber),
  });

  const toggleFileCollapse = useCallback((path: string) => {
    setFileSections((prev) => ({ ...prev, [path]: !prev[path] }));
  }, []);

  const getCommentsForLine = useCallback(
    (path: string, lineNum: number, side: 'old' | 'new'): PRComment[] => {
      return inlineComments.filter(
        (c) =>
          c.inline &&
          c.inline.path === path &&
          (side === 'new' ? c.inline.to === lineNum : c.inline.from === lineNum)
      );
    },
    [inlineComments]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2 text-sm text-gray-500">Loading diff...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md dark:bg-red-900/20 dark:border-red-800">
        <AlertCircle className="h-5 w-5 text-red-500" />
        <p className="text-sm text-red-700 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load diff'}
        </p>
      </div>
    );
  }

  const files = diffData?.files ?? [];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Showing {files.length} changed files with{' '}
          <span className="text-green-600 dark:text-green-400">
            {files.reduce((s, f) => s + f.stats.additions, 0)} additions
          </span>{' '}
          and{' '}
          <span className="text-red-600 dark:text-red-400">
            {files.reduce((s, f) => s + f.stats.deletions, 0)} deletions
          </span>
        </span>
        <div className="flex border border-gray-300 rounded-md overflow-hidden dark:border-gray-600">
          <button
            onClick={() => setDiffMode('unified')}
            className={[
              'p-2 text-sm transition-colors inline-flex items-center gap-1',
              diffMode === 'unified'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400',
            ].join(' ')}
            title="Unified view"
          >
            <AlignJustify className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDiffMode('side-by-side')}
            className={[
              'p-2 text-sm transition-colors inline-flex items-center gap-1',
              diffMode === 'side-by-side'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400',
            ].join(' ')}
            title="Side-by-side view"
          >
            <Columns className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* File tree summary */}
      <div className="border border-gray-200 rounded-md dark:border-gray-700 p-3">
        <ul className="space-y-1">
          {files.map((file) => (
            <li key={file.newPath || file.oldPath}>
              <a
                href={`#diff-${file.newPath || file.oldPath}`}
                className="flex items-center gap-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 px-2 py-1 rounded"
              >
                {fileStatusIcons[file.status] || <FileText className="h-4 w-4 text-gray-400" />}
                <span className="text-gray-700 dark:text-gray-300 truncate flex-1">
                  {file.status === 'renamed' ? `${file.oldPath} -> ${file.newPath}` : file.newPath || file.oldPath}
                </span>
                <span className="text-xs text-green-600 dark:text-green-400">+{file.stats.additions}</span>
                <span className="text-xs text-red-600 dark:text-red-400">-{file.stats.deletions}</span>
                <DiffStatBar additions={file.stats.additions} deletions={file.stats.deletions} />
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* File diffs */}
      {files.map((file) => {
        const filePath = file.newPath || file.oldPath;
        const isCollapsed = fileSections[filePath] ?? false;

        return (
          <div
            key={filePath}
            id={`diff-${filePath}`}
            className="border border-gray-200 rounded-md overflow-hidden dark:border-gray-700"
          >
            {/* File header */}
            <div
              className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 cursor-pointer"
              onClick={() => toggleFileCollapse(filePath)}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
              )}
              {fileStatusIcons[file.status]}
              <span className="text-sm font-mono text-gray-700 dark:text-gray-300 truncate flex-1">
                {file.status === 'renamed' ? `${file.oldPath} -> ${file.newPath}` : filePath}
              </span>
              <span className="text-xs text-green-600 dark:text-green-400">+{file.stats.additions}</span>
              <span className="text-xs text-red-600 dark:text-red-400">-{file.stats.deletions}</span>
            </div>

            {/* Diff content */}
            {!isCollapsed && (
              <>
                {file.isBinary ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    <Image className="h-8 w-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                    <p className="text-sm">Binary file not shown.</p>
                  </div>
                ) : diffMode === 'unified' ? (
                  <UnifiedDiff
                    file={file}
                    getCommentsForLine={getCommentsForLine}
                    commentingOn={commentingOn}
                    setCommentingOn={setCommentingOn}
                    repoFullName={repoFullName}
                    prNumber={prNumber}
                  />
                ) : (
                  <SideBySideDiff
                    file={file}
                    getCommentsForLine={getCommentsForLine}
                    commentingOn={commentingOn}
                    setCommentingOn={setCommentingOn}
                    repoFullName={repoFullName}
                    prNumber={prNumber}
                  />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Unified diff view                                                    */
/* ------------------------------------------------------------------ */
interface DiffViewProps {
  file: DiffFile;
  getCommentsForLine: (path: string, line: number, side: 'old' | 'new') => PRComment[];
  commentingOn: { path: string; line: number; side: 'old' | 'new' } | null;
  setCommentingOn: (v: { path: string; line: number; side: 'old' | 'new' } | null) => void;
  repoFullName: string;
  prNumber: number;
}

function UnifiedDiff({ file, getCommentsForLine, commentingOn, setCommentingOn, repoFullName, prNumber }: DiffViewProps) {
  const filePath = file.newPath || file.oldPath;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono border-collapse">
        <tbody>
          {file.hunks.map((hunk, hi) => (
            <React.Fragment key={hi}>
              {/* Hunk header */}
              <tr className="bg-blue-50 dark:bg-blue-900/20">
                <td colSpan={3} className="px-4 py-1 text-blue-600 dark:text-blue-400 select-none">
                  {hunk.header}
                </td>
              </tr>

              {hunk.lines.map((line, li) => {
                const lineKey = `${hi}-${li}`;
                const lineNum = line.type === 'deletion' ? line.oldLineNumber : line.newLineNumber;
                const side = line.type === 'deletion' ? 'old' : 'new';
                const comments = lineNum ? getCommentsForLine(filePath, lineNum, side) : [];

                return (
                  <React.Fragment key={lineKey}>
                    <tr
                      className={[
                        'group hover:bg-opacity-80',
                        line.type === 'addition'
                          ? 'bg-green-50 dark:bg-green-900/10'
                          : line.type === 'deletion'
                          ? 'bg-red-50 dark:bg-red-900/10'
                          : '',
                      ].join(' ')}
                    >
                      {/* Old line number */}
                      <td className="w-[1%] px-2 py-0 text-right text-gray-400 dark:text-gray-600 select-none whitespace-nowrap align-top">
                        {line.oldLineNumber ?? ''}
                      </td>
                      {/* New line number */}
                      <td className="w-[1%] px-2 py-0 text-right text-gray-400 dark:text-gray-600 select-none whitespace-nowrap align-top">
                        {line.newLineNumber ?? ''}
                      </td>
                      {/* Content */}
                      <td className="px-4 py-0 whitespace-pre relative">
                        <span
                          className={[
                            line.type === 'addition'
                              ? 'text-green-800 dark:text-green-300'
                              : line.type === 'deletion'
                              ? 'text-red-800 dark:text-red-300'
                              : 'text-gray-800 dark:text-gray-200',
                          ].join(' ')}
                        >
                          {line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' '}
                          {line.content}
                        </span>
                        {/* Add comment button on hover */}
                        {lineNum && (
                          <button
                            onClick={() => setCommentingOn({ path: filePath, line: lineNum, side })}
                            className="absolute left-0 top-0 h-full w-6 opacity-0 group-hover:opacity-100 flex items-center justify-center
                              hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-opacity"
                            title="Add comment"
                          >
                            <Plus className="h-3 w-3 text-blue-500" />
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Inline comments */}
                    {comments.map((comment) => (
                      <tr key={comment.id}>
                        <td colSpan={3} className="px-4 py-2 bg-white dark:bg-gray-900 border-y border-gray-100 dark:border-gray-800">
                          <InlineComment
                            comment={comment}
                            repoFullName={repoFullName}
                            prNumber={prNumber}
                          />
                        </td>
                      </tr>
                    ))}

                    {/* New comment form */}
                    {commentingOn?.path === filePath && commentingOn.line === lineNum && commentingOn.side === side && (
                      <tr>
                        <td colSpan={3} className="px-4 py-2 bg-blue-50 dark:bg-blue-900/10 border-y border-blue-100 dark:border-blue-900">
                          <NewCommentForm
                            repoFullName={repoFullName}
                            prNumber={prNumber}
                            filePath={filePath}
                            line={lineNum}
                            onCancel={() => setCommentingOn(null)}
                            onSubmitted={() => setCommentingOn(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Side-by-side diff view                                               */
/* ------------------------------------------------------------------ */
function SideBySideDiff({ file, getCommentsForLine, commentingOn, setCommentingOn, repoFullName, prNumber }: DiffViewProps) {
  const filePath = file.newPath || file.oldPath;

  // Build side-by-side pairs
  type Pair = { old?: DiffLine; new?: DiffLine };
  const pairs: Pair[] = [];

  file.hunks.forEach((hunk) => {
    const adds: DiffLine[] = [];
    const dels: DiffLine[] = [];

    hunk.lines.forEach((line) => {
      if (line.type === 'context') {
        // Flush pending adds/dels
        const count = Math.max(adds.length, dels.length);
        for (let i = 0; i < count; i++) {
          pairs.push({ old: dels[i], new: adds[i] });
        }
        adds.length = 0;
        dels.length = 0;
        pairs.push({ old: line, new: line });
      } else if (line.type === 'addition') {
        adds.push(line);
      } else {
        dels.push(line);
      }
    });
    const count = Math.max(adds.length, dels.length);
    for (let i = 0; i < count; i++) {
      pairs.push({ old: dels[i], new: adds[i] });
    }
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono border-collapse">
        <tbody>
          {pairs.map((pair, i) => (
            <tr key={i} className="group">
              {/* Left (old) */}
              <td className="w-[1%] px-2 py-0 text-right text-gray-400 dark:text-gray-600 select-none whitespace-nowrap border-r border-gray-100 dark:border-gray-800">
                {pair.old?.oldLineNumber ?? ''}
              </td>
              <td
                className={[
                  'w-[49%] px-4 py-0 whitespace-pre border-r border-gray-200 dark:border-gray-700',
                  pair.old?.type === 'deletion'
                    ? 'bg-red-50 dark:bg-red-900/10 text-red-800 dark:text-red-300'
                    : 'text-gray-800 dark:text-gray-200',
                ].join(' ')}
              >
                {pair.old ? `${pair.old.type === 'deletion' ? '-' : ' '}${pair.old.content}` : ''}
              </td>

              {/* Right (new) */}
              <td className="w-[1%] px-2 py-0 text-right text-gray-400 dark:text-gray-600 select-none whitespace-nowrap">
                {pair.new?.newLineNumber ?? ''}
              </td>
              <td
                className={[
                  'w-[49%] px-4 py-0 whitespace-pre relative',
                  pair.new?.type === 'addition'
                    ? 'bg-green-50 dark:bg-green-900/10 text-green-800 dark:text-green-300'
                    : 'text-gray-800 dark:text-gray-200',
                ].join(' ')}
              >
                {pair.new ? `${pair.new.type === 'addition' ? '+' : ' '}${pair.new.content}` : ''}
                {pair.new?.newLineNumber && (
                  <button
                    onClick={() =>
                      setCommentingOn({
                        path: filePath,
                        line: pair.new!.newLineNumber!,
                        side: 'new',
                      })
                    }
                    className="absolute right-0 top-0 h-full w-6 opacity-0 group-hover:opacity-100 flex items-center justify-center
                      hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-opacity"
                    title="Add comment"
                  >
                    <Plus className="h-3 w-3 text-blue-500" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* New inline comment form                                              */
/* ------------------------------------------------------------------ */
function NewCommentForm({
  repoFullName,
  prNumber,
  filePath,
  line,
  onCancel,
  onSubmitted,
}: {
  repoFullName: string;
  prNumber: number;
  filePath: string;
  line: number;
  onCancel: () => void;
  onSubmitted: () => void;
}) {
  const [content, setContent] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/repositories/${repoFullName}/pull-requests/${prNumber}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            inline: { path: filePath, to: line },
          }),
        }
      );
      if (!res.ok) throw new Error('Failed to post comment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pr-inline-comments', repoFullName, prNumber] });
      onSubmitted();
    },
  });

  return (
    <div className="space-y-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a comment..."
        rows={3}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md resize-y
          focus:outline-none focus:ring-2 focus:ring-blue-500
          dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
        autoFocus
      />
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md dark:text-gray-400 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
        <button
          onClick={() => mutation.mutate()}
          disabled={!content.trim() || mutation.isPending}
          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {mutation.isPending ? 'Posting...' : 'Comment'}
        </button>
      </div>
    </div>
  );
}

