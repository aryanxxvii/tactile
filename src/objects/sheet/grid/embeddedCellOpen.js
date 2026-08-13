import { useCallback, useEffect, useRef } from "react";

export function useEmbeddedCellOpen({
  objectId,
  cellId,
  address,
  embedObjectId,
  embedType,
  embedLinkId,
  sourceLabel,
  onOpenObject,
}) {
  const timerRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current == null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const open = useCallback((event, mode, sourceElement = event.currentTarget) => {
    if (!embedObjectId) return;
    onOpenObject?.({
      objectId: embedObjectId,
      linkId: embedLinkId,
      sourceObjectId: objectId,
      sourceCellId: cellId,
      sourceAddress: address,
      sourceLabel,
      sourceType: embedType,
      sourceElement,
      mode,
    });
  }, [address, cellId, embedLinkId, embedObjectId, embedType, objectId, onOpenObject, sourceLabel]);

  const onClick = useCallback((event) => {
    if (!embedObjectId) return;
    clearTimer();
    const sourceElement = event.currentTarget;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      open(null, "floating", sourceElement);
    }, 170);
  }, [clearTimer, embedObjectId, open]);

  const onDoubleClick = useCallback((event) => {
    clearTimer();
    open(event, "full");
  }, [clearTimer, open]);

  return { onClick, onDoubleClick };
}
