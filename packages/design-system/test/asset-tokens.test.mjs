import assert from "node:assert/strict";
import {
  assetNaming,
  assetRatios,
  assetSizing,
  getAssetCssClass,
  getAssetKind,
  getRasterSourceSize,
  iconNames,
  imageNames,
  normalizeAssetName,
} from "../src/asset-tokens.mjs";

assert.equal(assetSizing.gridBase, 24);
assert.equal(assetSizing.gridDisplay, 48);
assert.equal(assetSizing.strokeDefault, 2);
assert.equal(assetSizing.strokeMinimum, 1.5);
assert.equal(assetSizing.rasterExportScale, 1.5);

assert.equal(assetRatios.square, 1);
assert.equal(assetRatios.brandLogoEnergyx, 154 / 24);

assert.equal(assetNaming.iconPrefix, "ic_");
assert.equal(assetNaming.imagePrefix, "img_");
assert.equal(assetNaming.variantSeparator, "/");

assert.equal(getAssetKind("ic_star/border"), "icon");
assert.equal(getAssetKind("img_panel/roof"), "image");
assert.throws(() => getAssetKind("logo_energyx"), /Unknown asset prefix/);

assert.equal(normalizeAssetName(" img panel/roof "), "img_panel/roof");
assert.equal(getAssetCssClass("ic_star/border"), "asset-icon asset-ic_star--border");
assert.equal(getRasterSourceSize(24), 36);
assert.equal(getRasterSourceSize(48), 72);
assert.throws(() => getRasterSourceSize(0), /Invalid rendered size/);

assert.ok(iconNames.includes("ic_checkbox/checked/true"));
assert.ok(iconNames.includes("ic_upload_file/done"));
assert.ok(imageNames.includes("img_logo_energyx"));
assert.ok(imageNames.includes("img_panel/roof"));

console.log("asset token handoff ok");
