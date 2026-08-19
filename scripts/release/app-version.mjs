const APP_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(alpha|rc)\.(0|[1-9]\d*))?$/;
const MAX_CHANNEL_BUILD = 9999;

export function parseAppVersion(input) {
  const version = String(input || "").replace(/^v/, "");
  const match = APP_VERSION_PATTERN.exec(version);
  if (!match) {
    throw new Error(`Invalid app version ${input || "<missing>"}; expected X.Y.Z, X.Y.Z-alpha.N, or X.Y.Z-rc.N.`);
  }

  const parsed = {
    version,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    channel: match[4] || null,
    build: match[5] ? Number(match[5]) : null,
  };
  if (parsed.build !== null && (parsed.build < 1 || parsed.build > MAX_CHANNEL_BUILD)) {
    throw new Error(`Prerelease counter must be between 1 and ${MAX_CHANNEL_BUILD}.`);
  }
  return parsed;
}

export function compareAppVersions(leftInput, rightInput) {
  const left = parseAppVersion(leftInput);
  const right = parseAppVersion(rightInput);
  for (const key of ["major", "minor", "patch"]) {
    if (left[key] !== right[key]) return Math.sign(left[key] - right[key]);
  }
  if (left.channel === right.channel) return Math.sign((left.build || 0) - (right.build || 0));
  if (!left.channel) return 1;
  if (!right.channel) return -1;
  return left.channel === "alpha" ? -1 : 1;
}

export function nextAlphaVersion(currentInput, tags = []) {
  const current = parseAppVersion(currentInput);
  let major = current.major;
  let minor = current.minor;
  let patch = current.patch;
  let nextBuild = 1;

  if (!current.channel) {
    patch += 1;
  } else if (current.channel === "alpha") {
    nextBuild = current.build + 1;
  } else {
    throw new Error("Cannot infer an alpha version from an RC; pass an explicit alpha version.");
  }

  const prefix = `${major}.${minor}.${patch}-alpha.`;
  for (const tag of tags) {
    const candidate = String(tag).replace(/^v/, "");
    if (!candidate.startsWith(prefix)) continue;
    const parsed = parseAppVersion(candidate);
    nextBuild = Math.max(nextBuild, parsed.build + 1);
  }
  if (nextBuild > MAX_CHANNEL_BUILD) throw new Error(`Alpha counter exceeds ${MAX_CHANNEL_BUILD}.`);
  return `${major}.${minor}.${patch}-alpha.${nextBuild}`;
}

export function windowsBundleVersion(input) {
  const parsed = parseAppVersion(input);
  if (!parsed.channel) return parsed.version;
  const channelOffset = parsed.channel === "alpha" ? 10000 : 20000;
  return `${parsed.major}.${parsed.minor}.${parsed.patch}-${channelOffset + parsed.build}`;
}

export { MAX_CHANNEL_BUILD };
