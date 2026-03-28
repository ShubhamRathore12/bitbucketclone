import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  Upload,
  Globe,
  Lock,
  Trash2,
  AlertCircle,
  Camera,
} from 'lucide-react';
import type { Workspace } from '@/types/workspace';
import Button from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';

interface WorkspaceSettingsProps {
  workspace: Workspace;
  onDeleted?: () => void;
}

export default function WorkspaceSettings({ workspace, onDeleted }: WorkspaceSettingsProps) {
  const [name, setName] = useState(workspace.name);
  const [slug, setSlug] = useState(workspace.slug);
  const [description, setDescription] = useState(workspace.description);
  const [avatarPreview, setAvatarPreview] = useState(workspace.avatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(!workspace.isPersonal);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('slug', slug);
      formData.append('description', description);
      if (avatarFile) formData.append('avatar', avatarFile);

      const res = await fetch(`/api/workspaces/${workspace.slug}`, {
        method: 'PATCH',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to update workspace');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-dashboard'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/workspaces/${workspace.slug}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete workspace');
    },
    onSuccess: () => onDeleted?.(),
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAvatarPreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate();
  };

  return (
    <div className="max-w-2xl space-y-8">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Workspace settings</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Avatar */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Avatar
          </label>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <img
                src={avatarPreview}
                alt={name}
                className="h-16 w-16 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100
                  transition-opacity flex items-center justify-center"
              >
                <Camera className="h-5 w-5 text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <p>Click the avatar to upload a new image.</p>
              <p className="text-xs">Recommended: 256x256px, PNG or JPG</p>
            </div>
          </div>
        </div>

        {/* Name */}
        <Input
          label="Workspace name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        {/* Slug */}
        <Input
          label="Slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
          helperText="Used in URLs. Only lowercase letters, numbers, and hyphens."
          required
        />

        {/* Description */}
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your workspace..."
          rows={3}
        />

        {/* Visibility */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Visibility
          </label>
          <div className="space-y-2">
            <label className={[
              'flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors',
              isPublic
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-400'
                : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800',
            ].join(' ')}>
              <input
                type="radio"
                name="visibility"
                checked={isPublic}
                onChange={() => setIsPublic(true)}
                className="mt-0.5 accent-blue-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 inline-flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-green-500" />
                  Public
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Anyone can see this workspace. Repositories can still be private.
                </p>
              </div>
            </label>
            <label className={[
              'flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors',
              !isPublic
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-400'
                : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800',
            ].join(' ')}>
              <input
                type="radio"
                name="visibility"
                checked={!isPublic}
                onChange={() => setIsPublic(false)}
                className="mt-0.5 accent-blue-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 inline-flex items-center gap-1.5">
                  <Lock className="h-4 w-4 text-orange-500" />
                  Private
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Only workspace members can see this workspace.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="primary"
            type="submit"
            leftIcon={<Save className="h-4 w-4" />}
            loading={updateMutation.isPending}
          >
            Save changes
          </Button>
          {updateMutation.isSuccess && (
            <span className="text-sm text-green-600 dark:text-green-400">Changes saved successfully.</span>
          )}
          {updateMutation.isError && (
            <span className="text-sm text-red-600 dark:text-red-400">
              {updateMutation.error instanceof Error ? updateMutation.error.message : 'Failed to save'}
            </span>
          )}
        </div>
      </form>

      {/* Danger zone */}
      <div className="border border-red-200 rounded-lg dark:border-red-800">
        <div className="px-4 py-3 bg-red-50 dark:bg-red-900/10 border-b border-red-200 dark:border-red-800">
          <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Danger zone</h3>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                Delete this workspace
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                This will permanently delete the workspace, all repositories, and associated data.
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 className="h-3.5 w-3.5" />}
              onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
            >
              Delete workspace
            </Button>
          </div>

          {showDeleteConfirm && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-md space-y-3">
              <p className="text-sm text-red-700 dark:text-red-400">
                Type <strong>{workspace.slug}</strong> to confirm deletion:
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={workspace.slug}
                className="w-full px-3 py-2 text-sm border border-red-300 rounded-md
                  focus:outline-none focus:ring-2 focus:ring-red-500
                  dark:bg-gray-800 dark:border-red-600 dark:text-gray-100"
              />
              <Button
                variant="danger"
                size="sm"
                disabled={deleteConfirmText !== workspace.slug}
                loading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                I understand, delete this workspace
              </Button>
              {deleteMutation.isError && (
                <p className="text-sm text-red-600">
                  {deleteMutation.error instanceof Error ? deleteMutation.error.message : 'Failed to delete'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
