package git

import (
	"fmt"
	"os"
	"path/filepath"
)

const preReceiveScript = `#!/bin/sh
#
# pre-receive hook installed by GitForge.
# Validates branch restrictions before allowing a push.
#

# GitForge API endpoint for pre-receive validation.
GITFORGE_API="${GITFORGE_API_URL:-http://localhost:3000}"
REPO_PATH="$(pwd)"

# Read each ref update from stdin.
while read oldrev newrev refname; do
    # Skip zero-oid (delete) operations unless restricted.
    zero="0000000000000000000000000000000000000000"

    branch=$(echo "$refname" | sed 's|refs/heads/||')

    # --- Branch deletion protection ---
    if [ "$newrev" = "$zero" ]; then
        # Check if branch is protected by calling the API.
        response=$(curl -sf "${GITFORGE_API}/internal/hooks/pre-receive" \
            -H "Content-Type: application/json" \
            -d "{\"repo_path\": \"${REPO_PATH}\", \"old_rev\": \"${oldrev}\", \"new_rev\": \"${newrev}\", \"ref_name\": \"${refname}\", \"action\": \"delete\"}" \
            2>/dev/null)

        if [ $? -ne 0 ]; then
            echo "*** [GitForge] Deletion of branch '${branch}' is not allowed." >&2
            exit 1
        fi
    fi

    # --- Force-push protection on protected branches ---
    if [ "$oldrev" != "$zero" ] && [ "$newrev" != "$zero" ]; then
        merge_base=$(git merge-base "$oldrev" "$newrev" 2>/dev/null)
        if [ "$merge_base" != "$oldrev" ]; then
            # This is a force push (non-fast-forward).
            response=$(curl -sf "${GITFORGE_API}/internal/hooks/pre-receive" \
                -H "Content-Type: application/json" \
                -d "{\"repo_path\": \"${REPO_PATH}\", \"old_rev\": \"${oldrev}\", \"new_rev\": \"${newrev}\", \"ref_name\": \"${refname}\", \"action\": \"force-push\"}" \
                2>/dev/null)

            if [ $? -ne 0 ]; then
                echo "*** [GitForge] Force-push to branch '${branch}' is not allowed." >&2
                exit 1
            fi
        fi
    fi

    # --- General push validation ---
    response=$(curl -sf "${GITFORGE_API}/internal/hooks/pre-receive" \
        -H "Content-Type: application/json" \
        -d "{\"repo_path\": \"${REPO_PATH}\", \"old_rev\": \"${oldrev}\", \"new_rev\": \"${newrev}\", \"ref_name\": \"${refname}\", \"action\": \"push\"}" \
        2>/dev/null)

    if [ $? -ne 0 ]; then
        echo "*** [GitForge] Push rejected by server policy." >&2
        exit 1
    fi
done

exit 0
`

const postReceiveScript = `#!/bin/sh
#
# post-receive hook installed by GitForge.
# Triggers pipeline execution, webhook delivery, and activity logging.
#

GITFORGE_API="${GITFORGE_API_URL:-http://localhost:3000}"
REPO_PATH="$(pwd)"

# Collect all ref updates.
refs=""
while read oldrev newrev refname; do
    if [ -z "$refs" ]; then
        refs="{\"old_rev\": \"${oldrev}\", \"new_rev\": \"${newrev}\", \"ref_name\": \"${refname}\"}"
    else
        refs="${refs}, {\"old_rev\": \"${oldrev}\", \"new_rev\": \"${newrev}\", \"ref_name\": \"${refname}\"}"
    fi
done

payload="{\"repo_path\": \"${REPO_PATH}\", \"refs\": [${refs}]}"

# Fire-and-forget: trigger pipeline execution.
curl -sf "${GITFORGE_API}/internal/hooks/post-receive/pipeline" \
    -H "Content-Type: application/json" \
    -d "${payload}" \
    >/dev/null 2>&1 &

# Fire-and-forget: dispatch webhooks.
curl -sf "${GITFORGE_API}/internal/hooks/post-receive/webhook" \
    -H "Content-Type: application/json" \
    -d "${payload}" \
    >/dev/null 2>&1 &

# Fire-and-forget: record activity / update branch heads.
curl -sf "${GITFORGE_API}/internal/hooks/post-receive/activity" \
    -H "Content-Type: application/json" \
    -d "${payload}" \
    >/dev/null 2>&1 &

# Wait for background curl processes to start (not finish).
wait
exit 0
`

const updateScript = `#!/bin/sh
#
# update hook installed by GitForge.
# Runs per-ref validation (e.g. commit-message checks, signed-commit enforcement).
#

GITFORGE_API="${GITFORGE_API_URL:-http://localhost:3000}"
REPO_PATH="$(pwd)"

refname="$1"
oldrev="$2"
newrev="$3"

response=$(curl -sf "${GITFORGE_API}/internal/hooks/update" \
    -H "Content-Type: application/json" \
    -d "{\"repo_path\": \"${REPO_PATH}\", \"old_rev\": \"${oldrev}\", \"new_rev\": \"${newrev}\", \"ref_name\": \"${refname}\"}" \
    2>/dev/null)

if [ $? -ne 0 ]; then
    echo "*** [GitForge] Update rejected for ref '${refname}'." >&2
    exit 1
fi

exit 0
`

// InstallHooks writes the pre-receive, post-receive, and update hook scripts
// into the hooks directory of the given bare repository.
func InstallHooks(repoPath string) error {
	hooksDir := filepath.Join(repoPath, "hooks")

	if err := os.MkdirAll(hooksDir, 0o755); err != nil {
		return fmt.Errorf("create hooks directory: %w", err)
	}

	hooks := map[string]string{
		"pre-receive":  preReceiveScript,
		"post-receive": postReceiveScript,
		"update":       updateScript,
	}

	for name, content := range hooks {
		hookPath := filepath.Join(hooksDir, name)
		if err := os.WriteFile(hookPath, []byte(content), 0o755); err != nil {
			return fmt.Errorf("write %s hook: %w", name, err)
		}
	}

	return nil
}

// RemoveHooks removes all GitForge-installed hooks from the repository.
func RemoveHooks(repoPath string) error {
	hooksDir := filepath.Join(repoPath, "hooks")
	hookNames := []string{"pre-receive", "post-receive", "update"}

	for _, name := range hookNames {
		hookPath := filepath.Join(hooksDir, name)
		if err := os.Remove(hookPath); err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("remove %s hook: %w", name, err)
		}
	}

	return nil
}
