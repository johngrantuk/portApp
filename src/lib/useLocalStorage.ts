"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function parse<T>(raw: string | null): T | undefined {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/** `fallback` must be referentially stable (e.g. a module-level constant). */
export function useLocalStorage<T>(key: string, fallback: T) {
  const raw = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(key),
    () => null,
  );
  const value = useMemo(() => parse<T>(raw) ?? fallback, [raw, fallback]);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = parse<T>(localStorage.getItem(key)) ?? fallback;
      const resolved = typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
      localStorage.setItem(key, JSON.stringify(resolved));
      listeners.forEach((l) => l());
    },
    [key, fallback],
  );

  return [value, setValue] as const;
}

const noopSubscribe = () => () => {};

/** False during SSR and the hydration render, true afterwards. */
export function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
