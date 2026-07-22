import type { Signal } from "@/lib/engine/types";

/** Context passed to every checker. */
export interface CheckContext {
  /** Community scope (Discord guild id) for allow/blocklist lookups. */
  community?: string;
  chainId?: string;
}

/** Every checker returns signals plus a note of any checks it had to skip. */
export interface CheckerOutput {
  signals: Signal[];
  degraded: string[];
}
