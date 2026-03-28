import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';

export interface CodeBlockProps {
  code: string;
  language?: string;
  highlightLines?: number[];
  showLineNumbers?: boolean;
  className?: string;
}

interface ShikiHighlighter {
  codeToHtml: (code: string, options: { lang: string; theme: string }) => string;
}

// Lazy-load shiki
let shikiPromise: Promise<ShikiHighlighter> | null = null;

async function getHighlighter(): Promise<ShikiHighlighter> {
  if (!shikiPromise) {
    shikiPromise = import('shiki').then(async (mod) => {
      const highlighter = await mod.createHighlighter({
        themes: ['github-dark', 'github-light'],
        langs: [
          'javascript',
          'typescript',
          'python',
          'java',
          'go',
          'rust',
          'json',
          'yaml',
          'html',
          'css',
          'bash',
          'sql',
          'markdown',
          'jsx',
          'tsx',
          'c',
          'cpp',
          'csharp',
          'ruby',
          'php',
          'swift',
          'kotlin',
          'xml',
          'dockerfile',
        ],
      });
      return highlighter;
    });
  }
  return shikiPromise;
}

function CodeBlock({
  code,
  language = 'text',
  highlightLines = [],
  showLineNumbers = true,
  className = '',
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const codeRef = useRef<HTMLPreElement>(null);
  const lines = code.split('\n');

  // Attempt syntax highlighting via shiki
  useEffect(() => {
    let cancelled = false;

    getHighlighter()
      .then((highlighter) => {
        if (cancelled) return;
        // Detect dark mode
        const isDark = document.documentElement.classList.contains('dark');
        const theme = isDark ? 'github-dark' : 'github-light';
        try {
          const html = highlighter.codeToHtml(code, { lang: language, theme });
          setHighlightedHtml(html);
        } catch {
          // Language not supported, fall through to plain render
          setHighlightedHtml(null);
        }
      })
      .catch(() => {
        // shiki not available, use plain text rendering
        setHighlightedHtml(null);
      });

    return () => {
      cancelled = true;
    };
  }, [code, language]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [code]);

  const highlightLineSet = new Set(highlightLines);

  return (
    <div
      className={[
        'relative group rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 my-3 overflow-hidden',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-mono text-gray-500 dark:text-gray-400 uppercase">
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Copied' : 'Copy code'}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      {highlightedHtml ? (
        <div className="overflow-x-auto">
          <div className="flex">
            {showLineNumbers && (
              <div
                aria-hidden="true"
                className="flex flex-col items-end px-3 py-3 select-none border-r border-gray-200 dark:border-gray-700 bg-gray-100/50 dark:bg-gray-800/50"
              >
                {lines.map((_, i) => (
                  <span
                    key={i}
                    className={[
                      'text-xs leading-6 font-mono',
                      highlightLineSet.has(i + 1)
                        ? 'text-blue-500 dark:text-blue-400'
                        : 'text-gray-400 dark:text-gray-600',
                    ].join(' ')}
                  >
                    {i + 1}
                  </span>
                ))}
              </div>
            )}
            <div
              className="flex-1 overflow-x-auto p-3 [&>pre]:!bg-transparent [&>pre]:!p-0 [&>pre]:!m-0 [&_code]:!text-sm [&_code]:!leading-6"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex">
            {showLineNumbers && (
              <div
                aria-hidden="true"
                className="flex flex-col items-end px-3 py-3 select-none border-r border-gray-200 dark:border-gray-700 bg-gray-100/50 dark:bg-gray-800/50"
              >
                {lines.map((_, i) => (
                  <span
                    key={i}
                    className={[
                      'text-xs leading-6 font-mono',
                      highlightLineSet.has(i + 1)
                        ? 'text-blue-500 dark:text-blue-400'
                        : 'text-gray-400 dark:text-gray-600',
                    ].join(' ')}
                  >
                    {i + 1}
                  </span>
                ))}
              </div>
            )}
            <pre ref={codeRef} className="flex-1 p-3 overflow-x-auto">
              <code className="text-sm leading-6 font-mono text-gray-800 dark:text-gray-200">
                {lines.map((line, i) => (
                  <div
                    key={i}
                    className={
                      highlightLineSet.has(i + 1)
                        ? 'bg-yellow-100/50 dark:bg-yellow-900/20 -mx-3 px-3'
                        : ''
                    }
                  >
                    {line || '\n'}
                  </div>
                ))}
              </code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export { CodeBlock };
export default CodeBlock;
