package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	claudeAPIURL       = "https://api.anthropic.com/v1/messages"
	claudeAPIVersion   = "2023-06-01"
	maxTokensPerChunk  = 4096  // max output tokens per request
	maxInputChunkChars = 12000 // approximate character limit per diff chunk to stay within input token limits
	maxRetries         = 3
	retryBaseDelay     = 2 * time.Second
)

// Severity levels for review comments.
const (
	SeverityInfo    = "info"
	SeverityWarning = "warning"
	SeverityError   = "error"
)

// Category values for review comments.
const (
	CategoryBug         = "bug"
	CategorySecurity    = "security"
	CategoryPerformance = "performance"
	CategoryStyle       = "style"
	CategorySuggestion  = "suggestion"
)

// FileComment represents a review comment on a specific location in a file.
type FileComment struct {
	FilePath   string `json:"file_path"`
	LineNumber int    `json:"line_number"`
	Comment    string `json:"comment"`
	Severity   string `json:"severity"` // info, warning, error
	Category   string `json:"category"` // bug, security, performance, style, suggestion
}

// ReviewResult holds the Claude review output for a single diff chunk.
type ReviewResult struct {
	Summary      string        `json:"summary"`
	FileComments []FileComment `json:"file_comments"`
	OverallScore int           `json:"overall_score"` // 1-10
	Severity     string        `json:"severity"`      // overall severity: info, warning, error
}

// ClaudeClient is an HTTP client for the Anthropic Claude Messages API.
type ClaudeClient struct {
	apiKey     string
	model      string
	httpClient *http.Client
}

