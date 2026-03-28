import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// ---------------------------------------------------------------------------
// NotFoundPage (404)
// ---------------------------------------------------------------------------

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* Illustration */}
        <div className="mb-8">
          <svg
            className="mx-auto h-48 w-48 text-gray-200 dark:text-gray-700"
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Broken document illustration */}
            <rect x="40" y="20" width="120" height="160" rx="8" fill="currentColor" />
            <rect
              x="55"
              y="40"
              width="90"
              height="8"
              rx="4"
              className="fill-gray-300 dark:fill-gray-600"
            />
            <rect
              x="55"
              y="56"
              width="70"
              height="8"
              rx="4"
              className="fill-gray-300 dark:fill-gray-600"
            />
            <rect
              x="55"
              y="72"
              width="80"
              height="8"
              rx="4"
              className="fill-gray-300 dark:fill-gray-600"
            />
            {/* Broken line */}
            <path
              d="M40 100 L80 100 L90 115 L100 85 L110 100 L160 100"
              stroke="currentColor"
              strokeWidth="4"
              className="stroke-red-400 dark:stroke-red-500"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect
              x="55"
              y="124"
              width="60"
              height="8"
              rx="4"
              className="fill-gray-300 dark:fill-gray-600"
            />
            <rect
              x="55"
              y="140"
              width="40"
              height="8"
              rx="4"
              className="fill-gray-300 dark:fill-gray-600"
            />
            {/* Question mark */}
            <circle cx="160" cy="40" r="24" className="fill-blue-100 dark:fill-blue-900/30" />
            <text
              x="160"
              y="48"
              textAnchor="middle"
              className="fill-blue-500 dark:fill-blue-400"
              fontSize="28"
              fontWeight="bold"
              fontFamily="system-ui"
            >
              ?
            </text>
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-6xl font-extrabold text-gray-900 dark:text-white mb-2">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Page not found
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto">
          The page you are looking for does not exist, has been moved, or you may not have permission
          to view it.
        </p>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link to="/">
            <Button variant="primary" size="lg" leftIcon={<Home className="h-4 w-4" />}>
              Go to dashboard
            </Button>
          </Link>
          <Button
            variant="outline"
            size="lg"
            leftIcon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => window.history.back()}
          >
            Go back
          </Button>
          <Link to="/search">
            <Button variant="ghost" size="lg" leftIcon={<Search className="h-4 w-4" />}>
              Search
            </Button>
          </Link>
        </div>

        {/* Help link */}
        <p className="mt-8 text-sm text-gray-400 dark:text-gray-500">
          If you believe this is a mistake, please{' '}
          <a
            href="mailto:support@bitbucket.org"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            contact support
          </a>
          .
        </p>
      </div>
    </div>
  );
}
