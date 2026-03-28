import type { DiffFile, DiffHunk, DiffLine, DiffFileStatus } from "@/types/pr";

/**
 * Parse a unified diff string into structured DiffFile objects.
 * Handles standard unified diff format as produced by `git diff`.
 */
export function parseDiff(diffText: string): DiffFile[] {
  const files: DiffFile[] = [];
  const rawFiles = splitIntoFiles(diffText);

  for (const rawFile of rawFiles) {
    const file = parseFile(rawFile);
    if (file) {
      files.push(file);
    }
  }

  return files;
}

/**
 * Split a multi-file diff into individual file diffs.
 */
function splitIntoFiles(diffText: string): string[] {
  const files: string[] = [];
  const lines = diffText.split("\n");
  let current: string[] = [];

  for (const line of lines) {
    if (line.startsWith("diff --git") && current.length > 0) {
      files.push(current.join("\n"));
      current = [];
    }
    current.push(line);
  }

  if (current.length > 0) {
    files.push(current.join("\n"));
  }

  return files;
}

/**
 * Parse a single file diff section into a DiffFile.
 */
function parseFile(rawDiff: string): DiffFile | null {
  const lines = rawDiff.split("\n");

  // Parse the "diff --git a/path b/path" header
  const diffHeader = lines[0];
  if (!diffHeader?.startsWith("diff --git")) return null;

  let oldPath = "";
  let newPath = "";
  let oldHash = "";
  let newHash = "";
  let isBinary = false;
  let status: DiffFileStatus = "modified";
  const hunks: DiffHunk[] = [];

  let i = 1;

  // Parse meta headers
  while (i < lines.length && !lines[i]?.startsWith("@@") && !lines[i]?.startsWith("Binary")) {
    const line = lines[i]!;

    if (line.startsWith("old mode") || line.startsWith("new mode")) {
      // mode change, skip
    } else if (line.startsWith("new file mode")) {
      status = "added";
    } else if (line.startsWith("deleted file mode")) {
      status = "deleted";
    } else if (line.startsWith("similarity index")) {
      // rename or copy
    } else if (line.startsWith("rename from ")) {
      oldPath = line.slice("rename from ".length);
      status = "renamed";
    } else if (line.startsWith("rename to ")) {
      newPath = line.slice("rename to ".length);
    } else if (line.startsWith("copy from ")) {
      oldPath = line.slice("copy from ".length);
      status = "copied";
    } else if (line.startsWith("copy to ")) {
      newPath = line.slice("copy to ".length);
    } else if (line.startsWith("index ")) {
      const indexMatch = line.match(/^index ([0-9a-f]+)\.\.([0-9a-f]+)/);
      if (indexMatch) {
        oldHash = indexMatch[1]!;
        newHash = indexMatch[2]!;
      }
    } else if (line.startsWith("--- ")) {
      const path = line.slice(4);
      if (path === "/dev/null") {
        status = status === "modified" ? "added" : status;
      } else {
        oldPath = oldPath || stripPrefix(path);
      }
    } else if (line.startsWith("+++ ")) {
      const path = line.slice(4);
      if (path === "/dev/null") {
        status = status === "modified" ? "deleted" : status;
      } else {
        newPath = newPath || stripPrefix(path);
      }
    } else if (line.startsWith("Binary files")) {
      isBinary = true;
    }

    i++;
  }

  // Fallback: extract paths from the diff header
  if (!oldPath && !newPath) {
    const pathMatch = diffHeader.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (pathMatch) {
      oldPath = pathMatch[1]!;
      newPath = pathMatch[2]!;
    }
  }

  if (!oldPath) oldPath = newPath;
  if (!newPath) newPath = oldPath;

  // Parse hunks
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.startsWith("@@")) {
      const hunk = parseHunk(lines, i);
      if (hunk) {
        hunks.push(hunk.hunk);
        i = hunk.nextIndex;
        continue;
      }
    }
    i++;
  }

  // Calculate stats
  let additions = 0;
  let deletions = 0;
  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.type === "addition") additions++;
      else if (line.type === "deletion") deletions++;
    }
  }

  return {
    oldPath,
    newPath,
    status,
    isBinary,
    oldHash,
    newHash,
    hunks,
    stats: { additions, deletions },
  };
}

/**
 * Parse a single hunk starting at the @@ line.
 */
