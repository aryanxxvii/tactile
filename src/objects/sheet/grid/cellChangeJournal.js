const JOURNAL_LIMIT = 32;

const journals = new WeakMap();

function normalizeCellIds(cellIds) {
  return [...new Set((cellIds || []).map((cellId) => String(cellId)).filter(Boolean))];
}

export function recordCellChanges(cells, cellIds) {
  if (!cells) return;
  const ids = normalizeCellIds(cellIds);
  if (!ids.length) return;

  const previous = journals.get(cells);
  const version = (previous?.version || 0) + 1;
  const history = [...(previous?.history || []), { version, ids }];
  if (history.length > JOURNAL_LIMIT) history.splice(0, history.length - JOURNAL_LIMIT);
  journals.set(cells, { version, history });
}

export function cellChangesSince(cells, version = 0) {
  const journal = journals.get(cells);
  if (!journal) return { version: 0, ids: [] };
  if (journal.version === version) return { version: journal.version, ids: [] };
  if (!Number.isInteger(version) || version < 0) return null;

  const entries = journal.history.filter((entry) => entry.version > version);
  const expectedCount = journal.version - version;
  if (
    entries.length !== expectedCount
    || entries[0]?.version !== version + 1
    || entries.at(-1)?.version !== journal.version
  ) {
    return null;
  }

  return {
    version: journal.version,
    ids: [...new Set(entries.flatMap((entry) => entry.ids))],
  };
}

export function cellChangeVersion(cells) {
  return journals.get(cells)?.version || 0;
}
