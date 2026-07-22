import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Community Safety Desk store — the crowd-sourced layer that makes exSafe more
 * than "another scanner". Mods verify links/contracts (allowlist); members
 * report scams (blocklist). Entries are scoped to a community (Discord guild id)
 * or "global".
 *
 * Storage is deliberately simple for the hackathon: a committed seed file plus a
 * runtime file for new reports. Writes are best-effort — on a read-only host
 * (e.g. serverless) we keep additions in memory so the demo never crashes.
 */

export type ListName = "allow" | "block";
export type EntryType = "domain" | "address";

export interface CommunityEntry {
  value: string;
  type: EntryType;
  list: ListName;
  reason?: string;
  community?: string;
  reporter?: string;
  at?: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const SEED_PATH = path.join(DATA_DIR, "community.json");
const RUNTIME_PATH = path.join(DATA_DIR, "community.runtime.json");
// Fallback for read-only hosts (e.g. serverless): the OS temp dir is writable.
const TMP_RUNTIME_PATH = path.join(os.tmpdir(), "exsafe-community.runtime.json");

let cache: CommunityEntry[] | null = null;

function normalizeDomain(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
}

function normalize(entry: CommunityEntry): CommunityEntry {
  return {
    ...entry,
    value:
      entry.type === "domain"
        ? normalizeDomain(entry.value)
        : entry.value.trim().toLowerCase(),
    community: entry.community || "global",
  };
}

function readJsonEntries(file: string): CommunityEntry[] {
  try {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    const arr: unknown = Array.isArray(parsed) ? parsed : parsed.entries;
    if (!Array.isArray(arr)) return [];
    return (arr as CommunityEntry[]).map(normalize);
  } catch {
    return [];
  }
}

function load(): CommunityEntry[] {
  if (cache) return cache;
  cache = [
    ...readJsonEntries(SEED_PATH),
    ...readJsonEntries(RUNTIME_PATH),
    ...readJsonEntries(TMP_RUNTIME_PATH),
  ];
  return cache;
}

function inScope(entry: CommunityEntry, community?: string): boolean {
  const scope = community || "global";
  return entry.community === "global" || entry.community === scope;
}

function hostMatches(host: string, entry: string): boolean {
  const h = normalizeDomain(host);
  return h === entry || h.endsWith("." + entry);
}

export const community = {
  /** Matching allow/block entry for a domain, or null. */
  matchDomain(host: string, list: ListName, community?: string): CommunityEntry | null {
    return (
      load().find(
        (e) =>
          e.type === "domain" &&
          e.list === list &&
          inScope(e, community) &&
          hostMatches(host, e.value),
      ) ?? null
    );
  },

  matchAddress(address: string, list: ListName, community?: string): CommunityEntry | null {
    const a = address.trim().toLowerCase();
    return (
      load().find(
        (e) =>
          e.type === "address" &&
          e.list === list &&
          inScope(e, community) &&
          e.value === a,
      ) ?? null
    );
  },

  /** How many times a value has been reported (blocklist entries). */
  reportCount(value: string, community?: string): number {
    const v = value.trim().toLowerCase();
    return load().filter(
      (e) =>
        e.list === "block" &&
        inScope(e, community) &&
        (e.value === v || (e.type === "domain" && hostMatches(v, e.value))),
    ).length;
  },

  /** Add a report/verification. Best-effort persistence to the runtime file. */
  add(entry: CommunityEntry): CommunityEntry {
    const normalized = normalize({ ...entry, at: entry.at ?? new Date().toISOString() });
    load().push(normalized);
    // Persist to the repo data dir in local dev; fall back to the OS temp dir on
    // read-only hosts (serverless) so the write still succeeds.
    for (const target of [RUNTIME_PATH, TMP_RUNTIME_PATH]) {
      try {
        const existing = readJsonEntries(target);
        existing.push(normalized);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, JSON.stringify({ entries: existing }, null, 2));
        break;
      } catch {
        // try the next target; if all fail it stays in memory only
      }
    }
    return normalized;
  },

  /** Testing / hot-reload helper. */
  _reset() {
    cache = null;
  },
};