function parseHunk(
  lines: string[],
  startIdx: number,
): { hunk: DiffHunk; nextIndex: number } | null {
  const headerLine = lines[startIdx]!;
  const hunkMatch = headerLine.match(
    /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/,
  );
  if (!hunkMatch) return null;

  const oldStart = parseInt(hunkMatch[1]!, 10);
  const oldLines = hunkMatch[2] !== undefined ? parseInt(hunkMatch[2], 10) : 1;
  const newStart = parseInt(hunkMatch[3]!, 10);
  const newLines = hunkMatch[4] !== undefined ? parseInt(hunkMatch[4], 10) : 1;
  const header = hunkMatch[5]?.trim() ?? "";

  const diffLines: DiffLine[] = [];
  let oldLineNum = oldStart;
  let newLineNum = newStart;
  let i = startIdx + 1;

  while (i < lines.length) {
    const line = lines[i]!;

    // Stop at next hunk or next file
    if (line.startsWith("@@") || line.startsWith("diff --git")) {
      break;
    }

    if (line.startsWith("+")) {
      diffLines.push({
        type: "addition",
        content: line.slice(1),
        newLineNumber: newLineNum,
      });
      newLineNum++;
    } else if (line.startsWith("-")) {
      diffLines.push({
        type: "deletion",
        content: line.slice(1),
        oldLineNumber: oldLineNum,
      });
      oldLineNum++;
    } else if (line.startsWith(" ") || line === "") {
      diffLines.push({
        type: "context",
        content: line.startsWith(" ") ? line.slice(1) : line,
        oldLineNumber: oldLineNum,
        newLineNumber: newLineNum,
      });
      oldLineNum++;
      newLineNum++;
    } else if (line.startsWith("\\")) {
      // "\ No newline at end of file" -- skip
    } else {
      // Unknown line, treat as context
      diffLines.push({
        type: "context",
        content: line,
        oldLineNumber: oldLineNum,
        newLineNumber: newLineNum,
      });
      oldLineNum++;
      newLineNum++;
    }

    i++;
  }

  return {
    hunk: {
      oldStart,
      oldLines,
      newStart,
      newLines,
      header,
      lines: diffLines,
    },
    nextIndex: i,
  };
}

/**
 * Strip the a/ or b/ prefix from diff paths.
 */
function stripPrefix(path: string): string {
  if (path.startsWith("a/") || path.startsWith("b/")) {
    return path.slice(2);
  }
  return path;
}

/**
 * Compute side-by-side diff view from a list of hunks.
 * Returns paired lines for left (old) and right (new) columns.
 */
export interface SideBySideLine {
  left?: { lineNumber: number; content: string; type: "context" | "deletion" };
  right?: { lineNumber: number; content: string; type: "context" | "addition" };
}

export function toSideBySide(hunks: DiffHunk[]): SideBySideLine[] {
  const result: SideBySideLine[] = [];

  for (const hunk of hunks) {
    let i = 0;
    while (i < hunk.lines.length) {
      const line = hunk.lines[i]!;

      if (line.type === "context") {
        result.push({
          left: { lineNumber: line.oldLineNumber!, content: line.content, type: "context" },
          right: { lineNumber: line.newLineNumber!, content: line.content, type: "context" },
        });
        i++;
      } else if (line.type === "deletion") {
        // Collect consecutive deletions and additions to pair them
        const deletions: DiffLine[] = [];
        while (i < hunk.lines.length && hunk.lines[i]!.type === "deletion") {
          deletions.push(hunk.lines[i]!);
          i++;
        }
        const additions: DiffLine[] = [];
        while (i < hunk.lines.length && hunk.lines[i]!.type === "addition") {
          additions.push(hunk.lines[i]!);
          i++;
        }

        const maxLen = Math.max(deletions.length, additions.length);
        for (let j = 0; j < maxLen; j++) {
          const del = deletions[j];
          const add = additions[j];
          result.push({
            left: del
              ? { lineNumber: del.oldLineNumber!, content: del.content, type: "deletion" }
              : undefined,
            right: add
              ? { lineNumber: add.newLineNumber!, content: add.content, type: "addition" }
              : undefined,
          });
        }
      } else if (line.type === "addition") {
        result.push({
          right: { lineNumber: line.newLineNumber!, content: line.content, type: "addition" },
        });
        i++;
      } else {
        i++;
      }
    }
  }

  return result;
}
