/** Small string utilities used by the checkers (typosquat + URL extraction). */

/** Classic Levenshtein edit distance. */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Collapse common look-alike character tricks so "0pensea" ≈ "opensea". */
export function normalizeHomoglyphs(s: string): string {
  return s
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/1/g, "l")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/rn/g, "m")
    .replace(/vv/g, "w");
}

/** Naive registrable domain (eTLD+1). Good enough for typosquat heuristics. */
export function registrableDomain(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".");
  if (parts.length <= 2) return parts.join(".");
  return parts.slice(-2).join(".");
}

/** Extract candidate URLs/domains from free text (for announcement scanning). */
export function extractUrls(text: string): string[] {
  const re = /((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s)]*)?)/gi;
  const found = new Set<string>();
  for (const m of text.matchAll(re)) {
    const raw = m[1].replace(/[.,)]+$/, "");
    // Skip things that are clearly not links (e.g. "3.5", version numbers).
    if (/^[\d.]+$/.test(raw)) continue;
    found.add(raw);
  }
  return [...found];
}
