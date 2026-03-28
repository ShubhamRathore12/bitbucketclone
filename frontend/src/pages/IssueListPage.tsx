import { useParams, Link } from "react-router-dom";
import { CircleDot, Plus } from "lucide-react";

export default function IssueListPage() {
  const { workspace, repo } = useParams<{ workspace: string; repo: string }>();

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">Issues</h1>
        <Link
          to={`/${workspace}/${repo}/issues/new`}
          className="inline-flex items-center gap-2 rounded-md bg-bb-600 px-4 py-2 text-sm font-medium text-white hover:bg-bb-700"
        >
          <Plus className="h-4 w-4" />
          Create issue
        </Link>
      </div>
      <p className="mt-2 text-sm text-text-secondary">
        <CircleDot className="mr-1 inline h-4 w-4" />
        {workspace}/{repo}
      </p>
    </div>
  );
}
