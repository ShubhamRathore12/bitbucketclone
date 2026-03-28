import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, Pencil } from 'lucide-react';
import type { Issue, IssuePriority, IssueKind, CreateIssueRequest, UpdateIssueRequest } from '@/types/issues';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface IssueFormProps {
  repoFullName: string;
  issue?: Issue;
  onSaved?: (issue: Issue) => void;
  onCancel?: () => void;
}

export default function IssueForm({ repoFullName, issue, onSaved, onCancel }: IssueFormProps) {
  const isEdit = !!issue;
  const [title, setTitle] = useState(issue?.title ?? '');
  const [content, setContent] = useState(issue?.content ?? '');
  const [priority, setPriority] = useState<IssuePriority>(issue?.priority ?? 'major');
  const [kind, setKind] = useState<IssueKind>(issue?.kind ?? 'bug');
  const [assignee, setAssignee] = useState(issue?.assignee?.id ?? '');
  const [labels, setLabels] = useState(issue?.labels.map((l) => l.id).join(',') ?? '');
  const [previewMode, setPreviewMode] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: CreateIssueRequest) => {
      const res = await fetch(`/api/repositories/${repoFullName}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create issue');
      return res.json() as Promise<Issue>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['issues', repoFullName] });
      onSaved?.(data);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateIssueRequest) => {
      const res = await fetch(`/api/repositories/${repoFullName}/issues/${issue!.number}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update issue');
      return res.json() as Promise<Issue>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['issue', repoFullName, issue!.number] });
      onSaved?.(data);
    },
  });

  const mutation = isEdit ? updateMutation : createMutation;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: CreateIssueRequest = {
      title,
      content: content || undefined,
      priority,
      kind,
      assignee: assignee || undefined,
      labels: labels ? labels.split(',').map((l) => l.trim()).filter(Boolean) : undefined,
    };
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  // Preview markdown
  useEffect(() => {
    if (!previewMode || !content) {
      setPreviewHtml('');
      return;
    }
    // In production, this would call a markdown rendering API
    setPreviewHtml(`<p>${content.replace(/\n/g, '<br/>')}</p>`);
  }, [previewMode, content]);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {isEdit ? 'Edit issue' : 'Create new issue'}
      </h2>

      {/* Title */}
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Issue title"
        required
      />

      {/* Description with write/preview tabs */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
          <div className="flex ml-auto border border-gray-200 rounded-md overflow-hidden dark:border-gray-700">
            <button
              type="button"
              onClick={() => setPreviewMode(false)}
              className={[
                'px-2.5 py-1 text-xs font-medium transition-colors inline-flex items-center gap-1',
                !previewMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400',
              ].join(' ')}
            >
              <Pencil className="h-3 w-3" />
              Write
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode(true)}
              className={[
                'px-2.5 py-1 text-xs font-medium transition-colors inline-flex items-center gap-1',
                previewMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400',
              ].join(' ')}
            >
              <Eye className="h-3 w-3" />
              Preview
            </button>
          </div>
        </div>

        {previewMode ? (
          <div className="min-h-[160px] px-3 py-2 border border-gray-300 rounded-md prose prose-sm dark:prose-invert max-w-none dark:bg-gray-800 dark:border-gray-600">
            {previewHtml ? (
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <p className="text-gray-400 italic">Nothing to preview</p>
            )}
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            placeholder="Describe the issue... (Markdown supported)"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md resize-y
              focus:outline-none focus:ring-2 focus:ring-blue-500
              dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder:text-gray-500"
          />
        )}
      </div>

      {/* Type and Priority selectors */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kind</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as IssueKind)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
              focus:outline-none focus:ring-2 focus:ring-blue-500
              dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
          >
            <option value="bug">Bug</option>
            <option value="enhancement">Enhancement</option>
            <option value="proposal">Proposal</option>
            <option value="task">Task</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as IssuePriority)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
              focus:outline-none focus:ring-2 focus:ring-blue-500
              dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
          >
            <option value="trivial">Trivial</option>
            <option value="minor">Minor</option>
            <option value="major">Major</option>
            <option value="critical">Critical</option>
            <option value="blocker">Blocker</option>
          </select>
        </div>
      </div>

      {/* Assignee */}
      <Input
        label="Assignee (user ID)"
        value={assignee}
        onChange={(e) => setAssignee(e.target.value)}
        placeholder="Leave blank for unassigned"
      />

      {/* Labels */}
      <Input
        label="Labels (comma-separated IDs)"
        value={labels}
        onChange={(e) => setLabels(e.target.value)}
        placeholder="e.g. label-id-1, label-id-2"
      />

      {/* Actions */}
      <div className="flex items-center gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
        {onCancel && (
          <Button variant="ghost" type="button" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          variant="primary"
          type="submit"
          loading={mutation.isPending}
          disabled={!title.trim()}
        >
          {isEdit ? 'Update issue' : 'Create issue'}
        </Button>
      </div>

      {mutation.isError && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {mutation.error instanceof Error ? mutation.error.message : 'Operation failed'}
        </p>
      )}
    </form>
  );
}
