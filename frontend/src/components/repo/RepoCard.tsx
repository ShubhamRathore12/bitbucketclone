import React from 'react';
import { GitFork, Star, Lock, Globe, Clock } from 'lucide-react';
import type { Repository } from '@/types/repos';

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: 'bg-blue-500',
  JavaScript: 'bg-yellow-400',
  Python: 'bg-green-500',
  Java: 'bg-red-500',
  Go: 'bg-cyan-500',
  Rust: 'bg-orange-600',
  Ruby: 'bg-red-600',
  PHP: 'bg-purple-500',
  'C#': 'bg-green-600',
  'C++': 'bg-pink-500',
  C: 'bg-gray-500',
  Swift: 'bg-orange-500',
  Kotlin: 'bg-violet-500',
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWeek < 5) return `${diffWeek}w ago`;
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${diffYear}y ago`;
}

interface RepoCardProps {
  repo: Repository;
  onClick?: () => void;
}

export default function RepoCard({ repo, onClick }: RepoCardProps) {
  return (
    <button
      onClick={onClick}
      className="block w-full text-left p-4 border border-gray-200 rounded-lg hover:border-blue-300
        hover:shadow-md transition-all bg-white dark:bg-gray-800 dark:border-gray-700
        dark:hover:border-blue-600 group"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-md bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
          {repo.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-blue-600 dark:text-blue-400 group-hover:underline truncate">
              {repo.fullName}
            </h3>
            {repo.visibility === 'private' ? (
              <Lock className="h-3.5 w-3.5 text-orange-500 shrink-0" />
            ) : (
              <Globe className="h-3.5 w-3.5 text-green-500 shrink-0" />
            )}
          </div>
          {repo.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
              {repo.description}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
        {repo.language && (
          <span className="inline-flex items-center gap-1">
            <span
              className={[
                'h-2.5 w-2.5 rounded-full',
                LANGUAGE_COLORS[repo.language] || 'bg-gray-400',
              ].join(' ')}
            />
            {repo.language}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Star className="h-3.5 w-3.5" />
          {repo.starsCount}
        </span>
        <span className="inline-flex items-center gap-1">
          <GitFork className="h-3.5 w-3.5" />
          {repo.forksCount}
        </span>
        <span className="inline-flex items-center gap-1 ml-auto">
          <Clock className="h-3.5 w-3.5" />
          {relativeTime(repo.updatedAt)}
        </span>
      </div>
    </button>
  );
}
