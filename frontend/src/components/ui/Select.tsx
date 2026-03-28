import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  forwardRef,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Search, Check } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: ReactNode;
}

interface BaseSelectProps {
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  error?: string;
  label?: string;
  renderOption?: (option: SelectOption, isSelected: boolean) => ReactNode;
  className?: string;
}

export interface SingleSelectProps extends BaseSelectProps {
  multiple?: false;
  value?: string;
  onChange?: (value: string | undefined) => void;
}

export interface MultiSelectProps extends BaseSelectProps {
  multiple: true;
  value?: string[];
  onChange?: (value: string[]) => void;
}

export type SelectProps = SingleSelectProps | MultiSelectProps;

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

const Select = forwardRef<HTMLDivElement, SelectProps>((props, ref) => {
  const {
    options,
    placeholder = 'Select...',
    searchable = false,
    clearable = false,
    disabled = false,
    error,
    label,
    multiple = false,
    renderOption,
    className = '',
  } = props;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Current value helpers
  const selectedValues: string[] = multiple
    ? ((props as MultiSelectProps).value ?? [])
    : (props as SingleSelectProps).value !== undefined
      ? [(props as SingleSelectProps).value!]
      : [];

  const isSelected = useCallback((v: string) => selectedValues.includes(v), [selectedValues]);

  // Filtered options
  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const lower = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(lower));
  }, [options, search]);

  // Position dropdown
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  }, []);

  const openDropdown = useCallback(() => {
    if (disabled) return;
    updatePosition();
    setOpen(true);
    setSearch('');
    setFocusedIndex(-1);
  }, [disabled, updatePosition]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setSearch('');
    setFocusedIndex(-1);
  }, []);

  // Focus search on open
  useEffect(() => {
    if (open && searchable) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [open, searchable]);

  // Click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      )
        return;
      closeDropdown();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, closeDropdown]);

  // Select handlers
  const handleSelect = useCallback(
    (optionValue: string) => {
      if (multiple) {
        const onChange = (props as MultiSelectProps).onChange;
        const current = (props as MultiSelectProps).value ?? [];
        if (current.includes(optionValue)) {
          onChange?.(current.filter((v) => v !== optionValue));
        } else {
          onChange?.([...current, optionValue]);
        }
      } else {
        const onChange = (props as SingleSelectProps).onChange;
        onChange?.(optionValue);
        closeDropdown();
      }
    },
    [multiple, props, closeDropdown]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (multiple) {
        (props as MultiSelectProps).onChange?.([]);
      } else {
        (props as SingleSelectProps).onChange?.(undefined);
      }
    },
    [multiple, props]
  );

  // Keyboard
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDropdown();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => {
          let next = prev + 1;
          while (next < filteredOptions.length && filteredOptions[next].disabled) next++;
          return next < filteredOptions.length ? next : prev;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => {
          let next = prev - 1;
          while (next >= 0 && filteredOptions[next].disabled) next--;
          return next >= 0 ? next : prev;
        });
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
          const opt = filteredOptions[focusedIndex];
          if (!opt.disabled) handleSelect(opt.value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeDropdown();
        break;
    }
  };

  // Display text
  const displayText = useMemo(() => {
    if (selectedValues.length === 0) return null;
    if (!multiple) {
      const opt = options.find((o) => o.value === selectedValues[0]);
      return opt?.label ?? selectedValues[0];
    }
    return selectedValues
      .map((v) => options.find((o) => o.value === v)?.label ?? v)
      .join(', ');
  }, [selectedValues, options, multiple]);

  const hasError = Boolean(error);

  return (
    <div ref={ref} className={['flex flex-col gap-1', className].filter(Boolean).join(' ')}>
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      )}

      {/* Trigger */}
      <div
        ref={triggerRef}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-disabled={disabled}
        onClick={() => (open ? closeDropdown() : openDropdown())}
        onKeyDown={handleKeyDown}
        className={[
          'flex items-center justify-between min-h-[38px] px-3 py-2 rounded-md border text-sm cursor-pointer transition-colors',
          'bg-white dark:bg-gray-800',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
          hasError
            ? 'border-red-500 focus:ring-red-500'
            : open
              ? 'border-blue-500 ring-2 ring-blue-500/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500',
          'focus:outline-none',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span
          className={[
            'truncate flex-1 text-left',
            displayText ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500',
          ].join(' ')}
        >
          {displayText || placeholder}
        </span>

        <div className="flex items-center gap-1 ml-2 shrink-0">
          {clearable && selectedValues.length > 0 && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear selection"
              className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown
            className={[
              'h-4 w-4 text-gray-400 transition-transform',
              open ? 'rotate-180' : '',
            ].join(' ')}
          />
        </div>
      </div>

      {hasError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {/* Dropdown */}
      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            role="listbox"
            aria-multiselectable={multiple || undefined}
            style={{
              position: 'absolute',
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
            }}
            className="z-50 rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800 overflow-hidden"
          >
            {searchable && (
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                <Search className="h-4 w-4 text-gray-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setFocusedIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search..."
                  className="w-full bg-transparent text-sm outline-none text-gray-800 dark:text-gray-200 placeholder:text-gray-400"
                />
              </div>
            )}

            <div className="max-h-60 overflow-y-auto py-1">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  No options found
                </div>
              ) : (
                filteredOptions.map((option, idx) => {
                  const selected = isSelected(option.value);
                  const focused = idx === focusedIndex;

                  const content = renderOption ? (
                    renderOption(option, selected)
                  ) : (
                    <>
                      {option.icon && (
                        <span className="inline-flex shrink-0">{option.icon}</span>
                      )}
                      <span className="truncate flex-1">{option.label}</span>
                      {selected && <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />}
                    </>
                  );

                  return (
                    <div
                      key={option.value}
                      role="option"
                      aria-selected={selected}
                      aria-disabled={option.disabled}
                      onClick={() => !option.disabled && handleSelect(option.value)}
                      onMouseEnter={() => setFocusedIndex(idx)}
                      className={[
                        'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors',
                        option.disabled
                          ? 'opacity-50 cursor-not-allowed text-gray-400'
                          : selected
                            ? 'text-blue-700 dark:text-blue-300'
                            : 'text-gray-700 dark:text-gray-200',
                        focused && !option.disabled ? 'bg-gray-100 dark:bg-gray-700' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {content}
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
});

Select.displayName = 'Select';

export { Select };
export default Select;
