export function buildPluginSettingsContributions(definitions, enabledTypes) {
  const contributions = definitions
    .filter((definition) => definition.settings && enabledTypes.has(definition.type))
    .map((definition) => {
      const packageId = definition.package?.id || definition.type;
      const key = `${packageId}:${definition.settings.id}`;
      return Object.freeze({
        ...definition.settings,
        key,
        packageId,
        type: definition.type,
        tabId: `settings-tab-plugin-${key}`,
        panelId: `settings-panel-plugin-${key}`,
      });
    })
    .sort((left, right) => (
      left.order - right.order
      || left.label.localeCompare(right.label)
      || left.key.localeCompare(right.key)
    ));

  const keys = new Set();
  for (const contribution of contributions) {
    if (keys.has(contribution.key)) throw new Error(`Duplicate plugin settings contribution: ${contribution.key}`);
    keys.add(contribution.key);
  }
  return contributions;
}