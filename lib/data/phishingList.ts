/**
 * Live feed of MetaMask's eth-phishing-detect list — the same blocklist that
 * powers MetaMask's phishing warnings. Fetched once and cached in-process.
 */

export interface PhishingConfig {
  blacklist: string[];
  whitelist: string[];
  fuzzylist: string[];
  tolerance: number;
}

const SOURCE =
  "https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/master/src/config.json";
const TTL_MS = 60 * 60 * 1000;

let cached: PhishingConfig | null = null;
let fetchedAt = 0;

export async function getPhishingConfig(): Promise<PhishingConfig | null> {
  const now = Date.now();
  if (cached && now - fetchedAt < TTL_MS) return cached;
  try {
    const res = await fetch(SOURCE, {
      // Next.js data cache; harmless when running outside Next.
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return cached;
    const json = (await res.json()) as Partial<PhishingConfig>;
    cached = {
      blacklist: json.blacklist ?? [],
      whitelist: json.whitelist ?? [],
      fuzzylist: json.fuzzylist ?? [],
      tolerance: json.tolerance ?? 3,
    };
    fetchedAt = now;
    return cached;
  } catch {
    return cached;
  }
}
