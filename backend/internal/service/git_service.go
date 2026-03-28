package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
)

// ──────────────────────────────────────────────
// DTOs
// ──────────────────────────────────────────────

// BranchDetail carries branch metadata returned by the git layer.
type BranchDetail struct {
	Name       string    `json:"name"`
	CommitSHA  string    `json:"commit_sha"`
	CommitMsg  string    `json:"commit_message"`
	AuthorName string    `json:"author_name"`
	AuthorDate time.Time `json:"author_date"`
}

// CommitInfo carries information about a single commit.
type CommitInfo struct {
	SHA            string       `json:"sha"`
	Message        string       `json:"message"`
	AuthorName     string       `json:"author_name"`
	AuthorEmail    string       `json:"author_email"`
	AuthorDate     time.Time    `json:"author_date"`
	CommitterName  string       `json:"committer_name"`
	CommitterEmail string       `json:"committer_email"`
	CommitDate     time.Time    `json:"commit_date"`
	ParentSHAs     []string     `json:"parent_shas,omitempty"`
	Stats          []FileStat   `json:"stats,omitempty"`
}

// FileStat represents the change statistics for a single file.
type FileStat struct {
	Name      string `json:"name"`
	Additions int    `json:"additions"`
	Deletions int    `json:"deletions"`
}

// TreeEntry represents a single entry in a directory listing.
type TreeEntry struct {
	Name string `json:"name"`
	Path string `json:"path"`
	Type string `json:"type"` // "blob" or "tree"
	Size int64  `json:"size,omitempty"`
	SHA  string `json:"sha"`
}

// FileContent carries the content of a file at a specific ref.
type FileContent struct {
	Path    string `json:"path"`
	Size    int64  `json:"size"`
	Content string `json:"content"`
	SHA     string `json:"sha"`
}

// DiffResult holds a unified diff output.
type DiffResult struct {
	Diff  string `json:"diff"`
	Stats []FileStat `json:"stats,omitempty"`
}

// ──────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────

// GitService provides low-level git operations on bare repositories.
type GitService struct {
	logger *slog.Logger
}

// NewGitService constructs a GitService.
func NewGitService(logger *slog.Logger) *GitService {
	return &GitService{logger: logger.With("service", "git")}
}

// InitRepository creates a new bare git repository at diskPath.
func (s *GitService) InitRepository(_ context.Context, diskPath string) error {
	if err := os.MkdirAll(filepath.Dir(diskPath), 0o755); err != nil {
		return fmt.Errorf("git: mkdir: %w", err)
	}

	_, err := git.PlainInit(diskPath, true)
	if err != nil {
		return fmt.Errorf("git: init bare repo at %s: %w", diskPath, err)
	}

	s.logger.Info("repository initialised", "path", diskPath)
	return nil
}

// DeleteRepository removes the repository directory from disk.
func (s *GitService) DeleteRepository(_ context.Context, diskPath string) error {
	if err := os.RemoveAll(diskPath); err != nil {
		return fmt.Errorf("git: delete repo at %s: %w", diskPath, err)
	}
	s.logger.Info("repository deleted", "path", diskPath)
	return nil
}

