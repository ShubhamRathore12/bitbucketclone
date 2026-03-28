import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export interface DropdownItem {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  onClick?: () => void;
}

export interface DropdownDivider {
  key: string;
  type: 'divider';
}

export type DropdownMenuEntry = DropdownItem | DropdownDivider;

function isDivider(entry: DropdownMenuEntry): entry is DropdownDivider {
  return 'type' in entry && entry.type === 'divider';
}

export interface DropdownProps {
  trigger: ReactNode;
  items: DropdownMenuEntry[];
  align?: 'left' | 'right';
  className?: string;
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

function Dropdown({ trigger, items, align = 'left', className = '' }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, minWidth: 0 });
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Calculate position when opening
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + window.scrollY + 4,
      left: align === 'right' ? rect.right + window.scrollX : rect.left + window.scrollX,
      minWidth: rect.width,
    });
  }, [align]);

  const toggle = useCallback(() => {
    if (!open) {
      updatePosition();
      setFocusedIndex(-1);
    }
    setOpen((prev) => !prev);
  }, [open, updatePosition]);

  const close = useCallback(() => {
    setOpen(false);
    setFocusedIndex(-1);
  }, []);

  // Click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      )
        return;
      close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  // Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, close]);

  // Keyboard navigation
  const actionableItems = items
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => !isDivider(item) && !(item as DropdownItem).disabled);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
      return;
    }

    const currentActionIdx = actionableItems.findIndex(({ idx }) => idx === focusedIndex);

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = currentActionIdx < actionableItems.length - 1 ? currentActionIdx + 1 : 0;
        setFocusedIndex(actionableItems[next].idx);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev =
          currentActionIdx > 0 ? currentActionIdx - 1 : actionableItems.length - 1;
        setFocusedIndex(actionableItems[prev].idx);
        break;
      }
      case 'Home':
        e.preventDefault();
        if (actionableItems.length > 0) setFocusedIndex(actionableItems[0].idx);
        break;
      case 'End':
        e.preventDefault();
        if (actionableItems.length > 0)
          setFocusedIndex(actionableItems[actionableItems.length - 1].idx);
        break;
      case 'Enter':
      case ' ': {
        e.preventDefault();
        const item = items[focusedIndex];
        if (item && !isDivider(item) && !item.disabled) {
          item.onClick?.();
          close();
        }
        break;
      }
      case 'Tab':
        close();
        break;
    }
  };

  // Focus the menu item when focusedIndex changes
  useEffect(() => {
    if (!open || focusedIndex < 0) return;
    const el = menuRef.current?.querySelector(`[data-index="${focusedIndex}"]`) as HTMLElement;
    el?.focus();
  }, [open, focusedIndex]);

  const menuStyle: React.CSSProperties = {
    position: 'absolute',
    top: position.top,
    minWidth: position.minWidth,
    ...(align === 'right' ? { right: window.innerWidth - position.left } : { left: position.left }),
  };

  return (
    <div ref={triggerRef} className={['relative inline-flex', className].filter(Boolean).join(' ')} onKeyDown={handleKeyDown}>
      <div onClick={toggle} role="button" aria-haspopup="menu" aria-expanded={open} tabIndex={0} className="inline-flex cursor-pointer">
        {trigger}
      </div>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={menuStyle}
            className="z-50 min-w-[180px] rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800 animate-in fade-in"
          >
            {items.map((entry, idx) => {
              if (isDivider(entry)) {
                return (
                  <div
                    key={entry.key}
                    role="separator"
                    className="my-1 h-px bg-gray-200 dark:bg-gray-700"
                  />
                );
              }

              const item = entry as DropdownItem;
              const isFocused = focusedIndex === idx;

              return (
                <div
                  key={item.key}
                  role="menuitem"
                  data-index={idx}
                  tabIndex={-1}
                  aria-disabled={item.disabled || undefined}
                  onClick={() => {
                    if (item.disabled) return;
                    item.onClick?.();
                    close();
                  }}
                  onMouseEnter={() => setFocusedIndex(idx)}
                  className={[
                    'flex items-center gap-2 px-3 py-2 text-sm outline-none transition-colors cursor-pointer',
                    item.disabled
                      ? 'opacity-50 cursor-not-allowed'
                      : item.danger
                        ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700',
                    isFocused && !item.disabled
                      ? item.danger
                        ? 'bg-red-50 dark:bg-red-900/20'
                        : 'bg-gray-100 dark:bg-gray-700'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {item.icon && <span className="inline-flex shrink-0 h-4 w-4">{item.icon}</span>}
                  {item.label}
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}

export { Dropdown };
export default Dropdown;
