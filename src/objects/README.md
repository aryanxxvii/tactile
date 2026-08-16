# Object modules

Object code is organized by ownership:

- `registry/` owns the plugin contract, live session registry, provider, renderer adapter, built-in catalog, and marketplace-ready template.
- `sheet/`, `markdown/`, `code/`, `document/`, `file/`, and `link/` own type-specific expanded UI and behavior.
- Shared shell, persistence, and workspace logic stays outside `objects/`.

Built-ins and downloaded cell-object plugins use the same descriptor contract. Add or change registry behavior in `registry/`; add type-specific rendering code in its object folder or marketplace package. Start new installable types from `registry/template/`.