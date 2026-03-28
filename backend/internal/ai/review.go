package ai

import (
	"fmt"
	"log"
	"strings"
	"sync"

	gitpkg "github.com/gitforge/backend/internal/git"
)

// FullReview aggregates all per-file review results into a single review report.
type FullReview struct {
	Summary      string        `json:"summary"`
	FileReviews  []FileReview  `json:"file_reviews"`
	OverallScore int           `json:"overall_score"` // 1-10 weighted average
	Severity     string        `json:"severity"`
	TotalFiles   int           `json:"total_files"`
	Additions    int           `json:"additions"`
	Deletions    int           `json:"deletions"`
	AllComments  []FileComment `json:"all_comments"`
}

// FileReview pairs a file path with its review result.
type FileReview struct {
	FilePath string        `json:"file_path"`
	Result   *ReviewResult `json:"result"`
	Error    string        `json:"error,omitempty"` // non-empty if review of this file failed
}

// fileResult is an internal type used to collect per-file review outcomes.
type fileResult struct {
	filePath string
	review   *ReviewResult
	err      error
}

// ReviewOrchestrator coordinates the review of a full pull-request diff by
// chunking it per file and sending each chunk to Claude in parallel.
type ReviewOrchestrator struct {
	client      *ClaudeClient
	concurrency int
}

// NewReviewOrchestrator creates a new orchestrator with the given Claude client.
// concurrency controls how many files are reviewed in parallel (0 = default 4).
func NewReviewOrchestrator(client *ClaudeClient, concurrency int) *ReviewOrchestrator {
	if concurrency <= 0 {
		concurrency = 4
	}
	return &ReviewOrchestrator{
		client:      client,
		concurrency: concurrency,
	}
}

// StartReview computes the diff between sourceBranch and destBranch in the
// given repository, sends each file's diff to Claude for review, and
// aggregates the results.
func (ro *ReviewOrchestrator) StartReview(repoPath, sourceBranch, destBranch, language string) (*FullReview, error) {
	// Compute structured diff.
	fileDiffs, err := gitpkg.ComputeDiff(repoPath, destBranch, sourceBranch)
	if err != nil {
		return nil, fmt.Errorf("compute diff: %w", err)
	}

	if len(fileDiffs) == 0 {
		return &FullReview{
			Summary:      "No changes detected between the branches.",
			OverallScore: 10,
			Severity:     SeverityInfo,
		}, nil
	}

	// Get the raw diff text for chunking into per-file segments.
	rawDiffs := reconstructRawDiff(fileDiffs)
	chunks := ChunkDiffByFile(rawDiffs)

	// Review each file concurrently with bounded parallelism.
	var (
		results []fileResult
		mu      sync.Mutex
		wg      sync.WaitGroup
	)
	sem := make(chan struct{}, ro.concurrency)

	for filePath, diff := range chunks {
		// Skip binary files.
		if isBinaryDiff(diff) {
			continue
		}

		wg.Add(1)
		go func(fp, d string) {
			defer wg.Done()
			sem <- struct{}{}        // acquire
			defer func() { <-sem }() // release

			// Split large diffs into sub-chunks and review each.
			subChunks := SplitLargeChunk(d)
			var merged *ReviewResult

			for i, chunk := range subChunks {
				ctx := ""
				if len(subChunks) > 1 {
					ctx = fmt.Sprintf("This is part %d of %d for file %s.", i+1, len(subChunks), fp)
				}

				r, reviewErr := ro.client.ReviewCode(chunk, language, ctx)
				if reviewErr != nil {
					mu.Lock()
					results = append(results, fileResult{filePath: fp, err: reviewErr})
					mu.Unlock()
					log.Printf("[ai] review failed for %s (chunk %d): %v", fp, i+1, reviewErr)
					return
				}

				merged = mergeResults(merged, r, fp)
			}

			mu.Lock()
			results = append(results, fileResult{filePath: fp, review: merged})
			mu.Unlock()
		}(filePath, diff)
	}

	wg.Wait()

	return aggregateReviews(results, fileDiffs), nil
}

