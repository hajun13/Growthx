'use client';

import {
  Tabs as UITabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

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
    <UITabs value={activeKey} onValueChange={onChange} className="w-full">
      <TabsList className="h-auto w-full justify-start gap-0 overflow-x-auto overflow-y-hidden rounded-none border-b border-border bg-transparent p-0">
        {items.map((tab) => (
          <TabsTrigger
            key={tab.key}
            value={tab.key}
            disabled={tab.disabled}
            className="h-10 gap-2 rounded-none border-b-2 border-transparent bg-transparent px-4 text-[13px] text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            {tab.label}
            {tab.badge !== undefined && (
              <Badge variant="secondary" className="px-1.5 py-0 text-xs font-medium">
                {tab.badge}
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </UITabs>
  );
}
