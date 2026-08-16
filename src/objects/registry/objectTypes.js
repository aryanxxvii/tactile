import { getObjectTypeDefinition, listObjectTypeDefinitions } from "./index.js";

export const OBJECT_TYPES = Object.freeze(
  Object.fromEntries(listObjectTypeDefinitions().map((definition) => [definition.type, {
    label: definition.label,
    icon: definition.icon,
  }])),
);

export function objectTypeFor(type) {
  const definition = getObjectTypeDefinition(type);
  return OBJECT_TYPES[definition.type] || {
    label: definition.label,
    icon: definition.icon,
  };
}
