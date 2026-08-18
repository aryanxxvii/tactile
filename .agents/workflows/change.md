# Change workflow

Use for features, bugs, and refactors.

1. Start from the concrete file, symbol, failure, or nearest implementation.
2. State one falsifiable local hypothesis and one cheap check.
3. Make the smallest grounded edit.
4. Immediately run the narrowest executable validation.
5. If it fails, repair the same slice before expanding scope.
6. Inspect broader callers/tests only when the change crosses their contract.

Preserve public APIs and serialized data unless the task requires a contract change. Add abstractions only when they remove demonstrated complexity or match an existing pattern. Update knowledge/decisions when changing durable boundaries, not for routine implementation details.
