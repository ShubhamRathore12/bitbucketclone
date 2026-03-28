import { useParams } from "react-router-dom";

export default function WorkspaceMembersPage() {
  const { workspace } = useParams<{ workspace: string }>();

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold text-text-primary">Members</h1>
      <p className="mt-2 text-text-secondary">
        Manage members of <span className="font-medium">{workspace}</span>
      </p>
    </div>
  );
}
