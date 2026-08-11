import { createHash } from "node:crypto";
import { mkdir, open, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const FIXTURE_SPEC = Object.freeze({
  format: "tactile",
  version: 4,
  workspaceId: "perf-250k-workspace",
  objectCount: 100,
  usedCellCount: 250_000,
  rootSheetId: "perf-root-sheet",
  rootSheetUsedCellCount: 100_000,
  formulaCount: 25_000,
  conditionalFormatCount: 25,
  nestedEmbedDepth: 5,
  markdownBytes: 250 * 1024,
  assetBytes: 100 * 1024 * 1024,
  assetCount: 10,
  assetBytesPerFile: 10 * 1024 * 1024,
  rootRows: 500,
  rootColumns: 200,
  supportingSheetCount: 5,
  supportingSheetRows: 300,
  supportingSheetColumns: 100,
});

const FIXTURE_TIMESTAMP = "2026-08-11T00:00:00.000Z";
const FORMULA_START_COLUMN = 150;
const FORMULA_END_COLUMN = 199;
const CHAIN_START_COLUMN = 150;
const CHAIN_END_COLUMN = 159;
const FAN_OUT_START_COLUMN = 160;
const FAN_OUT_END_COLUMN = 169;
const RANGE_START_COLUMN = 170;
const RANGE_END_COLUMN = 179;
const LOOKUP_START_COLUMN = 180;
const LOOKUP_END_COLUMN = 189;
const CONDITIONAL_AGGREGATE_START_COLUMN = 190;
const CONDITIONAL_AGGREGATE_END_COLUMN = 199;

function columnLabel(index) {
  let current = index + 1;
  let label = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    current = Math.floor((current - 1) / 26);
  }
  return label;
}

function cellId(row, column) {
  return `r${row + 1}c${column + 1}`;
}

function cellAddress(row, column) {
  return `${columnLabel(column)}${row + 1}`;
}

function createCell(row, column, patch = {}) {
  return {
    id: cellId(row, column),
    address: cellAddress(row, column),
    row,
    column,
    value: "",
    formula: "",
    embed: null,
    ...patch,
  };
}

function isUsedCell(cell) {
  return Boolean(cell?.value || cell?.formula || cell?.embed || cell?.style || cell?.note || cell?.validation);
}

function embeddedLink(type, objectId, title) {
  return `[[tactile:${type}:${objectId}|${title}]]`;
}

function deterministicNumber(row, column, sheetIndex) {
  return String(((row + 1) * (column + 3) * (sheetIndex + 5)) % 997);
}

function rootValue(row, column) {
  if (column === 0) return `Key-${String(row % 32).padStart(2, "0")}`;
  if (column === 1) return String((row + 1) * 3);
  if (column === 2) return String(((row * 7) % 100) / 10);
  if (column === 3) return String((row * 13 + 11) % 97);
  if (column === 4) return row % 2 === 0 ? "active" : "queued";
  if (column === 5) return `Region-${row % 8}`;
  if (column === 6) return String(((row * 11 + 7) % 100) / 100);
  if (column === 7) return `Note ${row % 23}`;
  if (column === 8) return `Artifact-${String(row % 64).padStart(2, "0")}`;
  if (column === 9) return `2026-08-${String((row % 28) + 1).padStart(2, "0")}`;
  return `R${String(row + 1).padStart(3, "0")}C${String(column + 1).padStart(3, "0")}`;
}

function supportValue(row, column, sheetIndex) {
  if (column === 0) return `S${sheetIndex + 1}-${String(row % 48).padStart(2, "0")}`;
  if (column === 1 || column === 2 || column === 3) return deterministicNumber(row, column, sheetIndex);
  if (column === 4) return row % 3 === 0 ? "active" : row % 3 === 1 ? "review" : "queued";
  if (column === 5) return `Owner-${(row + sheetIndex) % 12}`;
  return `S${sheetIndex + 1} R${row + 1} C${column + 1}`;
}

function rangeStyle(row, column, sheetIndex) {
  if (row === 0 && column < 12) {
    return {
      bold: true,
      highlight: "yellow",
      textColor: "accent",
      align: column === 0 ? "left" : "center",
      fontSize: 13,
    };
  }
  if (column === 1 && row % 11 === 0) {
    return { numberFormat: "number", align: "right" };
  }
  if (column === 2 && row % 13 === 0) {
    return { numberFormat: "percent", textColor: "positive" };
  }
  if ((row + column + sheetIndex) % 37 === 0) {
    return { highlight: "mint", align: column % 2 ? "right" : "left" };
  }
  return undefined;
}