// reconstructRawDiff rebuilds a raw unified diff string from structured
// FileDiff data so it can be chunked per file.
func reconstructRawDiff(fileDiffs []gitpkg.FileDiff) string {
	var sb strings.Builder
	for _, fd := range fileDiffs {
		sb.WriteString(fmt.Sprintf("diff --git a/%s b/%s\n", fd.OldPath, fd.NewPath))
		if fd.IsBinary {
			sb.WriteString("Binary files differ\n")
			continue
		}
		if fd.IsNew {
			sb.WriteString("new file\n")
		}
		if fd.IsDeleted {
			sb.WriteString("deleted file\n")
		}
		sb.WriteString(fmt.Sprintf("--- a/%s\n", fd.OldPath))
		sb.WriteString(fmt.Sprintf("+++ b/%s\n", fd.NewPath))
		for _, h := range fd.Hunks {
			sb.WriteString(h.Header)
			sb.WriteString("\n")
			for _, l := range h.Lines {
				switch l.Type {
				case gitpkg.DiffLineAdd:
					sb.WriteString("+" + l.Content + "\n")
				case gitpkg.DiffLineDelete:
					sb.WriteString("-" + l.Content + "\n")
				case gitpkg.DiffLineContext:
					sb.WriteString(" " + l.Content + "\n")
				}
			}
		}
	}
	return sb.String()
}

// isBinaryDiff checks if a diff chunk represents a binary file.
func isBinaryDiff(diff string) bool {
	return strings.Contains(diff, "Binary files") ||
		strings.Contains(diff, "GIT binary patch")
}

// mergeResults combines two ReviewResults into one, aggregating comments and
// averaging scores.
func mergeResults(existing, incoming *ReviewResult, filePath string) *ReviewResult {
	if existing == nil {
		for i := range incoming.FileComments {
			if incoming.FileComments[i].FilePath == "" {
				incoming.FileComments[i].FilePath = filePath
			}
		}
		return incoming
	}

	for i := range incoming.FileComments {
		if incoming.FileComments[i].FilePath == "" {
			incoming.FileComments[i].FilePath = filePath
		}
	}

	existing.FileComments = append(existing.FileComments, incoming.FileComments...)
	existing.Summary += " " + incoming.Summary
	existing.OverallScore = (existing.OverallScore + incoming.OverallScore) / 2
	existing.Severity = maxSeverity(existing.Severity, incoming.Severity)

	return existing
}

// aggregateReviews builds a FullReview from individual file review results.
func aggregateReviews(results []fileResult, fileDiffs []gitpkg.FileDiff) *FullReview {
	fr := &FullReview{
		TotalFiles: len(fileDiffs),
	}

	for _, fd := range fileDiffs {
		fr.Additions += fd.Additions
		fr.Deletions += fd.Deletions
	}

	var totalScore int
	var scoreCount int
	var summaries []string
	worstSeverity := SeverityInfo

	for _, r := range results {
		fileReview := FileReview{FilePath: r.filePath}
		if r.err != nil {
			fileReview.Error = r.err.Error()
		} else if r.review != nil {
			fileReview.Result = r.review
			totalScore += r.review.OverallScore
			scoreCount++
			summaries = append(summaries, r.review.Summary)
			worstSeverity = maxSeverity(worstSeverity, r.review.Severity)
			fr.AllComments = append(fr.AllComments, r.review.FileComments...)
		}
		fr.FileReviews = append(fr.FileReviews, fileReview)
	}

	if scoreCount > 0 {
		fr.OverallScore = totalScore / scoreCount
	} else {
		fr.OverallScore = 5
	}
	fr.Severity = worstSeverity

	if len(summaries) > 0 {
		fr.Summary = fmt.Sprintf(
			"Reviewed %d files (%d additions, %d deletions). %s",
			fr.TotalFiles, fr.Additions, fr.Deletions,
			strings.Join(summaries, " "),
		)
	} else {
		fr.Summary = fmt.Sprintf(
			"Reviewed %d files (%d additions, %d deletions). No actionable feedback.",
			fr.TotalFiles, fr.Additions, fr.Deletions,
		)
	}

	return fr
}

// maxSeverity returns the higher of two severity levels.
func maxSeverity(a, b string) string {
	order := map[string]int{
		SeverityInfo:    0,
		SeverityWarning: 1,
		SeverityError:   2,
	}
	if order[b] > order[a] {
		return b
	}
	return a
}
