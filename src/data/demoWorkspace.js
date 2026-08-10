import { cellAddress, cellId } from "../sheet/coordinates.js";

function buildCells(rows, columns, values, embeds = {}, formulas = {}) {
  const cells = {};

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const id = cellId(row, column);
      const address = cellAddress(row, column);
      cells[id] = {
        id,
        address,
        row,
        column,
        value: values[row]?.[column] ?? "",
        formula: formulas[address] || "",
        embed: embeds[address] || null,
      };
    }
  }

  return cells;
}

const launchValues = [
  ["Workstream", "Owner", "Start", "Due", "Status", "Budget", "Confidence", "Notes", "Artifact", "Updated"],
  ["Research", "Mina", "Aug 04", "Aug 16", "Complete", "18k", "0.92", "12 interviews", "Research notes", "Aug 16"],
  ["Positioning", "Avery", "Aug 11", "Aug 23", "Active", "12k", "0.81", "Draft two", "Messaging", "Aug 18"],
  ["Identity", "Blake", "Aug 18", "Sep 06", "Active", "24k", "0.76", "Two routes", "Design system", "Aug 19"],
  ["Web", "Casey", "Aug 25", "Sep 20", "Planned", "31k", "0.68", "Dependencies", "Launch page", "Aug 19"],
  ["Lifecycle", "Noah", "Sep 02", "Sep 24", "Planned", "16k", "0.71", "Six messages", "Email series", "Aug 18"],
  ["Paid media", "Iris", "Sep 08", "Oct 18", "Planned", "84k", "0.82", "Three markets", "Media plan", "Aug 17"],
  ["Partnerships", "Theo", "Sep 12", "Oct 24", "Planned", "36k", "0.64", "Five targets", "Partner list", "Aug 14"],
  ["Sales enablement", "Zara", "Sep 15", "Oct 06", "Planned", "21k", "0.73", "Field review", "Sales deck", "Aug 16"],
  ["Launch event", "Mina", "Oct 03", "Oct 28", "Planned", "47k", "0.58", "Venue hold", "Run of show", "Aug 12"],
  ["Measurement", "Avery", "Oct 13", "Nov 14", "Planned", "9k", "0.79", "North star", "Metric map", "Aug 18"],
  ["Total committed", "", "", "", "", "298k", "", "", "", ""],
  ["Open decisions", "6", "", "", "Review", "", "", "Pricing, regions", "Decision log", "Aug 19"],
  ["Operating model", "Finance", "", "", "Embedded", "", "", "Drivers and scenarios", "Sheet", "Aug 19"],
  ["Research archive", "Mina", "", "", "Embedded", "", "", "Raw evidence", "Document", "Aug 16"],
  ["", "", "", "", "", "", "", "", "", ""],
  ["Milestone", "Owner", "Date", "State", "Dependency", "", "", "", "", ""],
  ["Internal preview", "Blake", "Sep 18", "Booked", "Identity", "", "", "", "", ""],
  ["Press briefing", "Zara", "Oct 20", "Tentative", "Messaging", "", "", "", "", ""],
  ["Public launch", "Mina", "Oct 28", "Target", "All workstreams", "", "", "", "", ""],
];

const operatingValues = [
  ["Metric", "Base", "Upside", "Downside", "Notes", "Owner", "Status"],
  ["Revenue", "48", "58", "38", "Monthly, in 000s", "Finance", "Active"],
  ["Cost rate", "0.32", "0.28", "0.37", "% of revenue", "Finance", "Active"],
  ["Gross margin", "32.6", "41.8", "23.9", "Calculated", "Finance", "Active"],
  ["Customer count", "1,250", "1,550", "950", "End of month", "Growth", "Active"],
  ["Avg. price", "38", "39", "37", "Monthly", "Growth", "Review"],
  ["Churn rate", "0.015", "0.010", "0.020", "Monthly", "Growth", "Active"],
  ["CAC", "120", "110", "140", "Blended", "Growth", "Active"],
  ["LTV", "820", "920", "700", "Gross", "Growth", "Review"],
  ["Unit economics", "", "", "", "Model", "Finance", "Embedded"],
  ["Scenario matrix", "", "", "", "3 × 3", "Strategy", "Embedded"],
  ["Risks", "10", "", "", "Top ten", "Strategy", "Review"],
  ["Runway", "18", "22", "14", "Months", "Finance", "Active"],
  ["Break-even", "Nov 26", "Sep 26", "Feb 27", "Forecast", "Finance", "Review"],
];

