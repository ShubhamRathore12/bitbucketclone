import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileCode,
  Copy,
  Check,
  Lock,
  Globe,
  Pencil,
  Trash2,
  Download,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { Snippet, SnippetFile } from '@/types/snippets';
import Button from '@/components/ui/Button';

interface SnippetViewerProps {
  snippetId: string;
  onEdit?: (snippet: Snippet) => void;
  onDelete?: (id: string) => void;
}

async function fetchSnippet(id: string): Promise<Snippet> {
  const res = await fetch(`/api/snippets/${id}`);
  if (!res.ok) throw new Error('Failed to fetch snippet');
  return res.json();
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

function FileTab({
  file,
  isActive,
  onClick,
}: {
  file: SnippetFile;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
        isActive
          ? 'border-blue-600 text-blue-600 bg-white dark:text-blue-400 dark:border-blue-400 dark:bg-gray-800'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800',
      ].join(' ')}
    >
      <span className="inline-flex items-center gap-1.5">
        <FileCode className="h-3.5 w-3.5" />
        {file.filename}
        {file.language && (
          <span className="text-xs text-gray-400 dark:text-gray-500">({file.language})</span>
        )}
      </span>
    </button>
  );
}

export default function SnippetViewer({ snippetId, onEdit, onDelete }: SnippetViewerProps) {
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const { data: snippet, isLoading, isError, error } = useQuery({
    queryKey: ['snippet', snippetId],
    queryFn: () => fetchSnippet(snippetId),
  });

  const handleCopy = useCallback(async () => {
    if (!snippet) return;
    const file = snippet.files[activeFileIndex];
    try {
      await navigator.clipboard.writeText(file.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [snippet, activeFileIndex]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (isError || !snippet) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md dark:bg-red-900/20 dark:border-red-800">
        <AlertCircle className="h-5 w-5 text-red-500" />
        <p className="text-sm text-red-700 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load snippet'}
        </p>
      </div>
    );
  }

  const activeFile = snippet.files[activeFileIndex];
  const lines = activeFile?.content.split('\n') ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{snippet.title}</h1>
            {snippet.isPrivate ? (
              <Lock className="h-4 w-4 text-orange-500" />
            ) : (
              <Globe className="h-4 w-4 text-green-500" />
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1">
              <img src={snippet.owner.avatarUrl} alt="" className="h-4 w-4 rounded-full" />
              {snippet.owner.displayName}
            </span>
            <span>Created {relativeTime(snippet.createdAt)}</span>
            <span>Updated {relativeTime(snippet.updatedAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onEdit && (
            <Button variant="outline" size="sm" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => onEdit(snippet)}>
              Edit
            </Button>
          )}
          {onDelete && (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 className="h-3.5 w-3.5" />}
              onClick={() => { if (confirm('Delete this snippet?')) onDelete(snippet.id); }}
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* File viewer */}
      <div className="border border-gray-200 rounded-md overflow-hidden dark:border-gray-700">
        {/* File tabs */}
        <div className="flex items-center overflow-x-auto bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          {snippet.files.map((file, i) => (
            <FileTab
              key={file.filename}
              file={file}
              isActive={i === activeFileIndex}
              onClick={() => { setActiveFileIndex(i); setCopied(false); }}
            />
          ))}
          {/* Actions */}
          <div className="ml-auto flex items-center gap-1 px-2">
            <button
              onClick={handleCopy}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Copy file content"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </button>
            <a
              href={`/api/snippets/${snippet.id}/files/${activeFile?.filename}?raw=true`}
              download={activeFile?.filename}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Download file"
            >
              <Download className="h-4 w-4" />
            </a>
          </div>
        </div>

        {/* Code display */}
        {activeFile && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className="hover:bg-yellow-50 dark:hover:bg-yellow-900/10">
                    <td className="px-4 py-0 text-right text-gray-400 dark:text-gray-600 select-none w-[1%] whitespace-nowrap align-top">
                      {i + 1}
                    </td>
                    <td className="px-4 py-0 whitespace-pre text-gray-800 dark:text-gray-200">
                      {line}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