function rootFormula(row, column) {
  const rowNumber = row + 1;
  if (column >= CHAIN_START_COLUMN && column <= CHAIN_END_COLUMN) {
    const formulaColumn = columnLabel(column);
    if (row === 0) return `=B${rowNumber + 1}+C${rowNumber + 1}`;
    return `=${formulaColumn}${rowNumber - 1}+B${rowNumber}`;
  }
  if (column >= FAN_OUT_START_COLUMN && column <= FAN_OUT_END_COLUMN) {
    const chainColumn = columnLabel(CHAIN_START_COLUMN + ((column - FAN_OUT_START_COLUMN) % 10));
    const inputColumn = columnLabel(1 + ((column - FAN_OUT_START_COLUMN) % 5));
    return `=${chainColumn}${rowNumber}+${inputColumn}${rowNumber}`;
  }
  if (column >= RANGE_START_COLUMN && column <= RANGE_END_COLUMN) {
    const startRow = Math.max(0, row - 4) + 1;
    const endRow = rowNumber;
    const functionName = column % 2 === 0 ? "SUM" : "AVERAGE";
    return `=${functionName}(B${startRow}:F${endRow})`;
  }
  if (column >= LOOKUP_START_COLUMN && column <= LOOKUP_END_COLUMN) {
    const lookupColumn = 2 + ((column - LOOKUP_START_COLUMN) % 3);
    return `=IFERROR(VLOOKUP(A${rowNumber},$A$1:$D$32,${lookupColumn}),0)`;
  }
  if (column >= CONDITIONAL_AGGREGATE_START_COLUMN && column <= CONDITIONAL_AGGREGATE_END_COLUMN) {
    const suffix = (column - CONDITIONAL_AGGREGATE_START_COLUMN) % 3;
    if (suffix === 0) return `=SUMIF($E$1:$E$32,"active",$B$1:$B$32)`;
    if (suffix === 1) return `=COUNTIF($E$1:$E$32,"active")`;
    return `=SUMIF($E$1:$E$32,"queued",$D$1:$D$32)+COUNTIF($E$1:$E$32,"queued")`;
  }
  return "";
}

function geometryForSheet(id, rows, columns) {
  const rowHeights = {};
  const columnWidths = {};
  for (let row = 0; row < rows; row += 29) rowHeights[row] = 24 + ((row * 7) % 37);
  for (let column = 0; column < columns; column += 11) columnWidths[column] = 76 + ((column * 19) % 170);
  return {
    rowHeight: 31,
    columnWidth: 126,
    rowHeights,
    columnWidths,
    rowGroups: [
      { id: `${id}-rows-a`, start: 6, end: 18, collapsed: true },
      { id: `${id}-rows-b`, start: Math.min(40, rows - 2), end: Math.min(58, rows - 1), collapsed: false },
    ],
    columnGroups: [
      { id: `${id}-columns-a`, start: Math.min(8, columns - 2), end: Math.min(14, columns - 1), collapsed: false },
      { id: `${id}-columns-b`, start: Math.min(24, columns - 2), end: Math.min(31, columns - 1), collapsed: true },
    ],
  };
}

function conditionalRules(id, rows, columns, count) {
  const lastColumn = columnLabel(Math.min(columns - 1, 199));
  return Array.from({ length: count }, (_, index) => {
    const startRow = (index * 17) % Math.max(1, rows - 24);
    const endRow = Math.min(rows - 1, startRow + 23);
    const startColumn = (index * 7) % Math.max(1, columns - 8);
    const endColumn = Math.min(columns - 1, startColumn + 7);
    return {
      id: `${id}-rule-${String(index + 1).padStart(2, "0")}`,
      range: `${cellAddress(startRow, startColumn)}:${cellAddress(endRow, Math.min(endColumn, columnLabelToIndex(lastColumn)))}`,
      kind: "sign",
    };
  });
}

function columnLabelToIndex(label) {
  return (
    String(label)
      .toUpperCase()
      .split("")
      .reduce((value, character) => value * 26 + character.charCodeAt(0) - 64, 0) - 1
  );
}

