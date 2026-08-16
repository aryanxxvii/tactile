import { IconPlusMinus } from "@tabler/icons-react";
import { createId } from "../../../model.js";
import { defineObjectPlugin } from "../defineObjectPlugin.js";

export const counterPlugin = defineObjectPlugin({
  type: "example-counter",
  label: "Counter",
  description: "A minimal marketplace-ready cell object.",
  icon: IconPlusMinus,
  package: {
    id: "example.counter",
    version: "1.0.0",
  },
  renderer: {
    modulePath: "./CounterObject.jsx",
    load: () => import("./CounterObject.jsx").then((module) => module.CounterObject),
  },
  cell: {
    project: ({ object }) => ({
      displayValue: `Count ${Number(object?.count) || 0}`,
    }),
  },
  create: (options = {}) => ({
    ...options,
    id: options.id || createId("counter"),
    type: "example-counter",
    title: options.title || "Counter",
    description: options.description || "",
    parent: options.parent || null,
    count: Number(options.count) || 0,
  }),
  validate: (object) => {
    const errors = [];
    if (object?.type !== "example-counter") errors.push("Object type must be example-counter.");
    if (!object?.id) errors.push("Object id is required.");
    if (!Number.isFinite(Number(object?.count))) errors.push("Counter value must be numeric.");
    return { valid: errors.length === 0, errors };
  },
  migrate: (object, fallbackId) => ({
    ...object,
    id: object?.id || fallbackId || createId("counter"),
    type: "example-counter",
    count: Number(object?.count) || 0,
  }),
  serialize: (object) => object,
  deserialize: (input) => input,
});

export function installCounterPlugin(install) {
  return install(counterPlugin);
}