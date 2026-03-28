import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDown,
  Loader2,
  AlertCircle,
  Terminal,
  Download,
} from 'lucide-react';
import type { PipelineLog, PipelineLogLine } from '@/types/pipelines';

interface StepLogProps {
  repoFullName: string;
  pipelineId: string;
  stepId: string;
  isRunning?: boolean;
}

async function fetchStepLog(
  repoFullName: string,
  pipelineId: string,
  stepId: string
): Promise<PipelineLog> {
  const res = await fetch(
    `/api/repositories/${repoFullName}/pipelines/${pipelineId}/steps/${stepId}/log`
  );
  if (!res.ok) throw new Error('Failed to fetch step log');
  return res.json();
}

// Simple ANSI color code to CSS class mapper
function parseAnsiLine(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const ansiRegex = /\x1B\[(\d+(?:;\d+)*)m/g;

  let lastIndex = 0;
  let currentColor = '';
  let match: RegExpExecArray | null;

  const colorMap: Record<string, string> = {
    '30': 'text-gray-800 dark:text-gray-200',
    '31': 'text-red-500',
    '32': 'text-green-500',
    '33': 'text-yellow-500',
    '34': 'text-blue-500',
    '35': 'text-purple-500',
    '36': 'text-cyan-500',
    '37': 'text-white',
    '90': 'text-gray-500',
    '91': 'text-red-400',
    '92': 'text-green-400',
    '93': 'text-yellow-400',
    '94': 'text-blue-400',
    '95': 'text-purple-400',
    '96': 'text-cyan-400',
    '1': 'font-bold',
    '0': '',
  };

  while ((match = ansiRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const chunk = text.slice(lastIndex, match.index);
      parts.push(
        currentColor ? (
          <span key={lastIndex} className={currentColor}>{chunk}</span>
        ) : (
          chunk
        )
      );
    }
    const codes = match[1].split(';');
    const classes = codes.map((c) => colorMap[c] || '').filter(Boolean);
    currentColor = classes.join(' ');
    if (codes.includes('0')) currentColor = '';
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const chunk = text.slice(lastIndex);
    parts.push(
      currentColor ? (
        <span key={lastIndex} className={currentColor}>{chunk}</span>
      ) : (
        chunk
      )
    );
  }

  return parts.length > 0 ? parts : [text];
}

export default function StepLog({ repoFullName, pipelineId, stepId, isRunning = false }: StepLogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(false);

  const { data: log, isLoading, isError, error } = useQuery({
    queryKey: ['step-log', repoFullName, pipelineId, stepId],
    queryFn: () => fetchStepLog(repoFullName, pipelineId, stepId),
    refetchInterval: isRunning ? 3000 : false,
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [log?.lines.length, autoScroll]);

  // Detect manual scroll
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 bg-gray-900 rounded-md">
        <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
        <span className="ml-2 text-sm text-gray-400">Loading logs...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md dark:bg-red-900/20 dark:border-red-800">
        <AlertCircle className="h-5 w-5 text-red-500" />
        <p className="text-sm text-red-700 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load logs'}
        </p>
      </div>
    );
  }

  const lines = log?.lines ?? [];

  return (
    <div className="border border-gray-700 rounded-md overflow-hidden">
      {/* Log toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-gray-400" />
          <span className="text-xs text-gray-400">{lines.length} lines</span>
          {isRunning && (
            <span className="inline-flex items-center gap-1 text-xs text-blue-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showTimestamps}
              onChange={(e) => setShowTimestamps(e.target.checked)}
              className="accent-blue-500"
            />
            Timestamps
          </label>
          <a
            href={`/api/repositories/${repoFullName}/pipelines/${pipelineId}/steps/${stepId}/log?download=true`}
            className="p-1 text-gray-400 hover:text-gray-200 transition-colors"
            title="Download log"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Log content */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="bg-gray-900 text-gray-200 font-mono text-xs leading-5 overflow-auto max-h-[500px] p-3"
      >
        {lines.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Terminal className="h-8 w-8 mx-auto mb-2" />
            <p>No output yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <tbody>
              {lines.map((line: PipelineLogLine, i: number) => (
                <tr key={i} className="hover:bg-gray-800/50">
                  {/* Line number */}
                  <td className="text-right pr-3 text-gray-600 select-none whitespace-nowrap w-[1%] align-top">
                    {line.lineNumber}
                  </td>
                  {/* Timestamp */}
                  {showTimestamps && (
                    <td className="pr-3 text-gray-600 whitespace-nowrap w-[1%] align-top">
                      {new Date(line.timestamp).toLocaleTimeString()}
                    </td>
                  )}
                  {/* Content */}
                  <td
                    className={[
                      'whitespace-pre-wrap break-all',
                      line.stream === 'stderr' ? 'text-red-400' : '',
                    ].join(' ')}
                  >
                    {parseAnsiLine(line.content)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Scroll to bottom */}
      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true);
            if (containerRef.current) {
              containerRef.current.scrollTop = containerRef.current.scrollHeight;
            }
          }}
          className="absolute bottom-4 right-4 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-full
            shadow-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-1"
        >
          <ArrowDown className="h-3 w-3" />
          Scroll to bottom
        </button>
      )}
    </div>
  );
}
