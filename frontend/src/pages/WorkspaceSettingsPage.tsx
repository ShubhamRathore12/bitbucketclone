import { useParams } from "react-router-dom";

export default function WorkspaceSettingsPage() {
  const { workspace } = useParams<{ workspace: string }>();

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold text-text-primary">Workspace Settings</h1>
      <p className="mt-2 text-text-secondary">
        Manage settings for <span className="font-medium">{workspace}</span>
      </p>
    </div>
  );
}
