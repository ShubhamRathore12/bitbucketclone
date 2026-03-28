package git

import (
	"bytes"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
)

// DiffLineType represents the type of a line in a unified diff.
type DiffLineType string

const (
	DiffLineAdd     DiffLineType = "add"
	DiffLineDelete  DiffLineType = "delete"
	DiffLineContext DiffLineType = "context"
)

// DiffLine holds a single line from a unified diff hunk.
type DiffLine struct {
	Type      DiffLineType `json:"type"`
	Content   string       `json:"content"`
	OldLineNo int          `json:"old_line_no,omitempty"` // 0 when not applicable (additions)
	NewLineNo int          `json:"new_line_no,omitempty"` // 0 when not applicable (deletions)
}

// DiffHunk represents one @@ hunk in a unified diff.
type DiffHunk struct {
	OldStart int        `json:"old_start"`
	OldLines int        `json:"old_lines"`
	NewStart int        `json:"new_start"`
	NewLines int        `json:"new_lines"`
	Header   string     `json:"header"` // the raw @@ line
	Lines    []DiffLine `json:"lines"`
}

// FileDiff describes the diff for a single file between two refs.
type FileDiff struct {
	OldPath   string     `json:"old_path"`
	NewPath   string     `json:"new_path"`
	Hunks     []DiffHunk `json:"hunks"`
	IsBinary  bool       `json:"is_binary"`
	IsNew     bool       `json:"is_new"`
	IsDeleted bool       `json:"is_deleted"`
	IsRenamed bool       `json:"is_renamed"`
	Additions int        `json:"additions"`
	Deletions int        `json:"deletions"`
}

// ComputeDiff runs `git diff` between two refs in the given repository and
// returns the structured diff output.
func ComputeDiff(repoPath, fromRef, toRef string) ([]FileDiff, error) {
	cmd := exec.Command(
		"git", "-C", repoPath,
		"diff", "--no-color", "--find-renames", "--unified=3",
		fromRef, toRef,
	)

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("git diff failed: %w: %s", err, stderr.String())
	}

	return ParseUnifiedDiff(stdout.String()), nil
}

// ComputeDiffStat returns a short stat summary (files changed, insertions,
// deletions) for the diff between two refs.
func ComputeDiffStat(repoPath, fromRef, toRef string) (string, error) {
	cmd := exec.Command(
		"git", "-C", repoPath,
		"diff", "--stat", "--find-renames",
		fromRef, toRef,
	)

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("git diff --stat failed: %w: %s", err, stderr.String())
	}
	return stdout.String(), nil
}

// ParseUnifiedDiff parses the raw output of `git diff` into structured
// FileDiff records. It handles binary diffs, new/deleted files, renames,
// and multi-hunk diffs.
func ParseUnifiedDiff(diffOutput string) []FileDiff {
	var files []FileDiff
	lines := strings.Split(diffOutput, "\n")

	i := 0
	for i < len(lines) {
		line := lines[i]

		// Each file diff starts with "diff --git a/... b/..."
		if !strings.HasPrefix(line, "diff --git ") {
			i++
			continue
		}

		fd := FileDiff{}

		// Parse the a/ and b/ paths from the diff header.
		parts := parseDiffHeader(line)
		fd.OldPath = parts[0]
		fd.NewPath = parts[1]
		i++

		// Consume extended header lines (index, old mode, new mode, etc.)
		for i < len(lines) {
			l := lines[i]
			if strings.HasPrefix(l, "new file mode") {
				fd.IsNew = true
				i++
			} else if strings.HasPrefix(l, "deleted file mode") {
				fd.IsDeleted = true
				i++
			} else if strings.HasPrefix(l, "rename from ") {
				fd.OldPath = strings.TrimPrefix(l, "rename from ")
				fd.IsRenamed = true
				i++
			} else if strings.HasPrefix(l, "rename to ") {
				fd.NewPath = strings.TrimPrefix(l, "rename to ")
				fd.IsRenamed = true
				i++
			} else if strings.HasPrefix(l, "similarity index") ||
				strings.HasPrefix(l, "dissimilarity index") ||
				strings.HasPrefix(l, "index ") ||
				strings.HasPrefix(l, "old mode") ||
				strings.HasPrefix(l, "new mode") {
				i++
			} else if strings.HasPrefix(l, "Binary files") {
				fd.IsBinary = true
				i++
				break
			} else if strings.HasPrefix(l, "--- ") {
				// Start of unified diff content.
				break
			} else if strings.HasPrefix(l, "diff --git ") {
				// Next file, no content for this one (e.g. empty file or mode-only change).
				break
			} else {
				i++
			}
		}

		if fd.IsBinary {
			files = append(files, fd)
			continue
		}

		// Skip --- and +++ lines.
		if i < len(lines) && strings.HasPrefix(lines[i], "--- ") {
			i++
		}
		if i < len(lines) && strings.HasPrefix(lines[i], "+++ ") {
			i++
		}

		// Parse hunks.
		for i < len(lines) {
			l := lines[i]
			if strings.HasPrefix(l, "diff --git ") {
				break
			}
			if !strings.HasPrefix(l, "@@ ") {
				i++
				continue
			}

			hunk, nextI := parseHunk(lines, i)
			fd.Hunks = append(fd.Hunks, hunk)
			i = nextI
		}

		// Count additions and deletions.
		for _, h := range fd.Hunks {
			for _, dl := range h.Lines {
				switch dl.Type {
				case DiffLineAdd:
					fd.Additions++
				case DiffLineDelete:
					fd.Deletions++
				}
			}
		}

		files = append(files, fd)
	}

	return files
}

