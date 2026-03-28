import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function IssueCreatePage() {
  const { workspace, repo } = useParams<{ workspace: string; repo: string }>();

  return (
    <div className="mx-auto max-w-4xl p-6">
      <Link
        to={`/${workspace}/${repo}/issues`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to issues
      </Link>
      <h1 className="text-2xl font-semibold text-text-primary">Create Issue</h1>
      <p className="mt-2 text-sm text-text-secondary">
        {workspace}/{repo}
      </p>
    </div>
  );
}
