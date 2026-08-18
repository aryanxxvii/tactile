import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const releaseDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(releaseDirectory, "..", "..");
const outputDirectory = path.join(repositoryRoot, "evidence", "release");
const npmLockPath = "package-lock.json";
const cargoLockPath = "src-tauri/Cargo.lock";

function bytes(relativePath) {
  return readFileSync(path.join(repositoryRoot, relativePath));
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function run(command, args, cwd, label) {
  const usesWindowsCommandShell = process.platform === "win32" && command === "npm";
  const executable = usesWindowsCommandShell ? process.env.ComSpec || "cmd.exe" : command;
  const commandArgs = usesWindowsCommandShell ? ["/d", "/s", "/c", [command, ...args].join(" ")] : args;
  const result = spawnSync(executable, commandArgs, {
    cwd,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    windowsVerbatimArguments: usesWindowsCommandShell,
    env: { ...process.env, NPM_CONFIG_FUND: "false", NPM_CONFIG_UPDATE_NOTIFIER: "false" },
  });
  if (result.error) throw new Error(`${label} failed to start: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${label} failed (${result.status}):\n${result.stderr || result.stdout}`);
  return result.stdout;
}

function commandJson(output, label) {
  const start = output.indexOf("{");
  if (start < 0) throw new Error(`${label} did not emit JSON`);
  try {
    return JSON.parse(output.slice(start));
  } catch (error) {
    throw new Error(`${label} emitted invalid JSON: ${error.message}`);
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stable(value[key])]),
  );
}

function writeJson(fileName, value) {
  writeFileSync(path.join(outputDirectory, fileName), `${JSON.stringify(stable(value), null, 2)}\n`, "utf8");
}

function serial(namespace, lockHash) {
  const value = hash(Buffer.from(`${namespace}:${lockHash}`));
  return `urn:uuid:${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20, 32)}`;
}

function sourceProperties(lockfile, lockHash) {
  return [
    { name: "tactile:source-lockfile", value: lockfile },
    { name: "tactile:source-lockfile-sha256", value: lockHash },
    { name: "tactile:generated-by", value: "scripts/release/generate-inventory.mjs" },
  ];
}

function directNpmDependencies(lock) {
  return new Map([
    ...Object.keys(lock.packages[""].dependencies || {}).map((name) => [name, "runtime"]),
    ...Object.keys(lock.packages[""].devDependencies || {}).map((name) => [name, "development"]),
  ]);
}

function normalizeNpmSbom(sbom, lockHash, directDependencies) {
  const metadata = { ...(sbom.metadata || {}) };
  delete metadata.timestamp;
  metadata.properties = [
    ...(metadata.properties || []).filter((property) => !String(property.name || "").startsWith("tactile:")),
    ...sourceProperties(npmLockPath, lockHash),
  ];
  const components = [...(sbom.components || [])]
    .map((component) => {
      const direct = directDependencies.get(component.name);
      if (!direct) return component;
      return {
        ...component,
        properties: [
          ...(component.properties || []).filter((property) => property.name !== "tactile:direct"),
          { name: "tactile:direct", value: direct },
        ],
      };
    })
    .sort((left, right) => String(left["bom-ref"] || "").localeCompare(String(right["bom-ref"] || "")));
  return { ...sbom, serialNumber: serial("npm", lockHash), metadata, components };
}

function cargoChecksums(lockText) {
  const result = new Map();
  for (const block of lockText.split(/\n\[\[package\]\]\n/).slice(1)) {
    const name = block.match(/^name = "([^"]+)"$/m)?.[1];
    const version = block.match(/^version = "([^"]+)"$/m)?.[1];
    const checksum = block.match(/^checksum = "([^"]+)"$/m)?.[1];
    if (name && version && checksum) result.set(`${name}@${version}`, checksum);
  }
  return result;
}

function cargoPurl(name, version) {
  return `pkg:cargo/${name}@${version}`;
}

