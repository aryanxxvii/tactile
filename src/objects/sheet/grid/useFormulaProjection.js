import { useMemo, useRef } from "react";
import { createFormulaEngine } from "../../../sheet/formulas.js";
import { cellAddress, coordinatesFromCellId } from "../../../sheet/coordinates.js";
import { cellChangeVersion, cellChangesSince } from "./cellChangeJournal.js";

function formulaRelevant(cell) {
  return Boolean(cell?.formula || cell?.value);
}

function formulaInputChanged(previous, cell) {
  return previous?.formula !== cell?.formula || previous?.value !== cell?.value;
}

function addressForCell(id, cell) {
  if (cell?.address) return cell.address;
  const coordinates = coordinatesFromCellId(id);
  return coordinates ? cellAddress(coordinates.row, coordinates.column) : "";
}

function engineSheet(object) {
  return {
    ...object,
    // FormulaEngine.applyChanges mutates its sheet. Keep that private from
    // the render workspace, whose sparse cells map is shared by the editor.
    cells: { ...(object.cells || {}) },
  };
}

function createProjectionState(object) {
  const engine = createFormulaEngine(engineSheet(object));
  const cells = object.cells || {};
  return {
    objectId: object.id,
    cells,
    cellRefs: new Map(Object.entries(cells)),
    journalVersion: cellChangeVersion(cells),
    engine,
    values: engine.getFormulaValues(),
  };
}

function changeForCell(state, cells, id) {
  const previous = state.cellRefs.get(id);
  const cell = cells[id];
  if (previous === cell) return null;
  if (cell) state.cellRefs.set(id, cell);
  else state.cellRefs.delete(id);
  if (!formulaRelevant(previous) && !formulaRelevant(cell)) return null;
  if (!formulaInputChanged(previous, cell)) return null;
  const address = addressForCell(id, cell || previous);
  if (!address) return null;
  return cell ? { address, cell } : { address, delete: true };
}

function changesForCellIds(state, cells, ids) {
  return ids.map((id) => changeForCell(state, cells, id)).filter(Boolean);
}

function fullChangesSinceLastProjection(state, object) {
  const cells = object.cells || {};
  const changes = [];

  for (const [id, cell] of Object.entries(cells)) {
    const previous = state.cellRefs.get(id);
    if (previous === cell) continue;
    state.cellRefs.set(id, cell);
    if (!formulaRelevant(previous) && !formulaRelevant(cell)) continue;
    if (!formulaInputChanged(previous, cell)) continue;
    const address = addressForCell(id, cell || previous);
    if (address) changes.push({ address, cell: cell || null });
  }

  for (const [id, previous] of state.cellRefs) {
    if (Object.prototype.hasOwnProperty.call(cells, id)) continue;
    state.cellRefs.delete(id);
    if (!formulaRelevant(previous)) continue;
    const address = addressForCell(id, previous);
    if (address) changes.push({ address, delete: true });
  }

  return changes;
}

function changesSinceLastProjection(state, object) {
  const cells = object.cells || {};
  if (state.cells === cells) {
    const journal = cellChangesSince(cells, state.journalVersion);
    if (journal) {
      state.journalVersion = journal.version;
      return changesForCellIds(state, cells, journal.ids);
    }
  }

  state.cells = cells;
  state.journalVersion = cellChangeVersion(cells);
  return fullChangesSinceLastProjection(state, object);
}

function updateProjectionState(state, object, changes) {
  if (!changes.length) return;
  state.engine.sheet.rows = object.rows;
  state.engine.sheet.columns = object.columns;
  const calculation = state.engine.applyChanges(changes);
  for (const address of calculation.evaluatedAddresses || []) {
    if (calculation.values.has(address)) state.values.set(address, calculation.values.get(address));
  }
  for (const change of changes) {
    const cell = state.engine.getCell(change.address);
    if (!cell?.formula) state.values.delete(change.address);
  }
}

export function useFormulaProjection(object) {
  const stateRef = useRef(null);
  return useMemo(() => {
    let state = stateRef.current;
    if (!state || state.objectId !== object.id) {
      state = createProjectionState(object);
      stateRef.current = state;
      return state.values;
    }

    const changes = changesSinceLastProjection(state, object);
    updateProjectionState(state, object, changes);
    return state.values;
  }, [object]);
}
