import { useParams } from "react-router-dom";
import { Workflow } from "lucide-react";

export default function PipelineListPage() {
  const { workspace, repo } = useParams<{ workspace: string; repo: string }>();

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold text-text-primary">Pipelines</h1>
      <p className="mt-2 text-sm text-text-secondary">
        <Workflow className="mr-1 inline h-4 w-4" />
        {workspace}/{repo}
      </p>
    </div>
  );
}
