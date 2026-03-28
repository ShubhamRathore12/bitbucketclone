import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Copy,
  Check,
  FileText,
  History,
  Eye,
  Pencil,
  ChevronRight,
  Loader2,
  AlertCircle,
  Download,
} from 'lucide-react';
import type { FileContent } from '@/types/repos';

type ViewTab = 'source' | 'blame' | 'history';

interface FileViewerProps {
  repoFullName: string;
  branch: string;
  filePath: string;
  onEdit?: (path: string) => void;
  onNavigate?: (path: string) => void;
}

async function fetchFile(
  repoFullName: string,
  branch: string,
  path: string
): Promise<FileContent> {
  const res = await fetch(
    `/api/repositories/${repoFullName}/src/${branch}/${path}`
  );
  if (!res.ok) throw new Error('Failed to fetch file');
  return res.json();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileViewer({
  repoFullName,
  branch,
  filePath,
  onEdit,
  onNavigate,
}: FileViewerProps) {
  const [activeTab, setActiveTab] = useState<ViewTab>('source');
  const [copied, setCopied] = useState(false);

  const { data: file, isLoading, isError, error } = useQuery({
    queryKey: ['file-content', repoFullName, branch, filePath],
    queryFn: () => fetchFile(repoFullName, branch, filePath),
  });

  const handleCopyRaw = useCallback(async () => {
    if (!file) return;
    try {
      await navigator.clipboard.writeText(file.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }, [file]);

  const pathParts = filePath.split('/').filter(Boolean);
  const fileName = pathParts[pathParts.length - 1] || filePath;

  const lines = file?.content.split('\n') ?? [];
  const lineCount = lines.length;

  const tabs: { key: ViewTab; label: string; icon: React.ReactNode }[] = [
    { key: 'source', label: 'Source', icon: <FileText className="h-4 w-4" /> },
    { key: 'blame', label: 'Blame', icon: <Eye className="h-4 w-4" /> },
    { key: 'history', label: 'History', icon: <History className="h-4 w-4" /> },
  ];

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
          {error instanceof Error ? error.message : 'Failed to load file'}
        </p>
      </div>
    );
  }

  if (!file) return null;

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 flex-wrap">
        <button
          onClick={() => onNavigate?.('')}
          className="hover:text-blue-600 dark:hover:text-blue-400 font-medium"
        >
          {repoFullName.split('/').pop()}
        </button>
        {pathParts.map((part, i) => (
          <React.Fragment key={i}>
            <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            {i < pathParts.length - 1 ? (
              <button
                onClick={() => onNavigate?.(pathParts.slice(0, i + 1).join('/'))}
                className="hover:text-blue-600 dark:hover:text-blue-400"
              >
                {part}
              </button>
            ) : (
              <span className="font-medium text-gray-800 dark:text-gray-200">{part}</span>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* File container */}
      <div className="border border-gray-200 rounded-md dark:border-gray-700 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            {/* Tabs */}
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={[
                  'inline-flex items-center gap-1.5 text-sm font-medium pb-0.5 border-b-2 transition-colors',
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
                ].join(' ')}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {/* File info */}
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {lineCount} lines | {formatBytes(file.size)}
            </span>
            {/* Copy */}
            <button
              onClick={handleCopyRaw}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded
                dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Copy raw content"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </button>
            {/* Download */}
            <a
              href={`/api/repositories/${repoFullName}/src/${branch}/${filePath}?raw=true`}
              download={fileName}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded
                dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Download raw file"
            >
              <Download className="h-4 w-4" />
            </a>
            {/* Edit */}
            {onEdit && (
              <button
                onClick={() => onEdit(filePath)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-gray-300
                  rounded-md hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Source view */}
        {activeTab === 'source' && (
          <div className="overflow-x-auto">
            {file.encoding === 'base64' ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                <p>Binary file not shown.</p>
                <a
                  href={`/api/repositories/${repoFullName}/src/${branch}/${filePath}?raw=true`}
                  className="text-blue-600 dark:text-blue-400 text-sm mt-1 inline-block hover:underline"
                >
                  Download raw file
                </a>
              </div>
            ) : (
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
            )}
          </div>
        )}

        {/* Blame view */}
        {activeTab === 'blame' && (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            <Eye className="h-8 w-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm">Blame view shows the last modification for each line.</p>
            <p className="text-xs mt-1 text-gray-400">Loading blame data...</p>
          </div>
        )}

        {/* History view */}
        {activeTab === 'history' && (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            <History className="h-8 w-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm">File history shows all commits that modified this file.</p>
            <p className="text-xs mt-1 text-gray-400">Loading history...</p>
          </div>
        )}
      </div>
    </div>
  );
}