function makeSheet({ id, title, rows, columns, sheetIndex, formulaMode = false, embedAt }) {
  const cells = {};
  const geometry = geometryForSheet(id, rows, columns);
  const rowGroups = geometry.rowGroups;
  const columnGroups = geometry.columnGroups;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const formula =
        formulaMode && column >= FORMULA_START_COLUMN && column <= FORMULA_END_COLUMN ? rootFormula(row, column) : "";
      const style = rangeStyle(row, column, sheetIndex);
      const embed = embedAt?.(row, column) || null;
      const value = embed
        ? embeddedLink(embed.type, embed.objectId, embed.title)
        : formula
          ? ""
          : formulaMode
            ? rootValue(row, column)
            : supportValue(row, column, sheetIndex);
      const cell = createCell(row, column, {
        value,
        formula,
        embed: embed ? { objectId: embed.objectId, type: embed.type } : null,
        ...(style ? { style } : {}),
      });
      if (row === 1 && column === 7) cell.note = `Deterministic note for ${id}`;
      if (row === 2 && column === 8) cell.validation = { type: "list", values: ["active", "review", "queued"] };
      if (row === 0) cell.role = "heading";
      else if (column === 0) cell.role = "label";
      cells[cell.id] = cell;
    }
  }
  return {
    id,
    type: "sheet",
    title,
    description: `Deterministic performance sheet ${title}.`,
    rows,
    columns,
    cells,
    ...geometry,
    conditionalFormats: [],
    filters: [],
    frozenRows: 1,
    frozenColumns: 1,
  };
}

function makeMarkdownContent(byteLength) {
  const paragraph = [
    "# Tactile performance fixture",
    "",
    "This deterministic local document is intentionally repetitive so the baseline measures a stable 250 KiB Markdown payload without relying on generated timestamps or random content.",
    "",
    "## Operating notes",
    "",
    "The sheet remains the spatial map. Embedded objects are ordinary compact cells, while their content and binary assets remain separate records. This paragraph is repeated only to reach the fixed byte budget.",
    "",
  ].join("\n");
  let text = "";
  let index = 0;
  while (Buffer.byteLength(text, "utf8") < byteLength) {
    text += `${paragraph}Fixture paragraph ${String(index).padStart(5, "0")}.\n\n`;
    index += 1;
  }
  const bytes = Buffer.from(text, "utf8");
  return bytes.subarray(0, byteLength).toString("utf8");
}

