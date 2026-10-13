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

/** @deprecated — L1(@/components/ui/tabs) 사용으로 이관 대상. */
export function Tabs({ items, activeKey, onChange }: TabsProps) {
  return (
    <UITabs value={activeKey} onValueChange={onChange} className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto overflow-y-hidden">
        {items.map((tab) => (
          <TabsTrigger key={tab.key} value={tab.key} disabled={tab.disabled}>
            <span className="inline-flex items-center gap-2">
              {tab.label}
              {tab.badge !== undefined && <Badge variant="secondary">{tab.badge}</Badge>}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
    </UITabs>
  );
}
