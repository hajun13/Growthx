'use client';

import { cx } from '@/lib/ui';

export interface TabItem {
  key: string;
  label: string;
  disabled?: boolean;
  badge?: string | number;
}

export interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
}

export function Tabs({ items, activeKey, onChange }: TabsProps) {
  return (
    <div
      role="tablist"
      className="flex gap-1 overflow-x-auto border-b border-neutral-200"
    >
      {items.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={active}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.key)}
            className={cx(
              'flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-base outline-none transition-colors duration-base focus-visible:shadow-focus',
              active
                ? 'border-primary-500 font-semibold text-primary-700'
                : 'border-transparent text-neutral-600 hover:text-neutral-900',
              tab.disabled && 'cursor-not-allowed opacity-40',
            )}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span className="rounded-full bg-primary-50 px-2 py-[1px] text-xs font-medium text-primary-700">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