// ListBranches returns all branches with their latest commit metadata.
func (s *GitService) ListBranches(_ context.Context, diskPath string) ([]BranchDetail, error) {
	repo, err := git.PlainOpen(diskPath)
	if err != nil {
		return nil, fmt.Errorf("git: open repo: %w", err)
	}

	iter, err := repo.Branches()
	if err != nil {
		return nil, fmt.Errorf("git: list branches: %w", err)
	}

	var branches []BranchDetail
	err = iter.ForEach(func(ref *plumbing.Reference) error {
		bd := BranchDetail{
			Name:      ref.Name().Short(),
			CommitSHA: ref.Hash().String(),
		}
		if commit, cErr := repo.CommitObject(ref.Hash()); cErr == nil {
			bd.CommitMsg = firstLine(commit.Message)
			bd.AuthorName = commit.Author.Name
			bd.AuthorDate = commit.Author.When
		}
		branches = append(branches, bd)
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("git: iterate branches: %w", err)
	}

	sort.Slice(branches, func(i, j int) bool {
		return branches[i].AuthorDate.After(branches[j].AuthorDate)
	})

	return branches, nil
}

// GetBranch returns details for a single branch.
func (s *GitService) GetBranch(_ context.Context, diskPath, name string) (*BranchDetail, error) {
	repo, err := git.PlainOpen(diskPath)
	if err != nil {
		return nil, fmt.Errorf("git: open repo: %w", err)
	}

	refName := plumbing.NewBranchReferenceName(name)
	ref, err := repo.Reference(refName, true)
	if err != nil {
		return nil, fmt.Errorf("git: %w: branch %q", ErrNotFound, name)
	}

	bd := &BranchDetail{
		Name:      ref.Name().Short(),
		CommitSHA: ref.Hash().String(),
	}
	if commit, cErr := repo.CommitObject(ref.Hash()); cErr == nil {
		bd.CommitMsg = firstLine(commit.Message)
		bd.AuthorName = commit.Author.Name
		bd.AuthorDate = commit.Author.When
	}

	return bd, nil
}

// CreateBranch creates a new branch pointing at fromRef.
func (s *GitService) CreateBranch(_ context.Context, diskPath, name, fromRef string) error {
	repo, err := git.PlainOpen(diskPath)
	if err != nil {
		return fmt.Errorf("git: open repo: %w", err)
	}

	hash, err := repo.ResolveRevision(plumbing.Revision(fromRef))
	if err != nil {
		return fmt.Errorf("git: resolve ref %q: %w", fromRef, err)
	}

	refName := plumbing.NewBranchReferenceName(name)
	ref := plumbing.NewHashReference(refName, *hash)
	if err := repo.Storer.SetReference(ref); err != nil {
		return fmt.Errorf("git: create branch %q: %w", name, err)
	}

	s.logger.Info("branch created", "branch", name, "from", fromRef, "path", diskPath)
	return nil
}

// DeleteBranch removes a branch reference.
func (s *GitService) DeleteBranch(_ context.Context, diskPath, name string) error {
	repo, err := git.PlainOpen(diskPath)
	if err != nil {
		return fmt.Errorf("git: open repo: %w", err)
	}

	refName := plumbing.NewBranchReferenceName(name)
	if err := repo.Storer.RemoveReference(refName); err != nil {
		return fmt.Errorf("git: delete branch %q: %w", name, err)
	}

	s.logger.Info("branch deleted", "branch", name, "path", diskPath)
	return nil
}

// ListCommits returns a paginated commit log for the given branch.
func (s *GitService) ListCommits(_ context.Context, diskPath, branch string, page, limit int) ([]CommitInfo, int, error) {
	repo, err := git.PlainOpen(diskPath)
	if err != nil {
		return nil, 0, fmt.Errorf("git: open repo: %w", err)
	}

	hash, err := repo.ResolveRevision(plumbing.Revision(branch))
	if err != nil {
		return nil, 0, fmt.Errorf("git: resolve ref %q: %w", branch, err)
	}

	iter, err := repo.Log(&git.LogOptions{From: *hash})
	if err != nil {
		return nil, 0, fmt.Errorf("git: log: %w", err)
	}
	defer iter.Close()

	skip := (page - 1) * limit
	var commits []CommitInfo
	total := 0

	err = iter.ForEach(func(c *object.Commit) error {
		total++
		if total <= skip || len(commits) >= limit {
			return nil
		}
		commits = append(commits, commitToInfo(c, false))
		return nil
	})
	if err != nil {
		return nil, 0, fmt.Errorf("git: iterate commits: %w", err)
	}

	return commits, total, nil
}

// GetCommit returns a single commit with file-level stats.
func (s *GitService) GetCommit(_ context.Context, diskPath, sha string) (*CommitInfo, error) {
	repo, err := git.PlainOpen(diskPath)
	if err != nil {
		return nil, fmt.Errorf("git: open repo: %w", err)
	}

	hash := plumbing.NewHash(sha)
	commit, err := repo.CommitObject(hash)
	if err != nil {
		return nil, fmt.Errorf("git: %w: commit %q", ErrNotFound, sha)
	}

	info := commitToInfo(commit, true)
	return &info, nil
}

// GetTree lists directory contents at the given ref and path.
func (s *GitService) GetTree(_ context.Context, diskPath, ref, path string) ([]TreeEntry, error) {
	repo, err := git.PlainOpen(diskPath)
	if err != nil {
		return nil, fmt.Errorf("git: open repo: %w", err)
	}

	hash, err := repo.ResolveRevision(plumbing.Revision(ref))
	if err != nil {
		return nil, fmt.Errorf("git: resolve ref %q: %w", ref, err)
	}

	commit, err := repo.CommitObject(*hash)
	if err != nil {
		return nil, fmt.Errorf("git: get commit: %w", err)
	}

	tree, err := commit.Tree()
	if err != nil {
		return nil, fmt.Errorf("git: get tree: %w", err)
	}

	// Navigate to sub-path if specified.
	if path != "" && path != "." && path != "/" {
		path = strings.TrimPrefix(path, "/")
		tree, err = tree.Tree(path)
		if err != nil {
			return nil, fmt.Errorf("git: %w: path %q", ErrNotFound, path)
		}
	}

	entries := make([]TreeEntry, 0, len(tree.Entries))
	for _, e := range tree.Entries {
		entryPath := e.Name
		if path != "" && path != "." && path != "/" {
			entryPath = path + "/" + e.Name
		}
		te := TreeEntry{
			Name: e.Name,
			Path: entryPath,
			SHA:  e.Hash.String(),
		}
		if e.Mode.IsFile() {
			te.Type = "blob"
			if blob, bErr := repo.BlobObject(e.Hash); bErr == nil {
				te.Size = blob.Size
			}
		} else {
			te.Type = "tree"
		}
		entries = append(entries, te)
	}

	// Sort: directories first, then alphabetical.
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Type != entries[j].Type {
			return entries[i].Type == "tree"
		}
		return entries[i].Name < entries[j].Name
	})

	return entries, nil
}

