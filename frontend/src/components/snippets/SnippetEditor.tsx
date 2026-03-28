import React, { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  X,
  FileCode,
  Save,
  Lock,
  Globe,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { Snippet, CreateSnippetRequest } from '@/types/snippets';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface SnippetEditorProps {
  snippet?: Snippet;
  onSaved?: (snippet: Snippet) => void;
  onCancel?: () => void;
}

interface FileEntry {
  id: string;
  filename: string;
  content: string;
  language: string;
}

const COMMON_EXTENSIONS: Record<string, string> = {
  js: 'JavaScript',
  ts: 'TypeScript',
  tsx: 'TypeScript',
  jsx: 'JavaScript',
  py: 'Python',
  rb: 'Ruby',
  go: 'Go',
  rs: 'Rust',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  h: 'C',
  cs: 'C#',
  php: 'PHP',
  swift: 'Swift',
  kt: 'Kotlin',
  sh: 'Shell',
  bash: 'Shell',
  yml: 'YAML',
  yaml: 'YAML',
  json: 'JSON',
  xml: 'XML',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  md: 'Markdown',
  sql: 'SQL',
  dockerfile: 'Docker',
  tf: 'Terraform',
};

function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return COMMON_EXTENSIONS[ext] ?? '';
}

let nextId = 1;
function makeId(): string {
  return `file-${nextId++}`;
}

export default function SnippetEditor({ snippet, onSaved, onCancel }: SnippetEditorProps) {
  const isEdit = !!snippet;
  const [title, setTitle] = useState(snippet?.title ?? '');
  const [isPrivate, setIsPrivate] = useState(snippet?.isPrivate ?? false);
  const [files, setFiles] = useState<FileEntry[]>(
    snippet?.files.map((f) => ({
      id: makeId(),
      filename: f.filename,
      content: f.content,
      language: f.language,
    })) ?? [{ id: makeId(), filename: '', content: '', language: '' }]
  );
  const [activeFileId, setActiveFileId] = useState(files[0]?.id ?? '');

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const body: CreateSnippetRequest = {
        title,
        isPrivate,
        files: files
          .filter((f) => f.filename.trim())
          .map((f) => ({ filename: f.filename, content: f.content })),
      };
      const url = isEdit ? `/api/snippets/${snippet!.id}` : '/api/snippets';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Failed to ${isEdit ? 'update' : 'create'} snippet`);
      return res.json() as Promise<Snippet>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['snippets'] });
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: ['snippet', snippet!.id] });
      }
      onSaved?.(data);
    },
  });

  const addFile = useCallback(() => {
    const newFile: FileEntry = { id: makeId(), filename: '', content: '', language: '' };
    setFiles((prev) => [...prev, newFile]);
    setActiveFileId(newFile.id);
  }, []);

  const removeFile = useCallback(
    (id: string) => {
      setFiles((prev) => {
        const next = prev.filter((f) => f.id !== id);
        if (activeFileId === id && next.length > 0) {
          setActiveFileId(next[0].id);
        }
        return next;
      });
    },
    [activeFileId]
  );

  const updateFile = useCallback(
    (id: string, updates: Partial<FileEntry>) => {
      setFiles((prev) =>
        prev.map((f) => {
          if (f.id !== id) return f;
          const updated = { ...f, ...updates };
          if (updates.filename && !updates.language) {
            updated.language = detectLanguage(updates.filename);
          }
          return updated;
        })
      );
    },
    []
  );

  const activeFile = files.find((f) => f.id === activeFileId) ?? files[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
        {isEdit ? 'Edit snippet' : 'Create new snippet'}
      </h2>

      {/* Title + visibility */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Snippet title"
            required
          />
        </div>
        <button
          type="button"
          onClick={() => setIsPrivate(!isPrivate)}
          className={[
            'inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-md transition-colors mb-[2px]',
            isPrivate
              ? 'border-orange-300 text-orange-700 bg-orange-50 dark:border-orange-600 dark:text-orange-400 dark:bg-orange-900/20'
              : 'border-green-300 text-green-700 bg-green-50 dark:border-green-600 dark:text-green-400 dark:bg-green-900/20',
          ].join(' ')}
        >
          {isPrivate ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
          {isPrivate ? 'Private' : 'Public'}
        </button>
      </div>

      {/* File tabs */}
      <div className="border border-gray-200 rounded-md overflow-hidden dark:border-gray-700">
        <div className="flex items-center bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {files.map((file) => (
            <div
              key={file.id}
              className={[
                'flex items-center gap-1 border-b-2 transition-colors',
                activeFileId === file.id
                  ? 'border-blue-600 bg-white dark:bg-gray-800 dark:border-blue-400'
                  : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-700',
              ].join(' ')}
            >
              <button
                type="button"
                onClick={() => setActiveFileId(file.id)}
                className="px-3 py-2 text-sm"
              >
                <FileCode className="h-3.5 w-3.5 inline mr-1 text-gray-400" />
                {file.filename || 'untitled'}
                {file.language && (
                  <span className="text-xs text-gray-400 ml-1">({file.language})</span>
                )}
              </button>
              {files.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="p-1 mr-1 text-gray-400 hover:text-red-500 rounded"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addFile}
            className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 inline-flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add file
          </button>
        </div>

        {/* Active file editor */}
        {activeFile && (
          <div>
            {/* Filename input */}
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <input
                type="text"
                value={activeFile.filename}
                onChange={(e) => updateFile(activeFile.id, { filename: e.target.value })}
                placeholder="filename.ext (language auto-detected from extension)"
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
              />
            </div>

            {/* Code editor (Monaco replacement: textarea) */}
            <div className="flex">
              <div className="py-3 px-2 bg-gray-50 dark:bg-gray-800 text-right text-xs text-gray-400 dark:text-gray-600 select-none font-mono leading-6 min-w-[3rem]">
                {activeFile.content.split('\n').map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <textarea
                value={activeFile.content}
                onChange={(e) => updateFile(activeFile.id, { content: e.target.value })}
                placeholder="Paste or type your code here..."
                spellCheck={false}
                className="flex-1 p-3 font-mono text-sm leading-6 bg-white dark:bg-gray-900 dark:text-gray-200
                  text-gray-800 resize-y border-none focus:outline-none min-h-[300px]"
                style={{ tabSize: 2 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 justify-end">
        {onCancel && (
          <Button variant="ghost" type="button" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          variant="primary"
          type="submit"
          leftIcon={<Save className="h-4 w-4" />}
          loading={mutation.isPending}
          disabled={!title.trim() || files.every((f) => !f.filename.trim())}
        >
          {isEdit ? 'Update snippet' : 'Create snippet'}
        </Button>
      </div>

      {mutation.isError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md dark:bg-red-900/20 dark:border-red-800">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <p className="text-sm text-red-700 dark:text-red-400">
            {mutation.error instanceof Error ? mutation.error.message : 'Operation failed'}
          </p>
        </div>
      )}
    </form>
  );
}
