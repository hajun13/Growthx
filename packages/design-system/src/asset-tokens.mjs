export const assetSizing = Object.freeze({
  gridBase: 24,
  gridDisplay: 48,
  strokeDefault: 2,
  strokeMinimum: 1.5,
  rasterExportScale: 1.5,
});

export const assetRatios = Object.freeze({
  square: 1,
  brandLogoEnergyx: 154 / 24,
});

export const assetNaming = Object.freeze({
  iconPrefix: "ic_",
  imagePrefix: "img_",
  variantSeparator: "/",
});

export const iconNames = Object.freeze([
  "ic_Default",
  "ic_add",
  "ic_arrow/down",
  "ic_arrow/left",
  "ic_arrow/right",
  "ic_arrow/up",
  "ic_business_management",
  "ic_calendar",
  "ic_checkbox",
  "ic_checkbox/checked/false",
  "ic_checkbox/checked/true",
  "ic_checkbox/half/false",
  "ic_checkbox/half/true",
  "ic_checkbox/hover/false",
  "ic_checkbox/just_check_icon/false",
  "ic_checkbox/normal/false",
  "ic_checkbox/normal/true",
  "ic_chevron",
  "ic_chevron/down",
  "ic_chevron/left",
  "ic_chevron/right",
  "ic_chevron/up",
  "ic_close/border",
  "ic_close/filled",
  "ic_delete_bin/border",
  "ic_delete_bin/filled",
  "ic_done_all",
  "ic_download",
  "ic_exterminal_link",
  "ic_facebook",
  "ic_file",
  "ic_find_on_map",
  "ic_gauge",
  "ic_goto",
  "ic_headphone",
  "ic_helpdesk",
  "ic_info_border",
  "ic_info_fill",
  "ic_instagram",
  "ic_interaction",
  "ic_line_chart",
  "ic_menu",
  "ic_naver",
  "ic_notification",
  "ic_person/border",
  "ic_person/filled",
  "ic_phone",
  "ic_pin",
  "ic_print",
  "ic_push/active",
  "ic_push/default",
  "ic_radio/checked/false",
  "ic_radio/checked/true",
  "ic_radio/hover/false",
  "ic_radio/normal/false",
  "ic_radio/normal/true",
  "ic_remove/border",
  "ic_remove/filled",
  "ic_remove_file",
  "ic_request_again",
  "ic_search",
  "ic_setting",
  "ic_sort/ascending",
  "ic_sort/descending",
  "ic_star",
  "ic_star/border",
  "ic_star/filled",
  "ic_tooltip",
  "ic_tune",
  "ic_upload_file/default",
  "ic_upload_file/done",
  "ic_write",
]);

export const imageNames = Object.freeze([
  "img_attention",
  "img_audit",
  "img_bookmark",
  "img_calendar_time",
  "img_capital",
  "img_certification_id",
  "img_confetti",
  "img_constructor",
  "img_default",
  "img_envelope/invite",
  "img_envelope/opened",
  "img_envelope/sealed",
  "img_estimate",
  "img_flag",
  "img_hand",
  "img_location_company",
  "img_logo_energyx",
  "img_make_new_project",
  "img_ongoing",
  "img_opinion",
  "img_ow_quickmenu",
  "img_pa_quickmenu",
  "img_panel",
  "img_panel/built",
  "img_panel/field",
  "img_panel/roof",
  "img_paper_state",
  "img_profile_helpdesk",
  "img_question",
  "img_quote",
  "img_stamp_choice",
  "img_upload_file_done",
]);

export function getAssetKind(name) {
  if (name.startsWith(assetNaming.iconPrefix)) return "icon";
  if (name.startsWith(assetNaming.imagePrefix)) return "image";
  throw new Error(`Unknown asset prefix: ${name}`);
}

export function normalizeAssetName(name) {
  return name.trim().replaceAll(" ", "_");
}

export function getAssetCssClass(name) {
  const normalized = normalizeAssetName(name);
  const kind = getAssetKind(normalized);
  return `asset-${kind} asset-${normalized.replaceAll("/", "--")}`;
}

export function getRasterSourceSize(renderedSize) {
  if (!Number.isFinite(renderedSize) || renderedSize <= 0) {
    throw new Error(`Invalid rendered size: ${renderedSize}`);
  }

  return Math.ceil(renderedSize * assetSizing.rasterExportScale);
}