// GetFileContent reads the content of a file at the given ref and path.
func (s *GitService) GetFileContent(_ context.Context, diskPath, ref, path string) (*FileContent, error) {
	repo, err := git.PlainOpen(diskPath)
	if err != nil {
		return nil, fmt.Errorf("git: open repo: %w", err)
	}

	hash, err := repo.ResolveRevision(plumbing.Revision(ref))
	if err != nil {
		return nil, fmt.Errorf("git: resolve ref %q: %w", ref, err)
	}

	commit, err := repo.CommitObject(*hash)
	if err != nil {
		return nil, fmt.Errorf("git: get commit: %w", err)
	}

	file, err := commit.File(strings.TrimPrefix(path, "/"))
	if err != nil {
		return nil, fmt.Errorf("git: %w: file %q", ErrNotFound, path)
	}

	reader, err := file.Reader()
	if err != nil {
		return nil, fmt.Errorf("git: read file: %w", err)
	}
	defer reader.Close()

	var buf bytes.Buffer
	if _, err := io.Copy(&buf, io.LimitReader(reader, 10*1024*1024)); err != nil {
		return nil, fmt.Errorf("git: read file content: %w", err)
	}

	return &FileContent{
		Path:    path,
		Size:    file.Size,
		Content: buf.String(),
		SHA:     file.Hash.String(),
	}, nil
}

// GetDiff computes a unified diff between two refs.
func (s *GitService) GetDiff(_ context.Context, diskPath, fromRef, toRef string) (*DiffResult, error) {
	repo, err := git.PlainOpen(diskPath)
	if err != nil {
		return nil, fmt.Errorf("git: open repo: %w", err)
	}

	fromHash, err := repo.ResolveRevision(plumbing.Revision(fromRef))
	if err != nil {
		return nil, fmt.Errorf("git: resolve from-ref %q: %w", fromRef, err)
	}
	toHash, err := repo.ResolveRevision(plumbing.Revision(toRef))
	if err != nil {
		return nil, fmt.Errorf("git: resolve to-ref %q: %w", toRef, err)
	}

	fromCommit, err := repo.CommitObject(*fromHash)
	if err != nil {
		return nil, fmt.Errorf("git: get from commit: %w", err)
	}
	toCommit, err := repo.CommitObject(*toHash)
	if err != nil {
		return nil, fmt.Errorf("git: get to commit: %w", err)
	}

	fromTree, err := fromCommit.Tree()
	if err != nil {
		return nil, fmt.Errorf("git: get from tree: %w", err)
	}
	toTree, err := toCommit.Tree()
	if err != nil {
		return nil, fmt.Errorf("git: get to tree: %w", err)
	}

	changes, err := fromTree.Diff(toTree)
	if err != nil {
		return nil, fmt.Errorf("git: compute diff: %w", err)
	}

	patch, err := changes.Patch()
	if err != nil {
		return nil, fmt.Errorf("git: generate patch: %w", err)
	}

	stats := make([]FileStat, 0, len(patch.Stats()))
	for _, s := range patch.Stats() {
		stats = append(stats, FileStat{
			Name:      s.Name,
			Additions: s.Addition,
			Deletions: s.Deletion,
		})
	}

	return &DiffResult{
		Diff:  patch.String(),
		Stats: stats,
	}, nil
}

