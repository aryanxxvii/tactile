import "./CounterObject.css";

export function activate(host) {
  const { React, createId } = host;

  function CounterIcon({ size = 16 }) {
    return React.createElement(
      "span",
      {
        "aria-hidden": "true",
        style: { fontSize: `${size}px`, lineHeight: 1 },
      },
      "#",
    );
  }

  function CounterObject({ object, onUpdateObject, onOpenSettings }) {
    const count = Number(object.count) || 0;
    return React.createElement(
      "article",
      {
        className: "object-surface counter-object",
        "data-object-type": object.type,
      },
      React.createElement(
        "main",
        { className: "counter-workspace" },
        React.createElement(
          "div",
          { className: "counter-panel" },
          React.createElement("h2", null, object.title || "Counter"),
          React.createElement("p", null, `Count ${count}`),
          React.createElement(
            "div",
            { className: "counter-actions", role: "group", "aria-label": "Counter controls" },
            React.createElement(
              "button",
              { type: "button", onClick: () => onUpdateObject({ count: count - 1 }) },
              "Decrease",
            ),
            React.createElement(
              "button",
              { type: "button", onClick: () => onUpdateObject({ count: count + 1 }) },
              "Increase",
            ),
            React.createElement("button", { type: "button", onClick: onOpenSettings }, "Plugins"),
          ),
        ),
      ),
    );
  }

  return {
    type: "example-counter",
    label: "Counter",
    description: "A runtime-installed counter cell object.",
    icon: CounterIcon,
    package: { id: "tactile.example-counter", version: "1.0.0" },
    renderer: { load: async () => CounterObject },
    cell: { project: ({ object }) => ({ displayValue: `Count ${Number(object?.count) || 0}` }) },
    create: (options = {}) => ({
      ...options,
      id: options.id || createId("counter"),
      type: "example-counter",
      title: options.title || "Counter",
      description: options.description || "",
      parent: options.parent || null,
      count: Number(options.count) || 0,
    }),
    validate: (object) => ({
      valid: object?.type === "example-counter" && Number.isFinite(Number(object?.count)),
      errors: [],
    }),
    migrate: (object) => ({ ...object, type: "example-counter", count: Number(object?.count) || 0 }),
    serialize: (object) => object,
    deserialize: (input) => input,
  };
}
