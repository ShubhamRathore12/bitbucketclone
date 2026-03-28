export const API_BASE = "/api/v1";

export const WS_URL = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;

export const AUTH_STORAGE_KEY = "bb_auth";
export const THEME_STORAGE_KEY = "bb_theme";
export const RECENT_REPOS_KEY = "bb_recent_repos";

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes before expiry

export const WS_RECONNECT_BASE_DELAY_MS = 1000;
export const WS_RECONNECT_MAX_DELAY_MS = 30000;
export const WS_RECONNECT_MAX_ATTEMPTS = 10;

export const FILE_SIZE_LIMIT_BYTES = 10 * 1024 * 1024; // 10 MB
export const DIFF_LINE_LIMIT = 5000;

export const SUPPORTED_LANGUAGES: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  cs: "csharp",
  cpp: "cpp",
  c: "c",
  h: "c",
  hpp: "cpp",
  swift: "swift",
  php: "php",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  yml: "yaml",
  yaml: "yaml",
  json: "json",
  xml: "xml",
  html: "html",
  css: "css",
  scss: "scss",
  less: "less",
  sql: "sql",
  md: "markdown",
  dockerfile: "dockerfile",
  tf: "hcl",
  toml: "toml",
  ini: "ini",
  lua: "lua",
  r: "r",
  dart: "dart",
  vue: "vue",
  svelte: "svelte",
};

export const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "bmp", "ico", "svg", "webp", "avif",
  "mp3", "wav", "ogg", "mp4", "webm", "avi", "mov",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "zip", "tar", "gz", "bz2", "7z", "rar",
  "exe", "dll", "so", "dylib", "bin",
  "woff", "woff2", "ttf", "otf", "eot",
]);

export const PR_STATE_COLORS: Record<string, string> = {
  open: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950",
  merged: "text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-950",
  declined: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950",
  superseded: "text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-800",
};

export const ISSUE_PRIORITY_COLORS: Record<string, string> = {
  trivial: "text-gray-500",
  minor: "text-green-500",
  major: "text-yellow-500",
  critical: "text-orange-500",
  blocker: "text-red-600",
};

export const PIPELINE_STATUS_COLORS: Record<string, string> = {
  pending: "text-gray-500",
  running: "text-blue-500",
  successful: "text-green-500",
  failed: "text-red-500",
  stopped: "text-gray-500",
  paused: "text-yellow-500",
  skipped: "text-gray-400",
};
