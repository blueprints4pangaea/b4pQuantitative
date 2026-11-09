import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const cache = new Map();

/** Fetch an API path once per page load and share the result between tabs. */
export function load(path) {
  if (!cache.has(path)) {
    const p = fetch(`${API_BASE}${path}`).then((res) => {
      if (!res.ok) throw new Error(`${path} could not be loaded (${res.status}).`);
      return res.json();
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return cache.get(path);
}

/** { data, error, loading } for an API path. */
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: "", loading: true });
  useEffect(() => {
    let live = true;
    load(path)
      .then((data) => live && setState({ data, error: "", loading: false }))
      .catch((err) => live && setState({ data: null, error: err.message, loading: false }));
    return () => {
      live = false;
    };
  }, [path]);
  return state;
}