// GetCommitDiff returns the diff introduced by a single commit.
func (s *GitService) GetCommitDiff(_ context.Context, diskPath, sha string) (*DiffResult, error) {
	repo, err := git.PlainOpen(diskPath)
	if err != nil {
		return nil, fmt.Errorf("git: open repo: %w", err)
	}

	hash := plumbing.NewHash(sha)
	commit, err := repo.CommitObject(hash)
	if err != nil {
		return nil, fmt.Errorf("git: %w: commit %q", ErrNotFound, sha)
	}

	commitTree, err := commit.Tree()
	if err != nil {
		return nil, fmt.Errorf("git: get commit tree: %w", err)
	}

	var parentTree *object.Tree
	if commit.NumParents() > 0 {
		parent, pErr := commit.Parent(0)
		if pErr != nil {
			return nil, fmt.Errorf("git: get parent: %w", pErr)
		}
		parentTree, err = parent.Tree()
		if err != nil {
			return nil, fmt.Errorf("git: get parent tree: %w", err)
		}
	}

	var changes object.Changes
	if parentTree != nil {
		changes, err = parentTree.Diff(commitTree)
	} else {
		// Initial commit — diff against empty tree.
		emptyTree := &object.Tree{}
		changes, err = emptyTree.Diff(commitTree)
	}
	if err != nil {
		return nil, fmt.Errorf("git: compute commit diff: %w", err)
	}

	patch, err := changes.Patch()
	if err != nil {
		return nil, fmt.Errorf("git: generate patch: %w", err)
	}

	stats := make([]FileStat, 0, len(patch.Stats()))
	for _, s := range patch.Stats() {
		stats = append(stats, FileStat{
			Name:      s.Name,
			Additions: s.Addition,
			Deletions: s.Deletion,
		})
	}

	return &DiffResult{
		Diff:  patch.String(),
		Stats: stats,
	}, nil
}

// ForkRepository clones a bare repository from srcPath to destPath.
func (s *GitService) ForkRepository(_ context.Context, srcPath, destPath string) error {
	if err := os.MkdirAll(filepath.Dir(destPath), 0o755); err != nil {
		return fmt.Errorf("git: mkdir for fork: %w", err)
	}

	_, err := git.PlainClone(destPath, true, &git.CloneOptions{
		URL:    srcPath,
		Mirror: true,
	})
	if err != nil {
		return fmt.Errorf("git: fork clone from %s to %s: %w", srcPath, destPath, err)
	}

	// Remove the origin remote so the fork is independent.
	forked, err := git.PlainOpen(destPath)
	if err != nil {
		return fmt.Errorf("git: open forked repo: %w", err)
	}
	_ = forked.DeleteRemote("origin")

	s.logger.Info("repository forked", "src", srcPath, "dest", destPath)
	return nil
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

func commitToInfo(c *object.Commit, withStats bool) CommitInfo {
	info := CommitInfo{
		SHA:            c.Hash.String(),
		Message:        c.Message,
		AuthorName:     c.Author.Name,
		AuthorEmail:    c.Author.Email,
		AuthorDate:     c.Author.When,
		CommitterName:  c.Committer.Name,
		CommitterEmail: c.Committer.Email,
		CommitDate:     c.Committer.When,
	}
	for _, p := range c.ParentHashes {
		info.ParentSHAs = append(info.ParentSHAs, p.String())
	}

	if withStats {
		fStats, err := c.Stats()
		if err == nil {
			for _, fs := range fStats {
				info.Stats = append(info.Stats, FileStat{
					Name:      fs.Name,
					Additions: fs.Addition,
					Deletions: fs.Deletion,
				})
			}
		}
	}
	return info
}

func firstLine(s string) string {
	if idx := strings.IndexByte(s, '\n'); idx != -1 {
		return s[:idx]
	}
	return s
}

