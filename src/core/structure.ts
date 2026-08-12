import {
  adjustAxisGroups as adjustAxisGroupsRuntime,
  adjustColumnFilters as adjustColumnFiltersRuntime,
  adjustConditionalFormats as adjustConditionalFormatsRuntime,
  adjustFormulaForAxis as adjustFormulaForAxisRuntime,
  reorderFormulaForAxis as reorderFormulaForAxisRuntime,
} from "../sheet/structure.js";
import type { AxisGroup, AxisName, ConditionalFormatRule, FilterRule } from "./domain.ts";

export type AxisOperation = "insert" | "delete";

export function adjustFormulaForAxis(formula: string, axis: AxisName, index: number, operation: AxisOperation): string {
  return adjustFormulaForAxisRuntime(formula, axis, index, operation);
}

export function reorderFormulaForAxis(formula: string, axis: AxisName, indexMap: ReadonlyMap<number, number>): string {
  return reorderFormulaForAxisRuntime(formula, axis, indexMap);
}

export function adjustAxisGroups(groups: readonly AxisGroup[], index: number, operation: AxisOperation): AxisGroup[] {
  return adjustAxisGroupsRuntime(groups, index, operation) as AxisGroup[];
}

export function adjustColumnFilters(
  filters: readonly FilterRule[],
  index: number,
  operation: AxisOperation,
): FilterRule[] {
  return adjustColumnFiltersRuntime(filters, index, operation) as FilterRule[];
}

export function adjustConditionalFormats(
  rules: readonly ConditionalFormatRule[],
  axis: AxisName,
  index: number,
  operation: AxisOperation,
): ConditionalFormatRule[] {
  return adjustConditionalFormatsRuntime(rules, axis, index, operation) as ConditionalFormatRule[];
}
