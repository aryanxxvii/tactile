import {
  cellAddress as cellAddressRuntime,
  cellId as cellIdRuntime,
  columnLabel as columnLabelRuntime,
  coordinatesFromAddress as coordinatesFromAddressRuntime,
  coordinatesFromCellId as coordinatesFromCellIdRuntime,
  moveAddress as moveAddressRuntime,
} from "../sheet/coordinates.js";
import type { CellAddress } from "./ids.ts";
import {
  asCellAddress,
  asCellId,
  asColumnIndex,
  asColumnLabel,
  asRowIndex,
  type CellId,
  type ColumnIndex,
  type ColumnLabel,
  type RowIndex,
} from "./ids.ts";

export interface CellCoordinates {
  row: RowIndex;
  column: ColumnIndex;
}

export function columnLabel(index: ColumnIndex | number): ColumnLabel {
  return asColumnLabel(columnLabelRuntime(Number(index)));
}

export function cellId(row: RowIndex | number, column: ColumnIndex | number): CellId {
  return asCellId(cellIdRuntime(Number(row), Number(column)));
}

export function coordinatesFromCellId(id: CellId | string): CellCoordinates | null {
  const coordinates = coordinatesFromCellIdRuntime(String(id));
  return coordinates ? { row: asRowIndex(coordinates.row), column: asColumnIndex(coordinates.column) } : null;
}

export function cellAddress(row: RowIndex | number, column: ColumnIndex | number): CellAddress {
  return asCellAddress(cellAddressRuntime(Number(row), Number(column)));
}

export function coordinatesFromAddress(address: CellAddress | string): CellCoordinates | null {
  const coordinates = coordinatesFromAddressRuntime(String(address));
  return coordinates ? { row: asRowIndex(coordinates.row), column: asColumnIndex(coordinates.column) } : null;
}

export function moveAddress(
  address: CellAddress | string,
  rowDelta: number,
  columnDelta: number,
  rows: number,
  columns: number,
): CellAddress {
  return asCellAddress(moveAddressRuntime(String(address), rowDelta, columnDelta, rows, columns));
}
