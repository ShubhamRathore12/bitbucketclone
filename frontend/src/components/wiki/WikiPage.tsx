import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Pencil,
  ChevronRight,
  ChevronDown,
  FileText,
  Loader2,
  AlertCircle,
  Clock,
  List,
} from 'lucide-react';
import type { WikiPage as WikiPageType } from '@/types/wiki';
import Button from '@/components/ui/Button';

interface WikiPageProps {
  repoFullName: string;
  slug: string;
  onEdit?: (page: WikiPageType) => void;
  onNavigate?: (slug: string) => void;
}

interface WikiTreeNode {
  slug: string;
  title: string;
  children: WikiTreeNode[];
}

async function fetchPage(repoFullName: string, slug: string): Promise<WikiPageType> {
  const res = await fetch(`/api/repositories/${repoFullName}/wiki/${slug}`);
  if (!res.ok) throw new Error('Failed to fetch wiki page');
  return res.json();
}

async function fetchPageTree(repoFullName: string): Promise<WikiTreeNode[]> {
  const res = await fetch(`/api/repositories/${repoFullName}/wiki?tree=true`);
  if (!res.ok) throw new Error('Failed to fetch wiki tree');
  return res.json();
}

// Extract headings from HTML content for TOC
function extractTOC(html: string): { id: string; text: string; level: number }[] {
  const headingRegex = /<h([1-6])[^>]*id="([^"]*)"[^>]*>(.*?)<\/h[1-6]>/gi;
  const headings: { id: string; text: string; level: number }[] = [];
  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    headings.push({
      level: parseInt(match[1]),
      id: match[2],
      text: match[3].replace(/<[^>]+>/g, ''),
    });
  }
  return headings;
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

function PageTreeItem({
  node,
  currentSlug,
  onNavigate,
  depth = 0,
}: {
  node: WikiTreeNode;
  currentSlug: string;
  onNavigate?: (slug: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isActive = node.slug === currentSlug;

  return (
    <li>
      <div className="flex items-center">
        {hasChildren && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        )}
        {!hasChildren && <span className="w-4.5" />}
        <button
          onClick={() => onNavigate?.(node.slug)}
          className={[
            'text-sm py-1 px-1.5 rounded truncate text-left flex-1',
            isActive
              ? 'font-semibold text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20'
              : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800',
          ].join(' ')}
        >
          {node.title}
        </button>
      </div>
      {hasChildren && expanded && (
        <ul className="ml-4 space-y-0.5">
          {node.children.map((child) => (
            <PageTreeItem
              key={child.slug}
              node={child}
              currentSlug={currentSlug}
              onNavigate={onNavigate}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function WikiPage({ repoFullName, slug, onEdit, onNavigate }: WikiPageProps) {
  const { data: page, isLoading, isError, error } = useQuery({
    queryKey: ['wiki-page', repoFullName, slug],
    queryFn: () => fetchPage(repoFullName, slug),
  });

  const { data: tree = [] } = useQuery({
    queryKey: ['wiki-tree', repoFullName],
    queryFn: () => fetchPageTree(repoFullName),
  });

  const toc = useMemo(() => {
    if (!page?.content) return [];
    return extractTOC(page.content);
  }, [page?.content]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (isError || !page) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md dark:bg-red-900/20 dark:border-red-800">
        <AlertCircle className="h-5 w-5 text-red-500" />
        <p className="text-sm text-red-700 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load wiki page'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      {/* Page tree sidebar */}
      <div className="w-56 shrink-0">
        <div className="sticky top-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 dark:text-gray-400 flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            Wiki pages
          </h3>
          <ul className="space-y-0.5">
            {tree.map((node) => (
              <PageTreeItem
                key={node.slug}
                node={node}
                currentSlug={slug}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{page.title}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1">
                Last edited by{' '}
                <img src={page.lastEditor.avatarUrl} alt="" className="h-4 w-4 rounded-full" />
                {page.lastEditor.displayName}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {relativeTime(page.updatedAt)}
              </span>
              <span>Revision {page.revision}</span>
            </div>
          </div>
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Pencil className="h-3.5 w-3.5" />}
              onClick={() => onEdit(page)}
            >
              Edit page
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="flex gap-6">
          <div
            className="flex-1 min-w-0 prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: page.content }}
          />

          {/* Table of contents */}
          {toc.length > 2 && (
            <div className="w-48 shrink-0">
              <div className="sticky top-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 dark:text-gray-400 flex items-center gap-1.5">
                  <List className="h-3.5 w-3.5" />
                  On this page
                </h4>
                <nav className="space-y-1">
                  {toc.map((heading) => (
                    <a
                      key={heading.id}
                      href={`#${heading.id}`}
                      className="block text-xs text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 truncate"
                      style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}
                    >
                      {heading.text}
                    </a>
                  ))}
                </nav>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
