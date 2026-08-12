import { useCallback, useRef, useState } from "react";
import { pasteChanges, rangeContains, serializeRange } from "../../../sheet/ranges.js";

export function useSheetGridContextMenu({ object, normalizedSelection, onCellsChange, onSelectRange, onCreateFile }) {
  const [menu, setMenu] = useState(null);
  const fileInputRef = useRef(null);
  const pendingFileCellRef = useRef(null);

  const openContextMenu = useCallback((event, cell) => {
    const sourceBox = event.currentTarget?.getBoundingClientRect?.();
    const fallbackX = sourceBox ? sourceBox.left + Math.min(sourceBox.width, 28) : 8;
    const fallbackY = sourceBox ? sourceBox.bottom : 8;
    setMenu({
      x: Number.isFinite(event.clientX) && event.clientX > 0 ? event.clientX : fallbackX,
      y: Number.isFinite(event.clientY) && event.clientY > 0 ? event.clientY : fallbackY,
      anchorRect: sourceBox
        ? {
          left: sourceBox.left,
          top: sourceBox.top,
          right: sourceBox.right,
          bottom: sourceBox.bottom,
          width: sourceBox.width,
          height: sourceBox.height,
        }
        : null,
      cell,
      sourceElement: event.currentTarget,
    });
  }, []);

  const copyCell = useCallback(async () => {
    if (!menu) return;
    const activeRange = rangeContains(normalizedSelection, menu.cell.row, menu.cell.column)
      ? normalizedSelection
      : { anchor: menu.cell.address, focus: menu.cell.address };
    await navigator.clipboard?.writeText(serializeRange(object, activeRange));
  }, [menu, normalizedSelection, object]);

  const pasteCell = useCallback(async () => {
    if (!menu || !navigator.clipboard?.readText) return;
    const text = await navigator.clipboard.readText();
    const pasted = pasteChanges(menu.cell.address, text);
    onCellsChange?.(pasted.changes, "paste");
    onSelectRange?.(menu.cell.address, pasted.endAddress);
  }, [menu, onCellsChange, onSelectRange]);

  const attachFile = useCallback(() => {
    if (!menu) return;
    pendingFileCellRef.current = { cell: menu.cell, sourceElement: menu.sourceElement };
    fileInputRef.current?.click();
  }, [menu]);

  const handleFileChange = useCallback((event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file && pendingFileCellRef.current) {
      const pending = pendingFileCellRef.current;
      pendingFileCellRef.current = null;
      onCreateFile?.(pending.cell, file, pending.sourceElement);
    }
  }, [onCreateFile]);

  return {
    menu,
    setMenu,
    fileInputRef,
    openContextMenu,
    copyCell,
    pasteCell,
    attachFile,
    handleFileChange,
  };
}