function buildObjects() {
  const objects = {};
  const assets = {};
  const layerIds = [
    FIXTURE_SPEC.rootSheetId,
    "perf-layer-1-sheet",
    "perf-layer-2-sheet",
    "perf-layer-3-sheet",
    "perf-layer-4-sheet",
  ];
  const longMarkdownId = "perf-250kb-markdown";
  const supportSheetId = "perf-support-sheet";
  const layerTitles = ["Performance root", "Layer one", "Layer two", "Layer three", "Layer four"];

  layerIds.forEach((id, index) => {
    const child =
      index < layerIds.length - 1
        ? { type: "sheet", objectId: layerIds[index + 1], title: layerTitles[index + 1] }
        : { type: "markdown", objectId: longMarkdownId, title: "250 KiB Markdown" };
    const sheet = makeSheet({
      id,
      title: layerTitles[index],
      rows: index === 0 ? FIXTURE_SPEC.rootRows : FIXTURE_SPEC.supportingSheetRows,
      columns: index === 0 ? FIXTURE_SPEC.rootColumns : FIXTURE_SPEC.supportingSheetColumns,
      sheetIndex: index,
      formulaMode: index === 0,
      embedAt: (row, column) => {
        if (row === 0 && column === 0) return child;
        if (row === 1 && column === 1 && index === 0) {
          return { type: "image", objectId: "perf-asset-object-01", title: "Asset image 01" };
        }
        return null;
      },
    });
    const rules = index === 0 ? 10 : 3;
    sheet.conditionalFormats = conditionalRules(id, sheet.rows, sheet.columns, rules);
    sheet.filters =
      index === 0
        ? [{ id: `${id}-filter-status`, column: 4, value: "active" }]
        : [{ id: `${id}-filter-owner`, column: 5, value: `Owner-${index}` }];
    objects[id] = sheet;
  });

  const supportSheet = makeSheet({
    id: supportSheetId,
    title: "Support data",
    rows: FIXTURE_SPEC.supportingSheetRows,
    columns: FIXTURE_SPEC.supportingSheetColumns,
    sheetIndex: 5,
    embedAt: (row, column) => {
      if (row === 0 && column === 0) return { type: "markdown", objectId: longMarkdownId, title: "250 KiB Markdown" };
      if (row === 2 && column === 2)
        return { type: "image", objectId: "perf-asset-object-02", title: "Asset image 02" };
      return null;
    },
  });
  supportSheet.conditionalFormats = conditionalRules(supportSheetId, supportSheet.rows, supportSheet.columns, 3);
  supportSheet.filters = [{ id: `${supportSheetId}-filter-status`, column: 4, value: "active" }];
  objects[supportSheetId] = supportSheet;

  objects[longMarkdownId] = {
    id: longMarkdownId,
    type: "markdown",
    title: "250 KiB Markdown",
    description: "Fixed-size Markdown payload for document baseline measurements.",
    content: makeMarkdownContent(FIXTURE_SPEC.markdownBytes),
  };

  const assetTypes = ["image", "pdf", "video", "html", "svg"];
  for (let index = 0; index < FIXTURE_SPEC.assetCount; index += 1) {
    const serial = String(index + 1).padStart(2, "0");
    const objectId = `perf-asset-object-${serial}`;
    const assetId = `perf-asset-${serial}`;
    const extension = assetTypes[index % assetTypes.length] === "image" ? "bin" : assetTypes[index % assetTypes.length];
    const mime =
      assetTypes[index % assetTypes.length] === "image"
        ? "application/octet-stream"
        : `application/x-tactile-${assetTypes[index % assetTypes.length]}`;
    const relativePath = `assets/${assetId}.${extension}`;
    assets[assetId] = {
      id: assetId,
      fileName: `${assetId}.${extension}`,
      extension,
      mime,
      size: FIXTURE_SPEC.assetBytesPerFile,
      relativePath,
      generatedSeed: index + 1,
    };
    objects[objectId] = {
      id: objectId,
      type: assetTypes[index % assetTypes.length],
      title: `Asset ${serial}`,
      description: `Deterministic ${FIXTURE_SPEC.assetBytesPerFile} byte binary asset.`,
      assetId,
      source: "",
    };
  }

  let serial = 1;
  while (Object.keys(objects).length < FIXTURE_SPEC.objectCount) {
    const id = `perf-text-${String(serial).padStart(3, "0")}`;
    objects[id] = {
      id,
      type: "markdown",
      title: `Text ${String(serial).padStart(3, "0")}`,
      description: "Small deterministic text object.",
      content: `## Text ${serial}\n\nLocal fixture object ${serial}.\n`,
    };
    serial += 1;
  }

  return { objects, assets };
}

export function createPerformanceWorkspace() {
  const { objects, assets } = buildObjects();
  return {
    format: FIXTURE_SPEC.format,
    version: FIXTURE_SPEC.version,
    id: FIXTURE_SPEC.workspaceId,
    name: "Tactile Performance 250K",
    homeObjectId: FIXTURE_SPEC.rootSheetId,
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
    objects,
    assets,
    themes: {},
    activeThemeId: "paper-public",
    settings: {
      reduceMotion: false,
      openSingleClick: "floating",
      openDoubleClick: "full",
    },
  };
}

function countUsedCells(workspace) {
  return Object.values(workspace.objects || {}).reduce((total, object) => {
    if (object.type !== "sheet") return total;
    return total + Object.values(object.cells || {}).filter(isUsedCell).length;
  }, 0);
}

function countFormulas(workspace) {
  return Object.values(workspace.objects || {}).reduce((total, object) => {
    if (object.type !== "sheet") return total;
    return total + Object.values(object.cells || {}).filter((cell) => Boolean(cell.formula)).length;
  }, 0);
}

