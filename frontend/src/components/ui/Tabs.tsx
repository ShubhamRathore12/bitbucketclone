import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
  type KeyboardEvent,
} from 'react';

/* ------------------------------------------------------------------ */
/* Context                                                            */
/* ------------------------------------------------------------------ */

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tab components must be used within <Tabs>');
  return ctx;
}

/* ------------------------------------------------------------------ */
/* Tabs (root)                                                        */
/* ------------------------------------------------------------------ */

export interface TabsProps {
  /** The currently active tab value (controlled mode). */
  value?: string;
  /** Default active tab value (uncontrolled mode). */
  defaultValue?: string;
  /** Callback when the active tab changes. */
  onChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

function Tabs({ value, defaultValue, onChange, children, className = '' }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue ?? '');
  const activeTab = value !== undefined ? value : internal;

  const setActiveTab = useCallback(
    (v: string) => {
      if (value === undefined) setInternal(v);
      onChange?.(v);
    },
    [value, onChange]
  );

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* TabList                                                            */
/* ------------------------------------------------------------------ */

export interface TabListProps {
  children: ReactNode;
  className?: string;
}

function TabList({ children, className = '' }: TabListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const tabs = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    if (!tabs) return;
    const tabArr = Array.from(tabs);
    const currentIndex = tabArr.findIndex((t) => t === document.activeElement);
    let nextIndex = currentIndex;

    if (e.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % tabArr.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabArr.length) % tabArr.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = tabArr.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    tabArr[nextIndex].focus();
    tabArr[nextIndex].click();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      onKeyDown={handleKeyDown}
      className={[
        'flex border-b border-gray-200 dark:border-gray-700',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab                                                                */
/* ------------------------------------------------------------------ */

export interface TabProps {
  value: string;
  icon?: ReactNode;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}

function Tab({ value, icon, disabled = false, children, className = '' }: TabProps) {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === value;
  const tabRef = useRef<HTMLButtonElement>(null);

  return (
    <button
      ref={tabRef}
      role="tab"
      type="button"
      aria-selected={isActive}
      aria-disabled={disabled}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      onClick={() => !disabled && setActiveTab(value)}
      className={[
        'relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset',
        isActive
          ? 'text-blue-600 dark:text-blue-400'
          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        // Bitbucket-style underline
        isActive
          ? 'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600 dark:after:bg-blue-400'
          : 'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent hover:after:bg-gray-300 dark:hover:after:bg-gray-600',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {icon && <span className="inline-flex shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* TabPanel                                                           */
/* ------------------------------------------------------------------ */

export interface TabPanelProps {
  value: string;
  children: ReactNode;
  className?: string;
}

function TabPanel({ value, children, className = '' }: TabPanelProps) {
  const { activeTab } = useTabsContext();
  if (activeTab !== value) return null;

  return (
    <div
      role="tabpanel"
      tabIndex={0}
      className={['py-4 focus:outline-none', className].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}

export { Tabs, TabList, Tab, TabPanel };
export default Tabs;