function createCargoSbom(metadata, lockHash, lockText) {
  const packages = (metadata.packages || []).filter((pkg) => pkg.source);
  const root = (metadata.packages || []).find((pkg) => !pkg.source && pkg.name === "tactile");
  const direct = new Map(
    (root?.dependencies || []).map((dependency) => [dependency.name, dependency.kind || "normal"]),
  );
  const checksums = cargoChecksums(lockText);
  const refById = new Map(packages.map((pkg) => [pkg.id, cargoPurl(pkg.name, pkg.version)]));
  const components = packages
    .map((pkg) => {
      const ref = cargoPurl(pkg.name, pkg.version);
      const component = {
        "bom-ref": ref,
        type: "library",
        name: pkg.name,
        version: pkg.version,
        scope: direct.has(pkg.name) ? "required" : "optional",
        purl: ref,
        externalReferences: pkg.repository ? [{ type: "vcs", url: pkg.repository }] : [],
      };
      const checksum = checksums.get(`${pkg.name}@${pkg.version}`);
      if (checksum) component.hashes = [{ alg: "SHA-256", content: checksum }];
      if (pkg.license) component.licenses = [{ license: { expression: pkg.license } }];
      if (direct.has(pkg.name)) component.properties = [{ name: "tactile:direct", value: direct.get(pkg.name) }];
      return component;
    })
    .sort((left, right) => String(left["bom-ref"]).localeCompare(String(right["bom-ref"])));
  const dependencies = (metadata.resolve?.nodes || [])
    .filter((node) => refById.has(node.id))
    .map((node) => ({
      ref: refById.get(node.id),
      dependsOn: [...new Set((node.dependencies || []).map((id) => refById.get(id)).filter(Boolean))].sort(),
    }))
    .sort((left, right) => left.ref.localeCompare(right.ref));
  const name = root?.name || "tactile-native";
  const version = root?.version || "0.0.0";
  return {
    $schema: "http://cyclonedx.org/schema/bom-1.5.schema.json",
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    serialNumber: serial("cargo", lockHash),
    version: 1,
    metadata: {
      lifecycles: [{ phase: "pre-build" }],
      properties: sourceProperties(cargoLockPath, lockHash),
      component: { "bom-ref": `pkg:generic/${name}@${version}`, type: "application", name, version },
    },
    components,
    dependencies,
  };
}

function licenses(component) {
  return (component.licenses || [])
    .map((entry) => entry.license || {})
    .map((license) => license.id || license.expression || license.name)
    .filter(Boolean)
    .sort();
}

function createInventory(npmSbom, cargoSbom, npmHash, cargoHash, npmLock, cargoMetadata) {
  const directNpm = directNpmDependencies(npmLock);
  const npm = (npmSbom.components || []).map((component) => ({
    ecosystem: "npm",
    name: component.name,
    version: component.version,
    purl: component.purl,
    direct: directNpm.get(component.name) || null,
    licenseEvidence: licenses(component),
    hashes: component.hashes || [],
    source: component.externalReferences?.find((reference) => reference.type === "distribution")?.url || null,
  }));
  const cargo = (cargoSbom.components || []).map((component) => ({
    ecosystem: "cargo",
    name: component.name,
    version: component.version,
    purl: component.purl,
    direct: component.properties?.find((property) => property.name === "tactile:direct")?.value || null,
    licenseEvidence: licenses(component),
    hashes: component.hashes || [],
    source: component.externalReferences?.find((reference) => reference.type === "vcs")?.url || null,
  }));
  const components = [...npm, ...cargo].sort(
    (left, right) =>
      left.ecosystem.localeCompare(right.ecosystem) ||
      left.name.localeCompare(right.name) ||
      left.version.localeCompare(right.version),
  );
  const summary = (selected) => ({
    components: selected.length,
    direct: selected.filter((component) => component.direct).length,
    withLicenseEvidence: selected.filter((component) => component.licenseEvidence.length > 0).length,
    withoutLicenseEvidence: selected.filter((component) => component.licenseEvidence.length === 0).length,
  });
  return {
    schema: "tactile.third-party-inventory",
    schemaVersion: 1,
    source: {
      packageLock: { path: npmLockPath, sha256: npmHash, lockfileVersion: npmLock.lockfileVersion },
      cargoLock: { path: cargoLockPath, sha256: cargoHash },
      commands: [
        "npm sbom --package-lock-only --sbom-format cyclonedx --sbom-type application",
        "cargo metadata --format-version 1 --locked",
      ],
    },
    summary: {
      npm: summary(npm),
      cargo: summary(cargo),
      total: components.length,
    },
    components,
    notes: [
      "License evidence is copied from npm SBOM metadata and cargo metadata; it is not a legal conclusion.",
      "The repository has no evidenced project license or complete third-party license-text bundle.",
      "Re-run this generator after either lockfile changes and complete owner/legal review before distribution.",
      `Cargo package count is derived from cargo metadata for ${cargoMetadata.packages?.length || 0} resolved packages; local workspace packages are excluded from third-party components.`,
    ],
  };
}