function maxEmbedDepth(workspace) {
  const visiting = new Set();
  const memo = new Map();
  const depthFor = (objectId) => {
    if (memo.has(objectId)) return memo.get(objectId);
    if (visiting.has(objectId)) throw new Error(`Embedded-object cycle detected at ${objectId}`);
    visiting.add(objectId);
    const object = workspace.objects?.[objectId];
    let depth = 0;
    if (object?.type === "sheet") {
      for (const cell of Object.values(object.cells || {})) {
        if (cell.embed?.objectId) depth = Math.max(depth, 1 + depthFor(cell.embed.objectId));
      }
    }
    visiting.delete(objectId);
    memo.set(objectId, depth);
    return depth;
  };
  return Math.max(0, ...Object.keys(workspace.objects || {}).map(depthFor));
}

function formulaShapeCounts(workspace) {
  const formulas = Object.values(workspace.objects || {})
    .filter((object) => object.type === "sheet")
    .flatMap((object) =>
      Object.values(object.cells || {})
        .map((cell) => cell.formula)
        .filter(Boolean),
    );
  return {
    chains: formulas.filter((formula) => /\$?[A-Z]{2,}\d+\+B\d+/.test(formula)).length,
    fanOut: formulas.filter((formula) => /^(?:=[A-Z]{2,}\d+\+[A-Z]+\d+)$/.test(formula)).length,
    ranges: formulas.filter((formula) => /[A-Z]+\d+:[A-Z]+\d+/.test(formula)).length,
    lookups: formulas.filter((formula) => /(?:VLOOKUP|INDEX|MATCH)/.test(formula)).length,
    conditionalAggregates: formulas.filter((formula) => /(?:SUMIF|COUNTIF)/.test(formula)).length,
  };
}

export function validatePerformanceWorkspace(workspace) {
  const root = workspace?.objects?.[FIXTURE_SPEC.rootSheetId];
  const sheetObjects = Object.values(workspace?.objects || {}).filter((object) => object.type === "sheet");
  const markdown = workspace?.objects?.["perf-250kb-markdown"];
  const conditionalFormatCount = sheetObjects.reduce(
    (total, object) => total + (object.conditionalFormats || []).length,
    0,
  );
  const styleCellCount = sheetObjects.reduce(
    (total, object) => total + Object.values(object.cells || {}).filter((cell) => cell.style).length,
    0,
  );
  const embedCellCount = sheetObjects.reduce(
    (total, object) => total + Object.values(object.cells || {}).filter((cell) => cell.embed).length,
    0,
  );
  const assetBytes = Object.values(workspace?.assets || {}).reduce(
    (total, asset) => total + Number(asset.size || 0),
    0,
  );
  const formulaShapes = formulaShapeCounts(workspace);
  const checks = {
    format: workspace?.format === FIXTURE_SPEC.format,
    version: workspace?.version === FIXTURE_SPEC.version,
    objectCount: Object.keys(workspace?.objects || {}).length === FIXTURE_SPEC.objectCount,
    usedCellCount: countUsedCells(workspace) === FIXTURE_SPEC.usedCellCount,
    rootSheetUsedCellCount:
      root && Object.values(root.cells || {}).filter(isUsedCell).length === FIXTURE_SPEC.rootSheetUsedCellCount,
    formulaCount: countFormulas(workspace) === FIXTURE_SPEC.formulaCount,
    formulaShapes:
      formulaShapes.chains > 0 &&
      formulaShapes.fanOut > 0 &&
      formulaShapes.ranges > 0 &&
      formulaShapes.lookups > 0 &&
      formulaShapes.conditionalAggregates > 0,
    conditionalFormatCount: conditionalFormatCount === FIXTURE_SPEC.conditionalFormatCount,
    nestedEmbedDepth: maxEmbedDepth(workspace) === FIXTURE_SPEC.nestedEmbedDepth,
    markdownBytes: Buffer.byteLength(markdown?.content || "", "utf8") === FIXTURE_SPEC.markdownBytes,
    assetBytes: assetBytes === FIXTURE_SPEC.assetBytes,
    mixedGeometry:
      sheetObjects.some((object) => Object.keys(object.rowHeights || {}).length > 0) &&
      sheetObjects.some((object) => Object.keys(object.columnWidths || {}).length > 0),
    groups: sheetObjects.every((object) => object.rowGroups?.length && object.columnGroups?.length),
    filters: sheetObjects.every((object) => object.filters?.length),
    formattedRanges: styleCellCount > 0,
    embeddedCells: embedCellCount >= FIXTURE_SPEC.nestedEmbedDepth,
  };
  const counts = {
    objects: Object.keys(workspace?.objects || {}).length,
    sheets: sheetObjects.length,
    usedCells: countUsedCells(workspace),
    rootUsedCells: root ? Object.values(root.cells || {}).filter(isUsedCell).length : 0,
    formulas: countFormulas(workspace),
    formulaShapes,
    conditionalFormats: conditionalFormatCount,
    maxEmbedDepth: maxEmbedDepth(workspace),
    markdownBytes: Buffer.byteLength(markdown?.content || "", "utf8"),
    assetBytes,
    assets: Object.keys(workspace?.assets || {}).length,
    styledCells: styleCellCount,
    embeddedCells: embedCellCount,
  };
  return {
    valid: Object.values(checks).every(Boolean),
    checks,
    counts,
  };
}

