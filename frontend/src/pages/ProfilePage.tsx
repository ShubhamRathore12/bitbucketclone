import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User as UserIcon,
  Camera,
  Key,
  Link2,
  Bell,
  Save,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Shield,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import type { User, UpdateProfileRequest } from '@/types/auth';
import type { ApiError } from '@/types/common';

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function putJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) { const err: ApiError = await res.json(); throw err; }
  return res.json();
}

async function postFormData<T>(url: string, formData: FormData): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    body: formData,
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('API error');
  return res.json();
}

async function deleteRequest(url: string): Promise<void> {
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
  });
  if (!res.ok) throw new Error('API error');
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`} />;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProfileSection = 'profile' | 'ssh-keys' | 'oauth' | 'notifications';

interface SSHKey {
  id: string;
  label: string;
  fingerprint: string;
  createdAt: string;
}

interface OAuthAccount {
  id: string;
  provider: string;
  providerUsername: string;
  connectedAt: string;
}

interface NotificationPrefs {
  emailOnPRReview: boolean;
  emailOnPRComment: boolean;
  emailOnIssueAssignment: boolean;
  emailOnPipelineFailure: boolean;
  emailOnMention: boolean;
}

// ---------------------------------------------------------------------------
// ProfilePage
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<ProfileSection>('profile');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Current user
  const userQuery = useQuery<User>({
    queryKey: ['currentUser'],
    queryFn: () => fetchJson('/api/user/me'),
  });

  // Profile form state
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');

  useEffect(() => {
    if (userQuery.data) {
      setDisplayName(userQuery.data.displayName || '');
      setBio(userQuery.data.bio || '');
      setLocation(userQuery.data.location || '');
      setWebsite(userQuery.data.website || '');
    }
  }, [userQuery.data]);

  // Save profile
  const saveProfileMutation = useMutation({
    mutationFn: () =>
      putJson<User>('/api/user/me', {
        displayName,
        bio,
        location,
        website,
      } satisfies UpdateProfileRequest),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['currentUser'] }),
  });

  // Avatar upload
  const avatarMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('avatar', file);
      return postFormData('/api/user/me/avatar', fd);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['currentUser'] }),
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) avatarMutation.mutate(file);
  };

  // SSH keys
  const sshKeysQuery = useQuery<SSHKey[]>({
    queryKey: ['ssh-keys'],
    queryFn: () => fetchJson('/api/user/me/ssh-keys'),
    enabled: activeSection === 'ssh-keys',
  });

  const [showAddKey, setShowAddKey] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');

  const addKeyMutation = useMutation({
    mutationFn: () => postJson('/api/user/me/ssh-keys', { label: newKeyLabel, key: newKeyValue }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssh-keys'] });
      setShowAddKey(false);
      setNewKeyLabel('');
      setNewKeyValue('');
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: (id: string) => deleteRequest(`/api/user/me/ssh-keys/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ssh-keys'] }),
  });

  // OAuth accounts
  const oauthQuery = useQuery<OAuthAccount[]>({
    queryKey: ['oauth-accounts'],
    queryFn: () => fetchJson('/api/user/me/oauth-accounts'),
    enabled: activeSection === 'oauth',
  });

  // Notification prefs
  const notifQuery = useQuery<NotificationPrefs>({
    queryKey: ['notification-prefs'],
    queryFn: () => fetchJson('/api/user/me/notifications'),
    enabled: activeSection === 'notifications',
  });

  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({
    emailOnPRReview: true,
    emailOnPRComment: true,
    emailOnIssueAssignment: true,
    emailOnPipelineFailure: true,
    emailOnMention: true,
  });

  useEffect(() => {
    if (notifQuery.data) setNotifPrefs(notifQuery.data);
  }, [notifQuery.data]);

  const saveNotifMutation = useMutation({
    mutationFn: () => putJson('/api/user/me/notifications', notifPrefs),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification-prefs'] }),
  });

  const user = userQuery.data;

  const sections: { key: ProfileSection; label: string; icon: React.ReactNode }[] = [
    { key: 'profile', label: 'Profile', icon: <UserIcon className="h-4 w-4" /> },
    { key: 'ssh-keys', label: 'SSH Keys', icon: <Key className="h-4 w-4" /> },
    { key: 'oauth', label: 'Connected Accounts', icon: <Link2 className="h-4 w-4" /> },
    { key: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Account Settings</h1>

        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="w-56 shrink-0 hidden lg:block">
            <nav className="space-y-1 sticky top-6">
              {sections.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setActiveSection(s.key)}
                  className={[
                    'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer',
                    activeSection === s.key
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50',
                  ].join(' ')}
                >
                  {s.icon}
                  {s.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* Profile */}
            {activeSection === 'profile' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Profile</h2>

                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <Avatar
                      src={user?.avatarUrl}
                      name={user?.displayName}
                      size="xl"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
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
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {user?.displayName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">@{user?.username}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                  </div>
                </div>

                <Input label="Display Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                <Textarea label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about yourself" />
                <Input label="Location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" />
                <Input label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />

                {saveProfileMutation.isSuccess && (
                  <div className="rounded-md bg-green-50 dark:bg-green-900/30 p-3 text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Profile updated successfully.
                  </div>
                )}
                {saveProfileMutation.isError && (
                  <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-700 dark:text-red-300">
                    {(saveProfileMutation.error as ApiError)?.message || 'Failed to update profile.'}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button variant="primary" leftIcon={<Save className="h-4 w-4" />} loading={saveProfileMutation.isPending} onClick={() => saveProfileMutation.mutate()}>
                    Save profile
                  </Button>
                </div>
              </div>
            )}

            {/* SSH Keys */}
            {activeSection === 'ssh-keys' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">SSH Keys</h2>
                  <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowAddKey(true)}>
                    Add key
                  </Button>
                </div>

                {sshKeysQuery.isLoading ? (
                  <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : !sshKeysQuery.data?.length ? (
                  <div className="text-center py-8">
                    <Key className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No SSH keys added yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {sshKeysQuery.data.map((key) => (
                      <div key={key.id} className="py-3 flex items-center gap-3">
                        <Key className="h-4 w-4 text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{key.label}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">{key.fingerprint}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">Added {new Date(key.createdAt).toLocaleDateString()}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => deleteKeyMutation.mutate(key.id)}>
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <Modal open={showAddKey} onClose={() => setShowAddKey(false)} title="Add SSH Key" footer={
                  <>
                    <Button variant="secondary" onClick={() => setShowAddKey(false)}>Cancel</Button>
                    <Button variant="primary" loading={addKeyMutation.isPending} disabled={!newKeyLabel.trim() || !newKeyValue.trim()} onClick={() => addKeyMutation.mutate()}>
                      Add key
                    </Button>
                  </>
                }>
                  <div className="space-y-4">
                    <Input label="Label" value={newKeyLabel} onChange={(e) => setNewKeyLabel(e.target.value)} placeholder="My laptop" />
                    <Textarea label="Key" value={newKeyValue} onChange={(e) => setNewKeyValue(e.target.value)} placeholder="ssh-ed25519 AAAA..." className="font-mono text-xs min-h-[120px]" />
                  </div>
                </Modal>
              </div>
            )}

            {/* OAuth accounts */}
            {activeSection === 'oauth' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Connected Accounts</h2>
                {oauthQuery.isLoading ? (
                  <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : (
                  <div className="space-y-3">
                    {['Google', 'GitHub', 'Microsoft'].map((provider) => {
                      const connected = oauthQuery.data?.find((a) => a.provider.toLowerCase() === provider.toLowerCase());
                      return (
                        <div key={provider} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                              <ExternalLink className="h-4 w-4 text-gray-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{provider}</p>
                              {connected && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Connected as {connected.providerUsername}
                                </p>
                              )}
                            </div>
                          </div>
                          {connected ? (
                            <Button variant="outline" size="sm" className="text-red-600">Disconnect</Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => { window.location.href = `/api/auth/oauth/${provider.toLowerCase()}`; }}>
                              Connect
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Notifications */}
            {activeSection === 'notifications' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-5">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notification Preferences</h2>

                {notifQuery.isLoading ? (
                  <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                ) : (
                  <div className="space-y-4">
                    {[
                      { key: 'emailOnPRReview' as const, label: 'Pull request review requested' },
                      { key: 'emailOnPRComment' as const, label: 'New comment on your pull request' },
                      { key: 'emailOnIssueAssignment' as const, label: 'Issue assigned to you' },
                      { key: 'emailOnPipelineFailure' as const, label: 'Pipeline failure' },
                      { key: 'emailOnMention' as const, label: 'Mentioned in a comment' },
                    ].map((pref) => (
                      <label key={pref.key} className="flex items-center justify-between py-2 cursor-pointer">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{pref.label}</span>
                        <input
                          type="checkbox"
                          checked={notifPrefs[pref.key]}
                          onChange={(e) => setNotifPrefs((prev) => ({ ...prev, [pref.key]: e.target.checked }))}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                        />
                      </label>
                    ))}
                  </div>
                )}

                {saveNotifMutation.isSuccess && (
                  <div className="rounded-md bg-green-50 dark:bg-green-900/30 p-3 text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Preferences saved.
                  </div>
                )}

                <div className="flex justify-end">
                  <Button variant="primary" leftIcon={<Save className="h-4 w-4" />} loading={saveNotifMutation.isPending} onClick={() => saveNotifMutation.mutate()}>
                    Save preferences
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
