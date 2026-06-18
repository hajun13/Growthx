export type TabsVariant = "underline" | "box" | "box-border" | "box-basic";
export type TabsSize = "s" | "l";
export type TabsOrientation = "horizontal" | "vertical";
export type TabsActivation = "automatic" | "manual";

export type TabItem = {
  id: string;
  label?: string;
  disabled?: boolean;
  badge?: boolean;
  tabId?: string;
  panelId?: string;
};

export type TabsProps = {
  value?: string;
  items?: readonly TabItem[];
  variant?: TabsVariant;
  size?: TabsSize;
  orientation?: TabsOrientation;
  activation?: TabsActivation;
};

export type TabsKeyboardState = {
  value?: string;
  focusedValue?: string;
};

export declare const tabVariants: readonly TabsVariant[];
export declare const tabSizes: readonly TabsSize[];
export declare const tabOrientations: readonly TabsOrientation[];
export declare function normalizeTabsProps(props?: TabsProps): Required<Pick<TabsProps, "variant" | "size" | "orientation" | "items" | "activation">> & { value?: string };
export declare function getTabsClassNames(props?: TabsProps): string;
export declare function getTabsRootProps(props?: TabsProps): Record<string, string>;
export declare function getTabProps(
  item: TabItem,
  context?: TabsProps,
): Record<string, string | number | boolean | undefined>;
export declare function getTabPanelProps(
  item: TabItem,
  context?: TabsProps,
): Record<string, string | number | boolean | undefined>;
export declare function getNextEnabledTabIndex(
  items: readonly TabItem[],
  currentIndex: number,
  direction: "next" | "previous",
): number;
export declare function reduceTabsKeyboardState(
  state: TabsKeyboardState,
  key: string,
  items: readonly TabItem[],
  options?: Pick<TabsProps, "orientation" | "activation">,
): TabsKeyboardState;
