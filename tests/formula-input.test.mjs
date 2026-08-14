import assert from "node:assert/strict";
import test from "node:test";

import { cellChangeVersion, cellChangesSince, recordCellChanges } from "../src/objects/sheet/grid/cellChangeJournal.js";

test("cell edit journal reports sparse deltas and falls back after history rolls over", () => {
  const cells = {};
  const initialVersion = cellChangeVersion(cells);

  recordCellChanges(cells, ["r1c2"]);
  assert.deepEqual(cellChangesSince(cells, initialVersion), { version: 1, ids: ["r1c2"] });

  const firstVersion = cellChangeVersion(cells);
  for (let index = 0; index < 33; index += 1) {
    recordCellChanges(cells, [`r${index + 2}c2`]);
  }

  assert.equal(cellChangesSince(cells, firstVersion), null);
  assert.deepEqual(cellChangesSince(cells, cellChangeVersion(cells) - 1), {
    version: 34,
    ids: ["r34c2"],
  });
});