// NewClaudeClient creates a new Claude API client.
func NewClaudeClient(apiKey, model string) *ClaudeClient {
	if model == "" {
		model = "claude-sonnet-4-20250514"
	}
	return &ClaudeClient{
		apiKey: apiKey,
		model:  model,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

// ---------------------------------------------------------------------------
// Claude Messages API request/response types
// ---------------------------------------------------------------------------

type claudeRequest struct {
	Model     string           `json:"model"`
	MaxTokens int              `json:"max_tokens"`
	System    string           `json:"system,omitempty"`
	Messages  []claudeMessage  `json:"messages"`
}

type claudeMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type claudeResponse struct {
	ID      string               `json:"id"`
	Type    string               `json:"type"`
	Content []claudeContentBlock `json:"content"`
	Error   *claudeError         `json:"error,omitempty"`
}

type claudeContentBlock struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type claudeError struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

// ---------------------------------------------------------------------------
// Core review method
// ---------------------------------------------------------------------------

// ReviewCode sends a code diff to Claude for review and returns structured
// feedback. The language and context parameters provide additional hints to
// improve review quality.
func (c *ClaudeClient) ReviewCode(diff, language, context string) (*ReviewResult, error) {
	if c.apiKey == "" {
		return nil, fmt.Errorf("claude API key is not configured")
	}

	systemPrompt := BuildSystemPrompt(language)
	userPrompt := BuildUserPrompt("", diff, context)

	responseText, err := c.sendMessage(systemPrompt, userPrompt)
	if err != nil {
		return nil, fmt.Errorf("claude API call failed: %w", err)
	}

	result, err := parseReviewResponse(responseText)
	if err != nil {
		// If JSON parsing fails, return the raw text as a summary.
		return &ReviewResult{
			Summary:      responseText,
			OverallScore: 5,
			Severity:     SeverityInfo,
		}, nil
	}

	return result, nil
}

// ---------------------------------------------------------------------------
// HTTP transport
// ---------------------------------------------------------------------------

// sendMessage sends a single message to the Claude Messages API with retries
// and rate-limit handling.
func (c *ClaudeClient) sendMessage(systemPrompt, userPrompt string) (string, error) {
	reqBody := claudeRequest{
		Model:     c.model,
		MaxTokens: maxTokensPerChunk,
		System:    systemPrompt,
		Messages: []claudeMessage{
			{Role: "user", Content: userPrompt},
		},
	}

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	var lastErr error
	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			delay := retryBaseDelay * time.Duration(1<<uint(attempt-1))
			time.Sleep(delay)
		}

		req, err := http.NewRequest(http.MethodPost, claudeAPIURL, bytes.NewReader(payload))
		if err != nil {
			return "", fmt.Errorf("create request: %w", err)
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("x-api-key", c.apiKey)
		req.Header.Set("anthropic-version", claudeAPIVersion)

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("HTTP request failed: %w", err)
			continue
		}

		body, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		if readErr != nil {
			lastErr = fmt.Errorf("read response body: %w", readErr)
			continue
		}

		// Handle rate limiting.
		if resp.StatusCode == http.StatusTooManyRequests {
			lastErr = fmt.Errorf("rate limited (429)")
			continue
		}

		// Handle server errors (retry-able).
		if resp.StatusCode >= 500 {
			lastErr = fmt.Errorf("server error (%d): %s", resp.StatusCode, string(body))
			continue
		}

		// Handle client errors (not retry-able).
		if resp.StatusCode != http.StatusOK {
			return "", fmt.Errorf("API error (%d): %s", resp.StatusCode, string(body))
		}

		var apiResp claudeResponse
		if err := json.Unmarshal(body, &apiResp); err != nil {
			return "", fmt.Errorf("unmarshal response: %w", err)
		}

		if apiResp.Error != nil {
			return "", fmt.Errorf("API error: %s: %s", apiResp.Error.Type, apiResp.Error.Message)
		}

		// Extract text from content blocks.
		var texts []string
		for _, block := range apiResp.Content {
			if block.Type == "text" {
				texts = append(texts, block.Text)
			}
		}

		if len(texts) == 0 {
			return "", fmt.Errorf("empty response from Claude API")
		}

		return strings.Join(texts, "\n"), nil
	}

	return "", fmt.Errorf("all retries exhausted: %w", lastErr)
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

// parseReviewResponse extracts a ReviewResult from Claude's JSON response text.
// Claude is prompted to return JSON, but we handle the case where it wraps
// the JSON in markdown code fences.
func parseReviewResponse(text string) (*ReviewResult, error) {
	// Strip markdown code fences if present.
	cleaned := text
	if idx := strings.Index(cleaned, "```json"); idx != -1 {
		cleaned = cleaned[idx+7:]
	} else if idx := strings.Index(cleaned, "```"); idx != -1 {
		cleaned = cleaned[idx+3:]
	}
	if idx := strings.LastIndex(cleaned, "```"); idx != -1 {
		cleaned = cleaned[:idx]
	}
	cleaned = strings.TrimSpace(cleaned)

	var result ReviewResult
	if err := json.Unmarshal([]byte(cleaned), &result); err != nil {
		return nil, fmt.Errorf("parse review JSON: %w", err)
	}

	// Validate and normalise.
	if result.OverallScore < 1 {
		result.OverallScore = 1
	}
	if result.OverallScore > 10 {
		result.OverallScore = 10
	}
	if result.Severity == "" {
		result.Severity = SeverityInfo
	}

	return &result, nil
}

// ---------------------------------------------------------------------------
// Diff chunking
// ---------------------------------------------------------------------------

// ChunkDiffByFile splits a unified diff string into per-file chunks so that
// each chunk can be sent to Claude independently without exceeding token limits.
// Returns a map of file path to its diff text.
func ChunkDiffByFile(diffText string) map[string]string {
	chunks := make(map[string]string)
	lines := strings.Split(diffText, "\n")

	var currentFile string
	var currentLines []string

	flush := func() {
		if currentFile != "" && len(currentLines) > 0 {
			chunks[currentFile] = strings.Join(currentLines, "\n")
		}
	}

	for _, line := range lines {
		if strings.HasPrefix(line, "diff --git ") {
			flush()
			// Extract file path from "diff --git a/path b/path".
			parts := strings.Fields(line)
			if len(parts) >= 4 {
				currentFile = strings.TrimPrefix(parts[3], "b/")
			} else {
				currentFile = "unknown"
			}
			currentLines = []string{line}
		} else {
			currentLines = append(currentLines, line)
		}
	}
	flush()

	return chunks
}

// SplitLargeChunk further splits a single file's diff if it exceeds the
// maximum character limit. Returns a slice of chunk strings.
func SplitLargeChunk(diff string) []string {
	if len(diff) <= maxInputChunkChars {
		return []string{diff}
	}

	var chunks []string
	lines := strings.Split(diff, "\n")
	var current []string
	currentLen := 0

	for _, line := range lines {
		lineLen := len(line) + 1 // +1 for newline
		if currentLen+lineLen > maxInputChunkChars && len(current) > 0 {
			chunks = append(chunks, strings.Join(current, "\n"))
			current = nil
			currentLen = 0
		}
		current = append(current, line)
		currentLen += lineLen
	}
	if len(current) > 0 {
		chunks = append(chunks, strings.Join(current, "\n"))
	}

	return chunks
}

// ---------------------------------------------------------------------------
// Prompt builders (exported for use by review.go)
// ---------------------------------------------------------------------------

// BuildSystemPrompt constructs the system prompt for the Claude code review.
func BuildSystemPrompt(language string) string {
	langHint := ""
	if language != "" {
		langHint = fmt.Sprintf(" The primary language in this repository is %s.", language)
	}

	return fmt.Sprintf(`You are an expert senior code reviewer with deep knowledge of software engineering best practices, security, and performance optimization.%s

Your task is to review a code diff and provide actionable feedback. Focus on:
1. **Bugs**: Logic errors, off-by-one errors, null/nil dereferences, race conditions.
2. **Security**: SQL injection, XSS, authentication/authorization flaws, secret exposure, insecure crypto.
3. **Performance**: N+1 queries, unnecessary allocations, algorithmic inefficiency, missing indexes.
4. **Style**: Naming conventions, code organization, dead code, missing error handling.
5. **Suggestions**: Better approaches, design pattern opportunities, test coverage gaps.

Respond ONLY with a JSON object in this exact schema (no markdown, no extra text):
{
  "summary": "Brief 1-3 sentence summary of the changes and overall quality.",
  "file_comments": [
    {
      "file_path": "path/to/file.ext",
      "line_number": 42,
      "comment": "Clear, actionable description of the issue or suggestion.",
      "severity": "info|warning|error",
      "category": "bug|security|performance|style|suggestion"
    }
  ],
  "overall_score": 8,
  "severity": "info|warning|error"
}

Guidelines:
- overall_score is 1-10 (1=critical issues, 10=excellent).
- Only flag genuine issues; do not be pedantic about minor style preferences.
- Use "error" severity only for bugs or security vulnerabilities.
- line_number should refer to the NEW file line number from the diff.
- If the diff is clean and well-written, say so and give a high score.
- Keep comments concise (1-2 sentences each).`, langHint)
}

// BuildUserPrompt constructs the user message for a specific file diff.
func BuildUserPrompt(filePath, diff, context string) string {
	var sb strings.Builder

	sb.WriteString("Please review the following code diff")
	if filePath != "" {
		sb.WriteString(fmt.Sprintf(" for file `%s`", filePath))
	}
	sb.WriteString(":\n\n")

	if context != "" {
		sb.WriteString("**Context**: ")
		sb.WriteString(context)
		sb.WriteString("\n\n")
	}

	sb.WriteString("```diff\n")
	sb.WriteString(diff)
	sb.WriteString("\n```\n")

	return sb.String()
}
