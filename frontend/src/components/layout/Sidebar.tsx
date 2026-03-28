import React, { useState, useRef, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GitPullRequest,
  BookOpen,
  Bug,
  Workflow,
  Code2,
  Plus,
  FolderGit2,
  Clock,
} from "lucide-react";
import { useSidebarStore } from "@/stores/sidebarStore";
import type { Workspace } from "@/types/workspace";

const navItems = [
  { label: "Repositories", to: "/repositories", icon: FolderGit2 },
  { label: "Pull Requests", to: "/pull-requests", icon: GitPullRequest },
  { label: "Issues", to: "/issues", icon: Bug },
  { label: "Pipelines", to: "/pipelines", icon: Workflow },
  { label: "Snippets", to: "/snippets", icon: Code2 },
] as const;

function WorkspaceSelector() {
  const { currentWorkspace, workspaces, setCurrentWorkspace } = useSidebarStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const display = currentWorkspace?.name ?? "Select workspace";

  return (
    <div ref={ref} className="relative px-3 mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center w-full gap-2 px-3 py-2 text-sm font-medium rounded-md
                   bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200
                   hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        {currentWorkspace?.avatarUrl ? (
          <img
            src={currentWorkspace.avatarUrl}
            alt=""
            className="w-5 h-5 rounded-full"
          />
        ) : (
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold">
            {display.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="truncate flex-1 text-left">{display}</span>
        <ChevronDown className="w-4 h-4 shrink-0" />
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded-md shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 py-1 max-h-64 overflow-auto">
          {workspaces.map((ws: Workspace) => (
            <button
              key={ws.id}
              onClick={() => {
                setCurrentWorkspace(ws);
                setOpen(false);
              }}
              className={[
                "flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors",
                ws.id === currentWorkspace?.id
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700",
              ].join(" ")}
            >
              {ws.avatarUrl ? (
                <img src={ws.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
              ) : (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold">
                  {ws.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="truncate">{ws.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { isCollapsed, toggleCollapse, recentRepos, setMobileOpen } =
    useSidebarStore();
  const navigate = useNavigate();

  const closeMobileIfNeeded = () => {
    if (window.innerWidth < 1024) {
      setMobileOpen(false);
    }
  };

  return (
    <aside
      className={[
        "flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-[width] duration-200 overflow-hidden",
        isCollapsed ? "w-16" : "w-64",
      ].join(" ")}
    >
      {/* Collapse toggle */}
      <div className="flex items-center justify-end px-2 py-2 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={toggleCollapse}
          className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Workspace selector - hidden when collapsed */}
      {!isCollapsed && (
        <div className="pt-3">
          <WorkspaceSelector />
        </div>
      )}

      {/* Navigation links */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {navItems.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={closeMobileIfNeeded}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200",
                isCollapsed ? "justify-center" : "",
              ].join(" ")
            }
            title={isCollapsed ? label : undefined}
          >
            <Icon className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Recent repos */}
      {!isCollapsed && recentRepos.length > 0 && (
        <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-800">
          <h4 className="flex items-center gap-1.5 px-1 pt-3 pb-2 text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5" />
            Recent
          </h4>
          <ul className="space-y-0.5">
            {recentRepos.map((repo) => (
              <li key={repo.id}>
                <NavLink
                  to={`/${repo.fullName}`}
                  onClick={closeMobileIfNeeded}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors truncate",
                      isActive
                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
                    ].join(" ")
                  }
                >
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <span className="truncate">{repo.name}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Create button */}
      {!isCollapsed && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={() => {
              closeMobileIfNeeded();
              navigate("/repositories/new");
            }}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 text-sm font-medium
                       rounded-md bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800
                       dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create repository
          </button>
        </div>
      )}

      {isCollapsed && (
        <div className="p-2 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={() => navigate("/repositories/new")}
            className="flex items-center justify-center w-full p-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            title="Create repository"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}
    </aside>
  );
}
