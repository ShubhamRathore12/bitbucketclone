import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, RotateCcw, Loader2, AlertCircle, FileCode } from 'lucide-react';
import Button from '@/components/ui/Button';

interface PipelineConfigProps {
  repoFullName: string;
  branch?: string;
}

async function fetchConfig(repoFullName: string, branch: string): Promise<string> {
  const res = await fetch(
    `/api/repositories/${repoFullName}/src/${branch}/bitbucket-pipelines.yml?raw=true`
  );
  if (res.status === 404) return '';
  if (!res.ok) throw new Error('Failed to fetch pipeline config');
  return res.text();
}

export default function PipelineConfig({ repoFullName, branch = 'main' }: PipelineConfigProps) {
  const [content, setContent] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const queryClient = useQueryClient();

  const { data: originalContent, isLoading, isError, error } = useQuery({
    queryKey: ['pipeline-config', repoFullName, branch],
    queryFn: () => fetchConfig(repoFullName, branch),
  });

  // Initialize content once loaded
  React.useEffect(() => {
    if (originalContent !== undefined && content === null) {
      setContent(originalContent);
    }
  }, [originalContent, content]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/repositories/${repoFullName}/src/${branch}/bitbucket-pipelines.yml`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: content,
            message: 'Update pipeline configuration',
          }),
        }
      );
      if (!res.ok) throw new Error('Failed to save pipeline config');
      return res.json();
    },
    onSuccess: () => {
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['pipeline-config', repoFullName, branch] });
    },
  });

  const handleChange = useCallback(
    (value: string) => {
      setContent(value);
      setHasChanges(value !== originalContent);
    },
    [originalContent]
  );

  const handleReset = useCallback(() => {
    setContent(originalContent ?? '');
    setHasChanges(false);
  }, [originalContent]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md dark:bg-red-900/20 dark:border-red-800">
        <AlertCircle className="h-5 w-5 text-red-500" />
        <p className="text-sm text-red-700 dark:text-red-400">
          {error instanceof Error ? error.message : 'Failed to load config'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCode className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            bitbucket-pipelines.yml
          </h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">({branch})</span>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button variant="ghost" size="sm" leftIcon={<RotateCcw className="h-3.5 w-3.5" />} onClick={handleReset}>
              Reset
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Save className="h-3.5 w-3.5" />}
            disabled={!hasChanges}
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            Save
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="border border-gray-200 rounded-md overflow-hidden dark:border-gray-700">
        {!content && originalContent === '' ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <FileCode className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p>No pipeline configuration found.</p>
            <p className="text-sm mt-1">Create a bitbucket-pipelines.yml to get started.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Line numbers + textarea (Monaco would replace this in production) */}
            <div className="flex">
              <div className="py-3 px-2 bg-gray-50 dark:bg-gray-800 text-right text-xs text-gray-400 dark:text-gray-600 select-none font-mono leading-6 min-w-[3rem]">
                {(content ?? '').split('\n').map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <textarea
                value={content ?? ''}
                onChange={(e) => handleChange(e.target.value)}
                spellCheck={false}
                className="flex-1 p-3 font-mono text-sm leading-6 bg-white dark:bg-gray-900 dark:text-gray-200
                  text-gray-800 resize-none border-none focus:outline-none min-h-[400px]"
                style={{ tabSize: 2 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Validation hint */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Use YAML syntax. Pipeline steps are defined under the <code>pipelines</code> key.
        See{' '}
        <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">
          documentation
        </a>{' '}
        for configuration reference.
      </p>

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
