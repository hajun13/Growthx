export type LabelTone = "primary" | "darkgray" | "secondary" | "red" | "lightgray";
export type LabelVariant = "fill" | "border";
export type HashtagChipKind = "toggle" | "user";
export type HashtagLabelTone = "default" | "partner";

export type LabelClassOptions = {
  tone?: LabelTone;
  variant?: LabelVariant;
  className?: string;
};

export type HashtagChipClassOptions = {
  kind?: HashtagChipKind;
  selected?: boolean;
  removable?: boolean;
  after?: boolean;
  leadingIcon?: unknown;
  className?: string;
};

export type HashtagChipAriaOptions = {
  kind?: HashtagChipKind;
  selected?: boolean;
  disabled?: boolean;
};

export type HashtagLabelClassOptions = {
  tone?: HashtagLabelTone;
  className?: string;
};

export type ValueChipClassOptions = {
  className?: string;
};

export declare const labelTones: LabelTone[];
export declare const labelVariants: LabelVariant[];
export declare const hashtagChipKinds: HashtagChipKind[];
export declare const hashtagLabelTones: HashtagLabelTone[];
export declare function getLabelClasses(options?: LabelClassOptions): string;
export declare function getHashtagChipClasses(options?: HashtagChipClassOptions): string;
export declare function getHashtagChipAriaProps(options?: HashtagChipAriaOptions): Record<string, boolean | string>;
export declare function getHashtagLabelClasses(options?: HashtagLabelClassOptions): string;
export declare function getValueChipClasses(options?: ValueChipClassOptions): string;
