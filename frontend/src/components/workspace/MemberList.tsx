import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Crown,
  UserCog,
  Trash2,
  ChevronDown,
  Search,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { WorkspaceMember, WorkspaceRole } from '@/types/repo';
import type { PaginatedResponse } from '@/types/common';
import Button from '@/components/ui/Button';

interface MemberListProps {
  workspaceSlug: string;
  currentUserRole?: WorkspaceRole;
}

async function fetchMembers(slug: string, page: number): Promise<PaginatedResponse<WorkspaceMember>> {
  const res = await fetch(`/api/workspaces/${slug}/members?page=${page}&pageSize=25`);
  if (!res.ok) throw new Error('Failed to fetch members');
  return res.json();
}

const roleConfig: Record<WorkspaceRole, { icon: React.ReactNode; color: string; label: string }> = {
  owner: {
    icon: <Crown className="h-3.5 w-3.5" />,
    color: 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-900/20 dark:border-yellow-800',
    label: 'Owner',
  },
  admin: {
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
    color: 'text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-900/20 dark:border-purple-800',
    label: 'Admin',
  },
  member: {
    icon: <Shield className="h-3.5 w-3.5" />,
    color: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800',
    label: 'Member',
  },
  contributor: {
    icon: <UserCog className="h-3.5 w-3.5" />,
    color: 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:border-gray-700',
    label: 'Contributor',
  },
};

export default function MemberList({ workspaceSlug, currentUserRole }: MemberListProps) {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');
  const [roleChangeFor, setRoleChangeFor] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin';

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['workspace-members', workspaceSlug, page],
    queryFn: () => fetchMembers(workspaceSlug, page),
    placeholderData: (prev) => prev,
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/workspaces/${workspaceSlug}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (!res.ok) throw new Error('Failed to invite member');
      return res.json();
    },
    onSuccess: () => {
      setShowInvite(false);
      setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceSlug] });
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: WorkspaceRole }) => {
      const res = await fetch(`/api/workspaces/${workspaceSlug}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error('Failed to change role');
      return res.json();
    },
    onSuccess: () => {
      setRoleChangeFor(null);
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceSlug] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await fetch(`/api/workspaces/${workspaceSlug}/members/${memberId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove member');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceSlug] });
    },
  });

  const filteredMembers = (data?.data ?? []).filter((m) =>
    !searchQuery ||
    m.user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md bg-white
              focus:outline-none focus:ring-2 focus:ring-blue-500
              dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
          />
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          <Users className="h-4 w-4 inline mr-1" />
          {data?.totalItems ?? 0} members
        </span>
        {canManage && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<UserPlus className="h-4 w-4" />}
            onClick={() => setShowInvite(!showInvite)}
            className="ml-auto"
          >
            Invite
          </Button>
        )}
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="p-4 border border-blue-200 rounded-md bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Invite a new member</h3>
          <div className="flex gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email address"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md
                focus:outline-none focus:ring-2 focus:ring-blue-500
                dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md
                dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
            >
              <option value="member">Member</option>
              <option value="contributor">Contributor</option>
              <option value="admin">Admin</option>
            </select>
            <Button
              variant="primary"
              size="sm"
              loading={inviteMutation.isPending}
              disabled={!inviteEmail.trim()}
              onClick={() => inviteMutation.mutate()}
            >
              Send invite
            </Button>
          </div>
          {inviteMutation.isError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {inviteMutation.error instanceof Error ? inviteMutation.error.message : 'Failed to invite'}
            </p>
          )}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-md dark:bg-red-900/20 dark:border-red-800">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-700 dark:text-red-400">
            {error instanceof Error ? error.message : 'Failed to load members'}
          </p>
        </div>
      )}

      {/* Member list */}
      {!isLoading && !isError && (
        <div className="border border-gray-200 rounded-md divide-y divide-gray-200 dark:border-gray-700 dark:divide-gray-700">
          {filteredMembers.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">No members found.</div>
          ) : (
            filteredMembers.map((member) => {
              const role = roleConfig[member.role];
              return (
                <div key={member.id} className="px-4 py-3 flex items-center gap-3">
                  <img
                    src={member.user.avatarUrl}
                    alt=""
                    className="h-9 w-9 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {member.user.displayName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">@{member.user.username}</p>
                  </div>

                  {/* Role badge with dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => canManage && member.role !== 'owner' ? setRoleChangeFor(roleChangeFor === member.id ? null : member.id) : undefined}
                      className={[
                        'inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full border',
                        role.color,
                        canManage && member.role !== 'owner' ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
                      ].join(' ')}
                    >
                      {role.icon}
                      {role.label}
                      {canManage && member.role !== 'owner' && <ChevronDown className="h-3 w-3" />}
                    </button>

                    {roleChangeFor === member.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setRoleChangeFor(null)} />
                        <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-md shadow-lg z-20 dark:bg-gray-800 dark:border-gray-700">
                          {(['admin', 'member', 'contributor'] as WorkspaceRole[]).map((r) => (
                            <button
                              key={r}
                              onClick={() => changeRoleMutation.mutate({ memberId: member.id, role: r })}
                              className={[
                                'w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 capitalize flex items-center gap-1.5',
                                r === member.role ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300',
                              ].join(' ')}
                            >
                              {roleConfig[r].icon}
                              {roleConfig[r].label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Remove button */}
                  {canManage && member.role !== 'owner' && (
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${member.user.displayName} from workspace?`)) {
                          removeMutation.mutate(member.id);
                        }
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded
                        dark:hover:bg-red-900/20 transition-colors"
                      title="Remove member"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            disabled={!data.hasPrevious}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50
              hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {page} of {data.totalPages}</span>
          <button
            disabled={!data.hasNext}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50
              hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
