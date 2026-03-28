import React, { useState, useCallback } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';
import Modal from '@/components/ui/Modal';

interface CloneDialogProps {
  open: boolean;
  onClose: () => void;
  httpsUrl: string;
  sshUrl: string;
  repoName: string;
}

type Protocol = 'https' | 'ssh';

export default function CloneDialog({
  open,
  onClose,
  httpsUrl,
  sshUrl,
  repoName,
}: CloneDialogProps) {
  const [protocol, setProtocol] = useState<Protocol>('https');
  const [copied, setCopied] = useState(false);

  const cloneUrl = protocol === 'https' ? httpsUrl : sshUrl;
  const cloneCommand = `git clone ${cloneUrl}`;

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }, []);

  return (
    <Modal open={open} onClose={onClose} title="Clone this repository" size="md">
      <div className="space-y-4">
        {/* Protocol tabs */}
        <div className="flex border border-gray-200 rounded-md overflow-hidden dark:border-gray-700">
          <button
            onClick={() => { setProtocol('https'); setCopied(false); }}
            className={[
              'flex-1 px-4 py-2 text-sm font-medium transition-colors',
              protocol === 'https'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
            ].join(' ')}
          >
            HTTPS
          </button>
          <button
            onClick={() => { setProtocol('ssh'); setCopied(false); }}
            className={[
              'flex-1 px-4 py-2 text-sm font-medium transition-colors',
              protocol === 'ssh'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
            ].join(' ')}
          >
            SSH
          </button>
        </div>

        {/* Clone URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Clone URL
          </label>
          <div className="flex items-center border border-gray-300 rounded-md dark:border-gray-600 overflow-hidden">
            <input
              type="text"
              readOnly
              value={cloneUrl}
              className="flex-1 px-3 py-2 text-sm font-mono bg-gray-50 dark:bg-gray-800 dark:text-gray-200
                border-none focus:outline-none"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={() => handleCopy(cloneUrl)}
              className="px-3 py-2 border-l border-gray-300 dark:border-gray-600 hover:bg-gray-100
                dark:hover:bg-gray-700 transition-colors"
              title="Copy URL"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 text-gray-500" />
              )}
            </button>
          </div>
        </div>

        {/* Command */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Clone command
          </label>
          <div className="flex items-center bg-gray-900 rounded-md overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 flex-1 min-w-0">
              <Terminal className="h-4 w-4 text-gray-400 shrink-0" />
              <code className="text-sm text-green-400 truncate">{cloneCommand}</code>
            </div>
            <button
              onClick={() => handleCopy(cloneCommand)}
              className="px-3 py-2.5 border-l border-gray-700 hover:bg-gray-800 transition-colors"
              title="Copy command"
            >
              <Copy className="h-4 w-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Help text */}
        {protocol === 'ssh' && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Make sure you have an SSH key added to your account.{' '}
            <a href="/settings/ssh-keys" className="text-blue-600 dark:text-blue-400 hover:underline">
              Manage SSH keys
            </a>
          </p>
        )}
      </div>
    </Modal>
  );
}
