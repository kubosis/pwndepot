const isDemo = String(import.meta.env.VITE_DEMO_MODE) === "true";

export const storage = {
  get<T>(k: string) {
    if (!isDemo) return null;
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : null;
  },
  set<T>(k: string, v: T) {
    if (!isDemo) return;
    localStorage.setItem(k, JSON.stringify(v));
  },
  remove(k: string) {
    if (!isDemo) return;
    localStorage.removeItem(k);
  },
  clear() {
    if (!isDemo) return;
    localStorage.clear();
  },
};
