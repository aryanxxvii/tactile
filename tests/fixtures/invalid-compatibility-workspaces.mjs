function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export const SMALL_ASSET_LIMITS = Object.freeze({
  maxAssetBytes: 8,
  maxTotalAssetBytes: 16,
});

export function makeMalformedFixture() {
  return {
    version: 4,
    id: "ws-malformed",
    name: "Malformed compatibility fixture",
  };
}

export function makeOversizedAssetFixture(goldenV4) {
  const fixture = clone(goldenV4);
  fixture.assets["asset-ref"] = {
    ...fixture.assets["asset-ref"],
    size: SMALL_ASSET_LIMITS.maxAssetBytes + 1,
  };
  return fixture;
}

export function makeDuplicateObjectIdFixture(goldenV4) {
  const fixture = clone(goldenV4);
  const home = fixture.objects["sheet-home"];
  fixture.objects = [home, { ...home, title: "Duplicate Home" }];
  return fixture;
}

export function makeDanglingReferenceFixture(goldenV4) {
  const fixture = clone(goldenV4);
  const cell = fixture.objects["sheet-home"].cells.r2c2;
  cell.value = "[[tactile:markdown:object-missing|Missing object]]";
  cell.embed = {
    objectId: "object-missing",
    type: "markdown",
    title: "Missing object",
  };
  return fixture;
}

export function makeUnsupportedVersionFixture(goldenV4) {
  const fixture = clone(goldenV4);
  fixture.version = 5;
  fixture["x-future-workspace-field"] = {
    untouched: true,
  };
  return fixture;
}
