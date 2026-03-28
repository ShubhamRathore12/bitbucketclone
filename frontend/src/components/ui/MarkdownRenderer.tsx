import React, { type ComponentPropsWithoutRef } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';

export interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const components: Components = {
  // Code blocks
  code({ className, children, ...props }: ComponentPropsWithoutRef<'code'> & { inline?: boolean }) {
    const match = /language-(\w+)/.exec(className || '');
    const codeString = String(children).replace(/\n$/, '');

    // If the code is inside a <pre>, render as a code block
    // react-markdown wraps block code in <pre><code>, inline code is just <code>
    // We detect block code by checking if parent is pre via className containing "language-"
    if (match) {
      return <CodeBlock code={codeString} language={match[1]} />;
    }

    // Inline code
    return (
      <code
        className="px-1.5 py-0.5 rounded bg-gray-100 text-sm font-mono text-gray-800 dark:bg-gray-800 dark:text-gray-200"
        {...props}
      >
        {children}
      </code>
    );
  },

  // Pre: just pass children (CodeBlock handles styling)
  pre({ children }) {
    return <>{children}</>;
  },

  // Tables
  table({ children, ...props }) {
    return (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600" {...props}>
          {children}
        </table>
      </div>
    );
  },
  thead({ children, ...props }) {
    return (
      <thead className="bg-gray-50 dark:bg-gray-800" {...props}>
        {children}
      </thead>
    );
  },
  th({ children, ...props }) {
    return (
      <th
        className="px-4 py-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600"
        {...props}
      >
        {children}
      </th>
    );
  },
  td({ children, ...props }) {
    return (
      <td
        className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600"
        {...props}
      >
        {children}
      </td>
    );
  },

  // Links open in new tab
  a({ children, href, ...props }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline dark:text-blue-400"
        {...props}
      >
        {children}
      </a>
    );
  },

  // Task list items
  li({ children, className, ...props }) {
    const isTask = className?.includes('task-list-item');
    return (
      <li
        className={[
          isTask ? 'list-none flex items-start gap-2' : '',
          'my-1',
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {children}
      </li>
    );
  },

  input({ type, checked, ...props }) {
    if (type === 'checkbox') {
      return (
        <input
          type="checkbox"
          checked={checked}
          readOnly
          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 dark:border-gray-600"
          {...props}
        />
      );
    }
    return <input type={type} {...props} />;
  },

  // Headings
  h1({ children, ...props }) {
    return <h1 className="text-2xl font-bold mt-6 mb-3 text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2" {...props}>{children}</h1>;
  },
  h2({ children, ...props }) {
    return <h2 className="text-xl font-bold mt-5 mb-2 text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2" {...props}>{children}</h2>;
  },
  h3({ children, ...props }) {
    return <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-900 dark:text-gray-100" {...props}>{children}</h3>;
  },
  h4({ children, ...props }) {
    return <h4 className="text-base font-semibold mt-3 mb-1 text-gray-900 dark:text-gray-100" {...props}>{children}</h4>;
  },

  // Block elements
  p({ children, ...props }) {
    return <p className="my-2 text-gray-700 dark:text-gray-300 leading-relaxed" {...props}>{children}</p>;
  },
  blockquote({ children, ...props }) {
    return (
      <blockquote
        className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 my-3 italic text-gray-600 dark:text-gray-400"
        {...props}
      >
        {children}
      </blockquote>
    );
  },
  ul({ children, ...props }) {
    return <ul className="list-disc list-inside my-2 space-y-1" {...props}>{children}</ul>;
  },
  ol({ children, ...props }) {
    return <ol className="list-decimal list-inside my-2 space-y-1" {...props}>{children}</ol>;
  },
  hr() {
    return <hr className="my-4 border-gray-200 dark:border-gray-700" />;
  },
  img({ src, alt, ...props }) {
    return <img src={src} alt={alt} className="max-w-full rounded my-3" {...props} />;
  },
};

function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={['prose-reset text-gray-700 dark:text-gray-300', className].filter(Boolean).join(' ')}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export { MarkdownRenderer };
export default MarkdownRenderer;
