export type AssetKind = "icon" | "image";

export declare const assetSizing: Readonly<{
  gridBase: number;
  gridDisplay: number;
  strokeDefault: number;
  strokeMinimum: number;
  rasterExportScale: number;
}>;

export declare const assetRatios: Readonly<{
  square: number;
  brandLogoEnergyx: number;
}>;

export declare const assetNaming: Readonly<{
  iconPrefix: "ic_";
  imagePrefix: "img_";
  variantSeparator: "/";
}>;

export declare const iconNames: ReadonlyArray<string>;
export declare const imageNames: ReadonlyArray<string>;
export declare function getAssetKind(name: string): AssetKind;
export declare function normalizeAssetName(name: string): string;
export declare function getAssetCssClass(name: string): string;
export declare function getRasterSourceSize(renderedSize: number): number;