const scenarioValues = [
  ["Signal", "Low", "Expected", "High", "Weight", "Owner"],
  ["Conversion", "1.8%", "2.4%", "3.1%", "35%", "Growth"],
  ["Retention", "68%", "74%", "81%", "30%", "Product"],
  ["Average price", "34", "38", "42", "20%", "Finance"],
  ["Paid efficiency", "0.72", "0.88", "1.03", "15%", "Growth"],
  ["Weighted outcome", "31", "48", "66", "100%", "Strategy"],
  ["Decision", "Pause", "Proceed", "Accelerate", "", "Leadership"],
  ["Next review", "Sep 04", "Sep 04", "Sep 04", "", "Mina"],
];

function createWorkspace() {
  return {
    version: 2,
    id: "tactile-editorial-prototype",
    name: "Tactile",
    rootObjectId: "launch-plan",
    updatedAt: new Date().toISOString(),
    objects: {
      "launch-plan": {
        id: "launch-plan",
        type: "sheet",
        title: "Launch plan",
        description: "Workstreams, decisions, and the path to release.",
        rows: 20,
        columns: 10,
        cells: buildCells(
          20,
          10,
          launchValues,
          {
            A14: { objectId: "operating-model", type: "sheet" },
            A15: { objectId: "research-archive", type: "document" },
          },
          { F12: "=SUM(F2:F11)" },
        ),
      },
      "operating-model": {
        id: "operating-model",
        type: "sheet",
        title: "Operating model",
        description: "Drivers, scenarios, and twelve-month outcomes.",
        rows: 14,
        columns: 7,
        cells: buildCells(
          14,
          7,
          operatingValues,
          {
            A10: { objectId: "unit-economics", type: "document" },
            A11: { objectId: "scenario-matrix", type: "sheet" },
          },
          {
            B4: "=B2*(1-B3)",
            C4: "=C2*(1-C3)",
            D4: "=D2*(1-D3)",
          },
        ),
      },
      "scenario-matrix": {
        id: "scenario-matrix",
        type: "sheet",
        title: "Scenario matrix",
        description: "Signals and weighted outcomes for the operating plan.",
        rows: 8,
        columns: 6,
        cells: buildCells(8, 6, scenarioValues, {}, { B6: "=SUMPRODUCT(B2:B5,$E$2:$E$5)" }),
      },
      "research-archive": {
        id: "research-archive",
        type: "document",
        title: "Research archive",
        description: "Interview evidence and decisions that shaped the launch.",
        blocks: [
          { type: "kicker", text: "Local document · 12 interviews" },
          { type: "heading", text: "What people are trying to protect" },
          { type: "paragraph", text: "Teams are comfortable with a grid because it gives every fragment of work a stable place. The opportunity is to add depth without taking that map away." },
          { type: "quote", text: "I want to open the context, do the work, and come back to the exact place I left." },
          { type: "heading", text: "Implication" },
          { type: "paragraph", text: "Nested objects should preserve their source cell, open quickly, and remain ordinary local files when exported." },
        ],
      },
      "unit-economics": {
        id: "unit-economics",
        type: "document",
        title: "Unit economics",
        description: "Definitions and assumptions behind the operating model.",
        blocks: [
          { type: "kicker", text: "Finance note · revised 19 Aug" },
          { type: "heading", text: "Base-case assumptions" },
          { type: "paragraph", text: "The model uses blended acquisition cost, gross-margin contribution, and a twelve-month retention curve. Values remain linked to the parent sheet through stable object references." },
          { type: "quote", text: "A cell is a doorway when it contains an object; otherwise it remains a normal value." },
          { type: "heading", text: "Review cadence" },
          { type: "paragraph", text: "Finance updates the base case every Friday. Growth owns the upside and downside inputs." },
        ],
      },
    },
  };
}

export function createDemoWorkspace() {
  return createWorkspace();
}
