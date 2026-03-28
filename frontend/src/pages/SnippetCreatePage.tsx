import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function SnippetCreatePage() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <Link
        to="/snippets"
        className="mb-4 inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to snippets
      </Link>
      <h1 className="text-2xl font-semibold text-text-primary">Create Snippet</h1>
    </div>
  );
}