function inventoryMarkdown(inventory) {
  const { npm, cargo } = inventory.summary;
  const missing = inventory.components.filter((component) => component.licenseEvidence.length === 0);
  const missingLines = missing.length
    ? missing.map((component) => `- ${component.ecosystem}: ${component.name}@${component.version}`)
    : ["- None reported by the generators."];
  return [
    "# Third-party inventory",
    "",
    "<!-- Generated by scripts/release/generate-inventory.mjs. Do not edit this file directly. -->",
    "",
    "This inventory is a reproducible snapshot of the committed JavaScript and Rust dependency lockfiles. It is an engineering inventory, not a legal opinion or a substitute for collecting and reviewing license texts.",
    "",
    "## Snapshot",
    "",
    "| Ecosystem | Components | Direct | License evidence | Missing license evidence |",
    "| --- | ---: | ---: | ---: | ---: |",
    `| npm | ${npm.components} | ${npm.direct} | ${npm.withLicenseEvidence} | ${npm.withoutLicenseEvidence} |`,
    `| Cargo | ${cargo.components} | ${cargo.direct} | ${cargo.withLicenseEvidence} | ${cargo.withoutLicenseEvidence} |`,
    `| Total | ${inventory.summary.total} | ${npm.direct + cargo.direct} | ${npm.withLicenseEvidence + cargo.withLicenseEvidence} | ${npm.withoutLicenseEvidence + cargo.withoutLicenseEvidence} |`,
    "",
    "Source hashes are recorded in third-party-inventory.json, sbom-npm.cdx.json, and sbom-cargo.cdx.json. The generator deliberately omits wall-clock timestamps and derives SBOM serial numbers from the lockfile hashes.",
    "",
    "## License posture",
    "",
    "- npm license IDs come from the npm-generated CycloneDX SBOM; Cargo license expressions come from cargo metadata. Both are evidence fields only and require legal review against the actual distributed artifacts.",
    "- License text, attribution notices, and the project's own license are not supplied by this packet. An owner/legal decision is required before any public or commercial distribution.",
    "- Components without license evidence must be resolved or explicitly accepted by the legal owner before release:",
    "",
    ...missingLines,
    "",
    "## Re-generation",
    "",
    "From the repository root, run:",
    "",
    "```text",
    "node scripts/release/generate-inventory.mjs",
    "```",
    "",
    "The command reads package-lock.json and src-tauri/Cargo.lock, runs the pinned package-manager SBOM command and locked Cargo metadata query, and writes only the four generated artifacts in evidence/release/.",
    "",
  ].join("\n");
}

const npmBytes = bytes(npmLockPath);
const cargoBytes = bytes(cargoLockPath);
const npmHash = hash(npmBytes);
const cargoHash = hash(cargoBytes);
const npmLock = JSON.parse(npmBytes.toString("utf8"));
const npmSbom = normalizeNpmSbom(
  commandJson(
    run(
      "npm",
      ["sbom", "--package-lock-only", "--sbom-format", "cyclonedx", "--sbom-type", "application"],
      repositoryRoot,
      "npm SBOM",
    ),
    "npm SBOM",
  ),
  npmHash,
  directNpmDependencies(npmLock),
);
const cargoMetadata = commandJson(
  run(
    "cargo",
    ["metadata", "--format-version", "1", "--locked"],
    path.join(repositoryRoot, "src-tauri"),
    "Cargo metadata",
  ),
  "Cargo metadata",
);
const cargoSbom = createCargoSbom(cargoMetadata, cargoHash, cargoBytes.toString("utf8"));
const inventory = createInventory(npmSbom, cargoSbom, npmHash, cargoHash, npmLock, cargoMetadata);

writeJson("sbom-npm.cdx.json", npmSbom);
writeJson("sbom-cargo.cdx.json", cargoSbom);
writeJson("third-party-inventory.json", inventory);
writeFileSync(path.join(outputDirectory, "third-party-inventory.md"), inventoryMarkdown(inventory), "utf8");

console.log(`Generated npm components: ${inventory.summary.npm.components}`);
console.log(`Generated Cargo components: ${inventory.summary.cargo.components}`);
console.log(`package-lock.json SHA-256: ${npmHash}`);
console.log(`src-tauri/Cargo.lock SHA-256: ${cargoHash}`);
