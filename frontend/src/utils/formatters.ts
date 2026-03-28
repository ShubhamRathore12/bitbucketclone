import {
  formatDistanceToNow,
  format,
  isToday,
  isYesterday,
  isThisYear,
  parseISO,
} from "date-fns";

/**
 * Format a date string as a relative time (e.g., "3 hours ago").
 */
export function relativeTime(dateStr: string): string {
  const date = parseISO(dateStr);
  return formatDistanceToNow(date, { addSuffix: true });
}

/**
 * Format a date string with smart formatting:
 * - Today: "Today at 3:45 PM"
 * - Yesterday: "Yesterday at 3:45 PM"
 * - This year: "Mar 15 at 3:45 PM"
 * - Older: "Mar 15, 2024"
 */
export function smartDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) {
    return `Today at ${format(date, "h:mm a")}`;
  }
  if (isYesterday(date)) {
    return `Yesterday at ${format(date, "h:mm a")}`;
  }
  if (isThisYear(date)) {
    return format(date, "MMM d 'at' h:mm a");
  }
  return format(date, "MMM d, yyyy");
}

/**
 * Format a date string as a full date-time string.
 */
export function fullDateTime(dateStr: string): string {
  return format(parseISO(dateStr), "MMMM d, yyyy 'at' h:mm:ss a");
}

/**
 * Format byte count as human-readable file size.
 */
export function fileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  const formatted = value < 10 ? value.toFixed(1) : Math.round(value).toString();
  return `${formatted} ${units[i]}`;
}

/**
 * Format a number with commas (e.g., 1,234,567).
 */
export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Format a number in compact form (e.g., 1.2K, 3.4M).
 */
export function compactNumber(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) {
    const v = n / 1000;
    return `${v < 10 ? v.toFixed(1) : Math.round(v)}K`;
  }
  if (n < 1_000_000_000) {
    const v = n / 1_000_000;
    return `${v < 10 ? v.toFixed(1) : Math.round(v)}M`;
  }
  const v = n / 1_000_000_000;
  return `${v < 10 ? v.toFixed(1) : Math.round(v)}B`;
}

/**
 * Format a duration in seconds to human-readable string.
 */
export function duration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Truncate a string to maxLength, adding ellipsis if truncated.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + "\u2026";
}

/**
 * Extract the first line of a commit message (the subject).
 */
export function commitSubject(message: string): string {
  const newlineIdx = message.indexOf("\n");
  return newlineIdx === -1 ? message : message.slice(0, newlineIdx);
}

/**
 * Abbreviate a full commit hash to short form.
 */
export function shortHash(hash: string, length = 7): string {
  return hash.slice(0, length);
}

/**
 * Format a file path, extracting just the filename.
 */
export function fileName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

/**
 * Format a file path, extracting the directory portion.
 */
export function dirName(path: string): string {
  const lastSlash = path.lastIndexOf("/");
  return lastSlash === -1 ? "" : path.slice(0, lastSlash);
}

/**
 * Get file extension from a file path.
 */
export function fileExtension(path: string): string {
  const name = fileName(path);
  const dotIdx = name.lastIndexOf(".");
  return dotIdx === -1 ? "" : name.slice(dotIdx + 1).toLowerCase();
}

/**
 * Format diff stats (e.g., "+12 -5").
 */
export function diffStats(additions: number, deletions: number): string {
  const parts: string[] = [];
  if (additions > 0) parts.push(`+${additions}`);
  if (deletions > 0) parts.push(`-${deletions}`);
  return parts.join(" ") || "0";
}

/**
 * Generate initials from a display name (max 2 characters).
 */
export function initials(displayName: string): string {
  const words = displayName.trim().split(/\s+/);
  if (words.length === 0) return "?";
  if (words.length === 1) return (words[0]?.[0] ?? "?").toUpperCase();
  return ((words[0]?.[0] ?? "") + (words[words.length - 1]?.[0] ?? "")).toUpperCase();
}

/**
 * Pluralize a word based on count.
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  const word = count === 1 ? singular : (plural ?? singular + "s");
  return `${count} ${word}`;
}
