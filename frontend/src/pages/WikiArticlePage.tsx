import { useParams, Link } from "react-router-dom";
import { ArrowLeft, BookOpen } from "lucide-react";

export default function WikiArticlePage() {
  const { workspace, repo, slug } = useParams<{
    workspace: string;
    repo: string;
    slug: string;
  }>();

  return (
    <div className="mx-auto max-w-4xl p-6">
      <Link
        to={`/${workspace}/${repo}/wiki`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to wiki
      </Link>
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-bb-600" />
        <h1 className="text-2xl font-semibold text-text-primary">{slug}</h1>
      </div>
      <p className="mt-2 text-sm text-text-secondary">
        {workspace}/{repo}
      </p>
    </div>
  );
}
