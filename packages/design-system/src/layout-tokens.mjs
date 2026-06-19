export const layoutBreakpoints = Object.freeze({
  mobile: Object.freeze({ min: 360, max: 767 }),
  tablet: Object.freeze({ min: 768, max: 1199 }),
  desktop: Object.freeze({ min: 1200, max: null }),
});

export const layoutGrid = Object.freeze({
  mobile: Object.freeze({
    breakpoint: "mobile",
    containerMin: 360,
    containerMax: null,
    columns: 6,
    offset: 16,
    gutter: 8,
  }),
  tablet: Object.freeze({
    breakpoint: "tablet",
    containerMin: 768,
    containerMax: null,
    columns: 8,
    offset: 24,
    gutter: 24,
  }),
  desktop: Object.freeze({
    breakpoint: "desktop",
    containerMin: 1440,
    containerMax: null,
    columns: 12,
    offset: 24,
    gutter: 24,
  }),
});

export const layoutCssVariables = Object.freeze({
  containerMin: "--ds-layout-container-min",
  containerMax: "--ds-layout-container-max",
  columns: "--ds-layout-columns",
  offset: "--ds-layout-offset",
  gutter: "--ds-layout-gutter",
});

export function getLayoutBreakpoint(width) {
  if (width >= layoutBreakpoints.desktop.min) return "desktop";
  if (width >= layoutBreakpoints.tablet.min) return "tablet";
  return "mobile";
}

export function getLayoutGrid(width) {
  return layoutGrid[getLayoutBreakpoint(width)];
}

export function toLayoutCssVariableMap(breakpoint = "mobile") {
  if (!(breakpoint in layoutGrid)) {
    throw new Error(`Unknown layout breakpoint: ${breakpoint}`);
  }

  const grid = layoutGrid[breakpoint];
  return {
    [layoutCssVariables.containerMin]: `${grid.containerMin}px`,
    [layoutCssVariables.containerMax]: grid.containerMax === null ? "none" : `${grid.containerMax}px`,
    [layoutCssVariables.columns]: String(grid.columns),
    [layoutCssVariables.offset]: `${grid.offset}px`,
    [layoutCssVariables.gutter]: `${grid.gutter}px`,
  };
}

