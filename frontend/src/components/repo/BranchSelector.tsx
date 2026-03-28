import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  GitBranch,
  Tag,
  ChevronDown,
  Search,
  Check,
  Plus,
  Loader2,
} from 'lucide-react';
import type { Branch, Tag as TagType } from '@/types/repos';

interface BranchSelectorProps {
  repoFullName: string;
  currentRef: string;
  onSelect: (ref: string, type: 'branch' | 'tag') => void;
  onCreateBranch?: () => void;
}

async function fetchBranches(repoFullName: string): Promise<Branch[]> {
  const res = await fetch(`/api/repositories/${repoFullName}/branches`);
  if (!res.ok) throw new Error('Failed to fetch branches');
  return res.json();
}

async function fetchTags(repoFullName: string): Promise<TagType[]> {
  const res = await fetch(`/api/repositories/${repoFullName}/tags`);
  if (!res.ok) throw new Error('Failed to fetch tags');
  return res.json();
}

export default function BranchSelector({
  repoFullName,
  currentRef,
  onSelect,
  onCreateBranch,
}: BranchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'branches' | 'tags'>('branches');
  const [filter, setFilter] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: branches = [], isLoading: loadingBranches } = useQuery({
    queryKey: ['branches', repoFullName],
    queryFn: () => fetchBranches(repoFullName),
    enabled: isOpen,
  });

  const { data: tags = [], isLoading: loadingTags } = useQuery({
    queryKey: ['tags', repoFullName],
    queryFn: () => fetchTags(repoFullName),
    enabled: isOpen && activeTab === 'tags',
  });

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredBranches = branches.filter((b) =>
    b.name.toLowerCase().includes(filter.toLowerCase())
  );
  const filteredTags = tags.filter((t) =>
    t.name.toLowerCase().includes(filter.toLowerCase())
  );

  const isLoading = activeTab === 'branches' ? loadingBranches : loadingTags;
  const items = activeTab === 'branches' ? filteredBranches : filteredTags;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-gray-300
          rounded-md bg-white hover:bg-gray-50 transition-colors
          dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200"
      >
        <GitBranch className="h-4 w-4 text-gray-500" />
        <span className="max-w-[160px] truncate">{currentRef}</span>
        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-30
            dark:bg-gray-800 dark:border-gray-700"
        >
          {/* Search */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Filter branches/tags..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('branches')}
              className={[
                'flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'branches'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
              ].join(' ')}
            >
              <GitBranch className="h-4 w-4 inline mr-1.5" />
              Branches
            </button>
            <button
              onClick={() => setActiveTab('tags')}
              className={[
                'flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'tags'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
              ].join(' ')}
            >
              <Tag className="h-4 w-4 inline mr-1.5" />
              Tags
            </button>
          </div>

          {/* Items */}
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-6 dark:text-gray-400">
                No {activeTab} found.
              </p>
            ) : (
              <ul>
                {items.map((item) => {
                  const isActive = item.name === currentRef;
                  return (
                    <li key={item.name}>
                      <button
                        onClick={() => {
                          onSelect(item.name, activeTab === 'branches' ? 'branch' : 'tag');
                          setIsOpen(false);
                          setFilter('');
                        }}
                        className={[
                          'w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700',
                          isActive ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300',
                        ].join(' ')}
                      >
                        {isActive && <Check className="h-4 w-4 shrink-0" />}
                        <span className={isActive ? '' : 'ml-6'}>{item.name}</span>
                        {'isDefault' in item && (item as Branch).isDefault && (
                          <span className="ml-auto text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded dark:bg-gray-700 dark:text-gray-400">
                            default
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Create branch */}
          {onCreateBranch && activeTab === 'branches' && (
            <div className="border-t border-gray-200 dark:border-gray-700 p-2">
              <button
                onClick={() => {
                  onCreateBranch();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50
                  rounded-md dark:text-blue-400 dark:hover:bg-blue-900/20"
              >
                <Plus className="h-4 w-4" />
                Create branch
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
