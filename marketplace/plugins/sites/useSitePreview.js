import {
  resolveTauriInvoke,
  useEffect,
  useRef,
  useState,
} from "tactile:host";

/**
 * Resolves a URL into an address an ordinary in-pane `<iframe>` can render,
 * even for sites that send X-Frame-Options / frame-ancestors. In the native
 * app the page is fetched through the backend and re-served over the local
 * `tactile-html` protocol (see `workspace_fetch_webview`), stripping the frame
 * blocks and injecting a <base> so assets still load from the real origin. In
 * the browser preview the URL is used directly. Because the result is a plain
 * iframe it flows with the layout and works identically in floating and
 * expanded In & Out modes.
 */
export function useSitePreview({ url }) {
  const invokeRef = useRef(null);
  if (!invokeRef.current) invokeRef.current = resolveTauriInvoke();
  const invoke = invokeRef.current;
  const native = Boolean(invoke);

  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!url) {
      setSrc(null);
      setError(null);
      setLoading(false);
      return undefined;
    }

    const request = ++requestRef.current;
    setLoading(true);
    setError(null);

    if (invoke) {
      invoke("workspace_fetch_webview", { url })
        .then((served) => {
          if (requestRef.current === request) setSrc(String(served));
        })
        .catch((reason) => {
          if (requestRef.current === request) {
            setSrc(null);
            setError(String(reason || "Unable to load this address."));
          }
        })
        .finally(() => {
          if (requestRef.current === request) setLoading(false);
        });
    } else {
      setSrc(url);
      setLoading(false);
    }

    return () => {
      requestRef.current += 1;
    };
  }, [url, invoke, reloadKey]);

  const reload = () => setReloadKey((current) => current + 1);

  return { src, loading, error, native, reload };
}