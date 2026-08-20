// GitHub's release upload API replaces runs of unsupported characters in
// asset names with a single period and strips leading/trailing periods. The
// names used in updater manifest URLs and checksums must match the names
// GitHub stores, or downloads will 404.
export function githubAssetName(name) {
  return name.replace(/[^A-Za-z0-9._@+-]+/g, ".").replace(/^\.+|\.+$/g, "");
}
