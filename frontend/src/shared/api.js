import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const cache = new Map();

/** Fetch an API path once per page load and share the result between tabs. */
export function load(path, url = path) {
  if (!cache.has(path)) {
    const p = fetch(`${API_BASE}${url}`).then((res) => {
      if (!res.ok) throw new Error(`${path} could not be loaded (${res.status}).`);
      return res.json();
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return cache.get(path);
}

/** { data, error, loading, reload } for an API path. reload(url) fetches it again, e.g. with ?nocache=true. */
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: "", loading: true });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    load(path)
      .then((data) => live && setState({ data, error: "", loading: false }))
      .catch((err) => live && setState({ data: null, error: err.message, loading: false }));
    return () => {
      live = false;
    };
  }, [path, version]);
  const reload = (url = path) => {
    cache.delete(path);
    return load(path, url).finally(() => setVersion((v) => v + 1));
  };
  return { ...state, reload };
}