export function fixtureFingerprint(workspace) {
  return createHash("sha256").update(JSON.stringify(workspace)).digest("hex");
}

async function writeDeterministicAsset(filePath, byteLength, seed) {
  const handle = await open(filePath, "w");
  const hash = createHash("sha256");
  const chunkSize = 1024 * 1024;
  const chunk = Buffer.allocUnsafe(chunkSize);
  try {
    for (let offset = 0; offset < byteLength; offset += chunkSize) {
      const length = Math.min(chunkSize, byteLength - offset);
      for (let index = 0; index < length; index += 1) {
        chunk[index] = (seed * 17 + (offset + index) * 31 + Math.floor((offset + index) / 251)) & 0xff;
      }
      const data = chunk.subarray(0, length);
      hash.update(data);
      await handle.write(data, 0, length, offset);
    }
  } finally {
    await handle.close();
  }
  return hash.digest("hex");
}

export async function writePerformanceFixture({ outputDir, writeAssets = false } = {}) {
  if (!outputDir) throw new Error("writePerformanceFixture requires an outputDir.");
  const resolvedOutput = path.resolve(outputDir);
  const assetDirectory = path.join(resolvedOutput, "assets");
  const objectDirectory = path.join(resolvedOutput, "objects", "perf-250kb-markdown");
  await mkdir(assetDirectory, { recursive: true });
  await mkdir(objectDirectory, { recursive: true });

  const workspace = createPerformanceWorkspace();
  const validation = validatePerformanceWorkspace(workspace);
  if (!validation.valid) throw new Error(`Generated fixture failed validation: ${JSON.stringify(validation)}`);

  const assetHashes = {};
  for (const asset of Object.values(workspace.assets)) {
    if (writeAssets) {
      assetHashes[asset.id] = await writeDeterministicAsset(
        path.join(resolvedOutput, asset.relativePath),
        asset.size,
        asset.generatedSeed,
      );
    }
  }

  const markdown = workspace.objects["perf-250kb-markdown"].content;
  await writeFile(path.join(objectDirectory, "content.md"), markdown, "utf8");
  await writeFile(path.join(resolvedOutput, "fixture.json"), JSON.stringify(workspace), "utf8");
  const manifest = {
    format: "tactile-performance-fixture",
    spec: FIXTURE_SPEC,
    generatedAt: FIXTURE_TIMESTAMP,
    fixtureFile: "fixture.json",
    markdownFile: "objects/perf-250kb-markdown/content.md",
    assetsMaterialized: writeAssets,
    assetHashes,
    workspaceFingerprint: fixtureFingerprint(workspace),
    validation,
  };
  await writeFile(path.join(resolvedOutput, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { outputDir: resolvedOutput, workspace, manifest };
}

function parseArgs(argv) {
  const args = { outputDir: "benchmarks/.generated/tactile-250k", writeAssets: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--output") args.outputDir = argv[++index];
    else if (argv[index] === "--materialize-assets") args.writeAssets = true;
    else if (argv[index] === "--skip-assets") args.writeAssets = false;
    else if (argv[index] === "--help") args.help = true;
  }
  return args;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log("Usage: node benchmarks/generate-fixture.mjs [--output <directory>] [--materialize-assets]");
  } else {
    const result = await writePerformanceFixture(args);
    console.log(
      JSON.stringify(
        {
          outputDir: result.outputDir,
          assetsMaterialized: result.manifest.assetsMaterialized,
          workspaceFingerprint: result.manifest.workspaceFingerprint,
          counts: result.manifest.validation.counts,
        },
        null,
        2,
      ),
    );
  }
}
