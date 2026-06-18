export type ConfirmDialogIntent = "default" | "danger";
export type ConfirmDialogActionLayout = "horizontal" | "stacked";

export const confirmDialogIntents: ConfirmDialogIntent[];
export const confirmDialogActionLayouts: ConfirmDialogActionLayout[];

export function getConfirmDialogClasses(options?: {
  intent?: ConfirmDialogIntent;
  actionLayout?: ConfirmDialogActionLayout;
  open?: boolean;
  className?: string;
}): string;

export function getConfirmDialogOverlayClasses(options?: {
  open?: boolean;
  className?: string;
}): string;

export function getConfirmDialogA11yProps(options?: {
  id?: string;
  titleId?: string;
  descriptionId?: string;
  describedBy?: boolean;
}): {
  role: "dialog";
  "aria-modal": "true";
  "aria-labelledby": string;
  "aria-describedby"?: string;
  tabIndex: -1;
};

export function getConfirmDialogActionProps(options?: {
  intent?: ConfirmDialogIntent;
  cancelLabel?: string;
  confirmLabel?: string;
}): {
  cancel: {
    className: string;
    type: "button";
    children: string;
  };
  confirm: {
    className: string;
    type: "button";
    children: string;
  };
};

export function getFocusableDialogElements(dialog: Element | null | undefined): Element[];

export function trapConfirmDialogFocus(
  event: Pick<KeyboardEvent, "key" | "shiftKey" | "preventDefault">,
  dialog: HTMLElement | null | undefined,
): boolean;
