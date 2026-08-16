import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  listObjectTypeDefinitions,
  objectTypeRegistryVersion,
  registerObjectTypeDefinition,
  subscribeObjectTypeDefinitions,
} from "./index.js";
import {
  activatePluginSource,
  deleteInstalledPlugin,
  downloadMarketplacePlugin,
  fetchMarketplaceCatalog,
  readInstalledPlugins,
  writeInstalledPlugin,
} from "./marketplace.js";
import { pluginHostServices } from "./pluginHostServices.jsx";

const ObjectPluginContext = createContext(null);

export function ObjectPluginProvider({ children }) {
  useSyncExternalStore(
    subscribeObjectTypeDefinitions,
    objectTypeRegistryVersion,
    objectTypeRegistryVersion,
  );
  const [enabledOverrides, setEnabledOverrides] = useState({});
  const [catalog, setCatalog] = useState([]);
  const [installed, setInstalled] = useState({});
  const [marketplaceState, setMarketplaceState] = useState("loading");
  const [marketplaceError, setMarketplaceError] = useState("");
  const uninstallersRef = useRef(new Map());

  const activateRecord = async (record) => {
    const activation = await activatePluginSource(record.source, record, pluginHostServices);
    uninstallersRef.current.get(record.packageId)?.();
    const unregister = registerObjectTypeDefinition(activation.definition);
    uninstallersRef.current.set(record.packageId, () => {
      unregister();
      activation.dispose();
    });
    return activation.definition;
  };

  useEffect(() => {
    let current = true;
    Promise.all([
      readInstalledPlugins().catch(() => []),
      fetchMarketplaceCatalog().catch(() => ({ plugins: [] })),
    ]).then(async ([records, nextCatalog]) => {
      if (!current) return;
      const restored = {};
      for (const record of records) {
        if (!current) return;
        try {
          if (record.enabled !== false) await activateRecord(record);
          restored[record.packageId] = record;
        } catch (error) {
          restored[record.packageId] = { ...record, error: error?.message || String(error) };
        }
      }
      if (!current) return;
      setInstalled(restored);
      setCatalog(nextCatalog.plugins || []);
      setMarketplaceState("ready");
    });
    return () => {
      current = false;
      uninstallersRef.current.forEach((uninstall) => uninstall());
      uninstallersRef.current.clear();
    };
  }, []);
  const allDefinitions = listObjectTypeDefinitions();
  const definitions = allDefinitions.filter((definition) => definition.manageInSettings !== false);
  const enabledTypes = useMemo(() => new Set(
    allDefinitions
      .filter((definition) => enabledOverrides[definition.type] ?? definition.defaultEnabled !== false)
      .map((definition) => definition.type),
  ), [allDefinitions, enabledOverrides]);
  const value = useMemo(() => ({
    definitions,
    enabledTypes,
    activeCreatableDefinitions: allDefinitions.filter((definition) => (
      definition.creatable && enabledTypes.has(definition.type)
    )),
    isEnabled: (type) => enabledTypes.has(type),
    setEnabled: (type, enabled) => setEnabledOverrides((current) => ({
      ...current,
      [type]: Boolean(enabled),
    })),
    install: registerObjectTypeDefinition,
    catalog,
    installed,
    marketplaceState,
    marketplaceError,
    refreshCatalog: async () => {
      setMarketplaceState("loading");
      setMarketplaceError("");
      try {
        const next = await fetchMarketplaceCatalog();
        setCatalog(next.plugins);
        setMarketplaceState("ready");
      } catch (error) {
        setMarketplaceError(error?.message || String(error));
        setMarketplaceState("error");
      }
    },
    installFromMarketplace: async (entry) => {
      setMarketplaceError("");
      try {
        const downloaded = await downloadMarketplacePlugin(entry);
        await activateRecord({ ...entry, ...downloaded });
        const record = { ...entry, ...downloaded, enabled: true, installedAt: new Date().toISOString() };
        await writeInstalledPlugin(record);
        setInstalled((current) => ({ ...current, [entry.packageId]: record }));
      } catch (error) {
        setMarketplaceError(error?.message || String(error));
      }
    },
    setInstalledEnabled: async (packageId, enabled) => {
      const record = installed[packageId];
      if (!record) return;
      if (enabled) await activateRecord(record);
      else {
        uninstallersRef.current.get(packageId)?.();
        uninstallersRef.current.delete(packageId);
      }
      const next = { ...record, enabled };
      await writeInstalledPlugin(next);
      setInstalled((current) => ({ ...current, [packageId]: next }));
    },
    uninstallMarketplacePlugin: async (packageId) => {
      uninstallersRef.current.get(packageId)?.();
      uninstallersRef.current.delete(packageId);
      await deleteInstalledPlugin(packageId);
      setInstalled((current) => {
        const next = { ...current };
        delete next[packageId];
        return next;
      });
    },
  }), [allDefinitions, catalog, definitions, enabledTypes, installed, marketplaceError, marketplaceState]);

  return <ObjectPluginContext.Provider value={value}>{children}</ObjectPluginContext.Provider>;
}

export function useObjectPlugins() {
  const value = useContext(ObjectPluginContext);
  if (!value) throw new Error("useObjectPlugins must be used inside ObjectPluginProvider.");
  return value;
}