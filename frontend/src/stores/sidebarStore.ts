import { create } from "zustand";
import type { Workspace } from "@/types/workspace";
import type { Repository } from "@/types/repos";

interface SidebarState {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  recentRepos: Repository[];

  toggleCollapse: () => void;
  setCollapsed: (collapsed: boolean) => void;
  toggleMobile: () => void;
  setMobileOpen: (open: boolean) => void;
  setCurrentWorkspace: (workspace: Workspace) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setRecentRepos: (repos: Repository[]) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isCollapsed: false,
  isMobileOpen: false,
  currentWorkspace: null,
  workspaces: [],
  recentRepos: [],

  toggleCollapse: () => set((s) => ({ isCollapsed: !s.isCollapsed })),
  setCollapsed: (isCollapsed) => set({ isCollapsed }),
  toggleMobile: () => set((s) => ({ isMobileOpen: !s.isMobileOpen })),
  setMobileOpen: (isMobileOpen) => set({ isMobileOpen }),
  setCurrentWorkspace: (currentWorkspace) => set({ currentWorkspace }),
  setWorkspaces: (workspaces) => set({ workspaces }),
  setRecentRepos: (recentRepos) => set({ recentRepos: recentRepos.slice(0, 5) }),
}));
