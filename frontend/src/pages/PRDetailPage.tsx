import { useParams, Link } from "react-router-dom";
import { ArrowLeft, GitPullRequest } from "lucide-react";

export default function PRDetailPage() {
  const { workspace, repo, number } = useParams<{
    workspace: string;
    repo: string;
    number: string;
  }>();

  return (
    <div className="mx-auto max-w-5xl p-6">
      <Link
        to={`/${workspace}/${repo}/pull-requests`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to pull requests
      </Link>
      <div className="flex items-center gap-3">
        <GitPullRequest className="h-6 w-6 text-bb-600" />
        <h1 className="text-2xl font-semibold text-text-primary">
          Pull Request #{number}
        </h1>
      </div>
      <p className="mt-2 text-sm text-text-secondary">
        {workspace}/{repo}
      </p>
    </div>
  );
}