// parseDiffHeader extracts old and new paths from a "diff --git a/X b/Y" line.
func parseDiffHeader(line string) [2]string {
	// "diff --git a/path b/path"
	line = strings.TrimPrefix(line, "diff --git ")

	// The tricky part: paths may contain spaces. We use the fact that old
	// path starts with "a/" and new path starts with "b/".
	// Find the " b/" separator, trying from the middle outwards.
	idx := strings.Index(line, " b/")
	if idx == -1 {
		// Fallback: split on space.
		parts := strings.SplitN(line, " ", 2)
		old := strings.TrimPrefix(parts[0], "a/")
		newP := ""
		if len(parts) > 1 {
			newP = strings.TrimPrefix(parts[1], "b/")
		}
		return [2]string{old, newP}
	}

	old := strings.TrimPrefix(line[:idx], "a/")
	newP := strings.TrimPrefix(line[idx+1:], "b/")
	return [2]string{old, newP}
}

// parseHunk parses a single @@ hunk starting at line index i and returns the
// parsed hunk plus the index of the next line after the hunk.
func parseHunk(lines []string, i int) (DiffHunk, int) {
	hunk := DiffHunk{Header: lines[i]}

	// Parse "@@ -oldStart,oldLines +newStart,newLines @@"
	header := lines[i]
	atParts := strings.SplitN(header, "@@", 3)
	if len(atParts) >= 2 {
		rangePart := strings.TrimSpace(atParts[1])
		ranges := strings.Fields(rangePart)
		if len(ranges) >= 2 {
			hunk.OldStart, hunk.OldLines = parseRange(ranges[0])
			hunk.NewStart, hunk.NewLines = parseRange(ranges[1])
		}
	}

	i++
	oldLine := hunk.OldStart
	newLine := hunk.NewStart

	for i < len(lines) {
		l := lines[i]

		// Stop at next hunk or next file.
		if strings.HasPrefix(l, "diff --git ") || strings.HasPrefix(l, "@@ ") {
			break
		}

		if strings.HasPrefix(l, "+") {
			hunk.Lines = append(hunk.Lines, DiffLine{
				Type:      DiffLineAdd,
				Content:   strings.TrimPrefix(l, "+"),
				NewLineNo: newLine,
			})
			newLine++
		} else if strings.HasPrefix(l, "-") {
			hunk.Lines = append(hunk.Lines, DiffLine{
				Type:      DiffLineDelete,
				Content:   strings.TrimPrefix(l, "-"),
				OldLineNo: oldLine,
			})
			oldLine++
		} else if strings.HasPrefix(l, `\`) {
			// "\ No newline at end of file" -- skip
			i++
			continue
		} else {
			// Context line (starts with space or is empty).
			content := l
			if len(content) > 0 && content[0] == ' ' {
				content = content[1:]
			}
			hunk.Lines = append(hunk.Lines, DiffLine{
				Type:      DiffLineContext,
				Content:   content,
				OldLineNo: oldLine,
				NewLineNo: newLine,
			})
			oldLine++
			newLine++
		}
		i++
	}

	return hunk, i
}

// parseRange parses a "-N,M" or "+N,M" range string from a hunk header.
func parseRange(s string) (start, count int) {
	s = strings.TrimLeft(s, "+-")
	parts := strings.SplitN(s, ",", 2)
	start, _ = strconv.Atoi(parts[0])
	if len(parts) == 2 {
		count, _ = strconv.Atoi(parts[1])
	} else {
		count = 1
	}
	return
}
