import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import App from "@/App";

// ---------------------------------------------------------------------------
// Lazy-loaded page components
// ---------------------------------------------------------------------------

// Auth
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/RegisterPage"));

// Dashboard
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));

// Workspace
const WorkspacePage = lazy(() => import("@/pages/WorkspacePage"));
const WorkspaceSettingsPage = lazy(() => import("@/pages/WorkspaceSettingsPage"));
const WorkspaceMembersPage = lazy(() => import("@/pages/WorkspaceMembersPage"));

// Repository
const RepoSourcePage = lazy(() => import("@/pages/RepoSourcePage"));
const RepoCommitsPage = lazy(() => import("@/pages/RepoCommitsPage"));
const RepoBranchesPage = lazy(() => import("@/pages/RepoBranchesPage"));

// Pull Requests
const PRListPage = lazy(() => import("@/pages/PRListPage"));
const PRCreatePage = lazy(() => import("@/pages/PRCreatePage"));
const PRDetailPage = lazy(() => import("@/pages/PRDetailPage"));

// Issues
const IssueListPage = lazy(() => import("@/pages/IssueListPage"));
const IssueCreatePage = lazy(() => import("@/pages/IssueCreatePage"));
const IssueDetailPage = lazy(() => import("@/pages/IssueDetailPage"));

// Pipelines
const PipelineListPage = lazy(() => import("@/pages/PipelineListPage"));
const PipelineDetailPage = lazy(() => import("@/pages/PipelineDetailPage"));

// Wiki
const WikiPage = lazy(() => import("@/pages/WikiPage"));
const WikiArticlePage = lazy(() => import("@/pages/WikiArticlePage"));

// Repo Settings
const RepoSettingsPage = lazy(() => import("@/pages/RepoSettingsPage"));

// Snippets
const SnippetListPage = lazy(() => import("@/pages/SnippetListPage"));
const SnippetCreatePage = lazy(() => import("@/pages/SnippetCreatePage"));
const SnippetDetailPage = lazy(() => import("@/pages/SnippetDetailPage"));

// Global
const SearchPage = lazy(() => import("@/pages/SearchPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

// ---------------------------------------------------------------------------
// Loading fallback
// ---------------------------------------------------------------------------

function PageLoader(): ReactNode {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-bb-200 border-t-bb-600" />
    </div>
  );
}

function withSuspense(element: ReactNode): ReactNode {
  return <Suspense fallback={<PageLoader />}>{element}</Suspense>;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      // Auth routes (no layout wrapper)
      {
        path: "login",
        element: withSuspense(<LoginPage />),
      },
      {
        path: "register",
        element: withSuspense(<RegisterPage />),
      },

      // Dashboard
      {
        index: true,
        element: withSuspense(<DashboardPage />),
      },

      // Snippets
      {
        path: "snippets",
        element: withSuspense(<SnippetListPage />),
      },
      {
        path: "snippets/new",
        element: withSuspense(<SnippetCreatePage />),
      },
      {
        path: "snippets/:id",
        element: withSuspense(<SnippetDetailPage />),
      },

      // Search
      {
        path: "search",
        element: withSuspense(<SearchPage />),
      },

      // Profile
      {
        path: "profile",
        element: withSuspense(<ProfilePage />),
      },

      // Workspace routes
      {
        path: ":workspace",
        children: [
          {
            index: true,
            element: withSuspense(<WorkspacePage />),
          },
          {
            path: "settings",
            element: withSuspense(<WorkspaceSettingsPage />),
          },
          {
            path: "members",
            element: withSuspense(<WorkspaceMembersPage />),
          },

          // Repository routes
          {
            path: ":repo",
            children: [
              // Redirect bare repo URL to source browser
              {
                index: true,
                element: <Navigate to="src" replace />,
              },

              // Source browser (supports nested file paths and ref)
              {
                path: "src",
                element: withSuspense(<RepoSourcePage />),
              },
              {
                path: "src/:ref/*",
                element: withSuspense(<RepoSourcePage />),
              },

              // Commits
              {
                path: "commits",
                element: withSuspense(<RepoCommitsPage />),
              },

              // Branches
              {
                path: "branches",
                element: withSuspense(<RepoBranchesPage />),
              },

              // Pull Requests
              {
                path: "pull-requests",
                element: withSuspense(<PRListPage />),
              },
              {
                path: "pull-requests/new",
                element: withSuspense(<PRCreatePage />),
              },
              {
                path: "pull-requests/:number",
                element: withSuspense(<PRDetailPage />),
              },

              // Issues
              {
                path: "issues",
                element: withSuspense(<IssueListPage />),
              },
              {
                path: "issues/new",
                element: withSuspense(<IssueCreatePage />),
              },
              {
                path: "issues/:number",
                element: withSuspense(<IssueDetailPage />),
              },

              // Pipelines
              {
                path: "pipelines",
                element: withSuspense(<PipelineListPage />),
              },
              {
                path: "pipelines/:number",
                element: withSuspense(<PipelineDetailPage />),
              },

              // Wiki
              {
                path: "wiki",
                element: withSuspense(<WikiPage />),
              },
              {
                path: "wiki/:slug",
                element: withSuspense(<WikiArticlePage />),
              },

              // Repository settings
              {
                path: "settings",
                element: withSuspense(<RepoSettingsPage />),
              },
            ],
          },
        ],
      },

      // 404 catch-all
      {
        path: "*",
        element: withSuspense(<NotFoundPage />),
      },
    ],
  },
]);
