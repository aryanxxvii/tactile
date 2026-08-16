import { createContext, useContext, useMemo, useState, useSyncExternalStore } from "react";
import {
  listObjectTypeDefinitions,
  objectTypeRegistryVersion,
  registerObjectTypeDefinition,
  subscribeObjectTypeDefinitions,
} from "./index.js";

const ObjectPluginContext = createContext(null);

export function ObjectPluginProvider({ children }) {
  useSyncExternalStore(
    subscribeObjectTypeDefinitions,
    objectTypeRegistryVersion,
    objectTypeRegistryVersion,
  );
  const [enabledOverrides, setEnabledOverrides] = useState({});
  const definitions = listObjectTypeDefinitions();
  const enabledTypes = useMemo(() => new Set(
    definitions
      .filter((definition) => enabledOverrides[definition.type] ?? definition.defaultEnabled !== false)
      .map((definition) => definition.type),
  ), [definitions, enabledOverrides]);
  const value = useMemo(() => ({
    definitions,
    enabledTypes,
    activeCreatableDefinitions: definitions.filter((definition) => (
      definition.creatable && enabledTypes.has(definition.type)
    )),
    isEnabled: (type) => enabledTypes.has(type),
    setEnabled: (type, enabled) => setEnabledOverrides((current) => ({
      ...current,
      [type]: Boolean(enabled),
    })),
    install: registerObjectTypeDefinition,
  }), [definitions, enabledTypes]);

  return <ObjectPluginContext.Provider value={value}>{children}</ObjectPluginContext.Provider>;
}

export function useObjectPlugins() {
  const value = useContext(ObjectPluginContext);
  if (!value) throw new Error("useObjectPlugins must be used inside ObjectPluginProvider.");
  return value;
}