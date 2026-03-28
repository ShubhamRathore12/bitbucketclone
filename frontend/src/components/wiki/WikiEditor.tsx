import React, { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  Eye,
  Pencil,
  Columns,
  Bold,
  Italic,
  Heading,
  Link2,
  Image,
  List,
  ListOrdered,
  Code,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { WikiPage, UpdateWikiPageRequest } from '@/types/wiki';
import Button from '@/components/ui/Button';

interface WikiEditorProps {
  repoFullName: string;
  page?: WikiPage;
  onSaved?: (slug: string) => void;
  onCancel?: () => void;
}

type ViewMode = 'write' | 'preview' | 'split';

export default function WikiEditor({ repoFullName, page, onSaved, onCancel }: WikiEditorProps) {
  const isNew = !page;
  const [title, setTitle] = useState(page?.title ?? '');
  const [content, setContent] = useState(page?.content ?? '');
  const [commitMessage, setCommitMessage] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [previewHtml, setPreviewHtml] = useState('');

  const queryClient = useQueryClient();

  // Simple markdown preview (in production, call server-side rendering)
  useEffect(() => {
    // Naive markdown -> html for preview
    let html = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br/>');
    setPreviewHtml(html);
  }, [content]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const slug = page?.slug ?? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const url = isNew
        ? `/api/repositories/${repoFullName}/wiki`
        : `/api/repositories/${repoFullName}/wiki/${page!.slug}`;
      const method = isNew ? 'POST' : 'PUT';

      const body: UpdateWikiPageRequest = {
        title,
        content,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save wiki page');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wiki-tree', repoFullName] });
      queryClient.invalidateQueries({ queryKey: ['wiki-page', repoFullName] });
      onSaved?.(data.slug);
    },
  });

  const insertMarkdown = useCallback(
    (before: string, after: string = '') => {
      const textarea = document.querySelector<HTMLTextAreaElement>('#wiki-editor-textarea');
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = content.substring(start, end);
      const newContent =
        content.substring(0, start) + before + selected + after + content.substring(end);
      setContent(newContent);
      // Restore cursor after state update
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
      });
    },
    [content]
  );

  const toolbarActions = [
    { icon: <Bold className="h-4 w-4" />, action: () => insertMarkdown('**', '**'), title: 'Bold' },
    { icon: <Italic className="h-4 w-4" />, action: () => insertMarkdown('*', '*'), title: 'Italic' },
    { icon: <Heading className="h-4 w-4" />, action: () => insertMarkdown('## '), title: 'Heading' },
    { icon: <Code className="h-4 w-4" />, action: () => insertMarkdown('`', '`'), title: 'Code' },
    { icon: <Link2 className="h-4 w-4" />, action: () => insertMarkdown('[', '](url)'), title: 'Link' },
    { icon: <Image className="h-4 w-4" />, action: () => insertMarkdown('![alt](', ')'), title: 'Image' },
    { icon: <List className="h-4 w-4" />, action: () => insertMarkdown('- '), title: 'Bullet list' },
    { icon: <ListOrdered className="h-4 w-4" />, action: () => insertMarkdown('1. '), title: 'Numbered list' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          {isNew ? 'Create wiki page' : `Editing: ${page!.title}`}
        </h2>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex border border-gray-200 rounded-md overflow-hidden dark:border-gray-700">
            <button
              onClick={() => setViewMode('write')}
              className={[
                'px-2.5 py-1.5 text-xs font-medium inline-flex items-center gap-1 transition-colors',
                viewMode === 'write'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400',
              ].join(' ')}
            >
              <Pencil className="h-3 w-3" />
              Write
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={[
                'px-2.5 py-1.5 text-xs font-medium inline-flex items-center gap-1 transition-colors',
                viewMode === 'split'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400',
              ].join(' ')}
            >
              <Columns className="h-3 w-3" />
              Split
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={[
                'px-2.5 py-1.5 text-xs font-medium inline-flex items-center gap-1 transition-colors',
                viewMode === 'preview'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400',
              ].join(' ')}
            >
              <Eye className="h-3 w-3" />
              Preview
            </button>
          </div>
        </div>
      </div>

      {/* Title input */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Page title"
        className="w-full px-3 py-2 text-lg font-semibold border border-gray-300 rounded-md
          focus:outline-none focus:ring-2 focus:ring-blue-500
          dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
      />

      {/* Toolbar */}
      {viewMode !== 'preview' && (
        <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-t-md">
          {toolbarActions.map((action, i) => (
            <button
              key={i}
              type="button"
              onClick={action.action}
              title={action.title}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded
                dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              {action.icon}
            </button>
          ))}
        </div>
      )}

      {/* Editor area */}
      <div className={[
        'border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden',
        viewMode !== 'preview' ? 'rounded-t-none border-t-0' : '',
      ].join(' ')}>
        <div className={viewMode === 'split' ? 'flex' : ''}>
          {/* Write panel */}
          {viewMode !== 'preview' && (
            <div className={viewMode === 'split' ? 'flex-1 border-r border-gray-200 dark:border-gray-700' : 'w-full'}>
              <textarea
                id="wiki-editor-textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your page content here... (Markdown supported)"
                spellCheck={false}
                className="w-full min-h-[400px] p-4 font-mono text-sm bg-white dark:bg-gray-900 dark:text-gray-200
                  text-gray-800 resize-y border-none focus:outline-none"
                style={{ tabSize: 2 }}
              />
            </div>
          )}

          {/* Preview panel */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div className={viewMode === 'split' ? 'flex-1' : 'w-full'}>
              <div
                className="min-h-[400px] p-4 prose prose-sm dark:prose-invert max-w-none overflow-auto"
                dangerouslySetInnerHTML={{
                  __html: previewHtml || '<p class="text-gray-400 italic">Nothing to preview</p>',
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Commit message */}
      <input
        type="text"
        value={commitMessage}
        onChange={(e) => setCommitMessage(e.target.value)}
        placeholder="Describe your changes (optional)"
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
          focus:outline-none focus:ring-2 focus:ring-blue-500
          dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
      />

      {/* Actions */}
      <div className="flex items-center gap-3 justify-end">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          variant="primary"
          leftIcon={<Save className="h-4 w-4" />}
          disabled={!title.trim() || !content.trim()}
          loading={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {isNew ? 'Create page' : 'Save changes'}
        </Button>
      </div>

      {saveMutation.isError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md dark:bg-red-900/20 dark:border-red-800">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <p className="text-sm text-red-700 dark:text-red-400">
            {saveMutation.error instanceof Error ? saveMutation.error.message : 'Failed to save'}
          </p>
        </div>
      )}
    </div>
  );
}
