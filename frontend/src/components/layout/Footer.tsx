import React from "react";
import { Link } from "react-router-dom";

const footerLinks = [
  { label: "About", to: "/about" },
  { label: "Documentation", to: "/docs" },
  { label: "API", to: "/api-docs" },
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
  { label: "Status", to: "/status" },
] as const;

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="flex flex-col sm:flex-row items-center justify-between gap-2 px-6 py-4 text-xs text-gray-500 dark:text-gray-500 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <p>&copy; {year} BitClone. All rights reserved.</p>
      <nav className="flex flex-wrap items-center gap-4">
        {footerLinks.map(({ label, to }) => (
          <Link
            key={to}
            to={to}
            className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            {label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
