import React, { useState } from 'react';
import {
  Bot,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { AIReviewStatus } from '@/types/pr';

interface AIReviewBadgeProps {
  status: AIReviewStatus;
  className?: string;
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

const stateMap: Record<
  AIReviewStatus['status'],
  {
    icon: React.ReactNode;
    label: string;
    color: string;
    bg: string;
  }
> = {
  pending: {
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    label: 'AI review pending',
    color: 'text-yellow-700 dark:text-yellow-400',
    bg: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
  },
  in_progress: {
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    label: 'AI reviewing...',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
  },
  completed: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    label: 'AI review complete',
    color: 'text-purple-700 dark:text-purple-400',
    bg: 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800',
  },
  failed: {
    icon: <XCircle className="h-4 w-4" />,
    label: 'AI review failed',
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
  },
};

export default function AIReviewBadge({ status, className = '' }: AIReviewBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const config = stateMap[status.status];

  return (
    <div className={['border rounded-md overflow-hidden', config.bg, className].join(' ')}>
      <button
        onClick={() => status.status === 'completed' && setExpanded(!expanded)}
        className={[
          'w-full flex items-center gap-2 px-3 py-2 text-sm',
          config.color,
          status.status === 'completed' ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
        ].join(' ')}
      >
        <Bot className="h-4 w-4 shrink-0" />
        {config.icon}
        <span className="flex-1 text-left font-medium">{config.label}</span>
        {status.suggestions && status.suggestions.length > 0 && (
          <span className="text-xs opacity-75">{status.suggestions.length} suggestions</span>
        )}
        {status.status === 'completed' && (
          expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>

      {expanded && status.status === 'completed' && (
        <div className="px-3 pb-3 space-y-2 border-t border-current/10">
          {/* Summary */}
          {status.summary && (
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{status.summary}</p>
          )}

          {/* Suggestions */}
          {status.suggestions && status.suggestions.length > 0 && (
            <ul className="space-y-1.5 mt-2">
              {status.suggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  {s.severity === 'error' && <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />}
                  {s.severity === 'warning' && <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />}
                  {s.severity === 'info' && <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />}
                  <div>
                    <span className="font-mono text-gray-500 dark:text-gray-400">
                      {s.path}:{s.line}
                    </span>
                    <span className="ml-1 text-gray-700 dark:text-gray-300">{s.message}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {status.completedAt && (
            <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">
              Completed {relativeTime(status.completedAt)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
