import type { InputKind } from "./types";

export interface Detected {
  kind: InputKind;
  /** Cleaned value the checker should operate on (hostname, address, hex, …). */
  normalized: string;
  /** Structured payload when the input was JSON (tx object or EIP-712). */
  parsed?: Record<string, unknown>;
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const HEX_RE = /^0x[0-9a-fA-F]{8,}$/; // >= 4-byte selector
const DOMAIN_RE = /^([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s]*)?$/i;

/** Best-effort classification of whatever the user pasted. */
export function detectInput(raw: string): Detected {
  const input = raw.trim();

  // 1. JSON: transaction object or EIP-712 typed data.
  if (input.startsWith("{")) {
    try {
      const obj = JSON.parse(input) as Record<string, unknown>;
      if (obj.types && obj.domain && (obj.message || obj.primaryType)) {
        return { kind: "typed-data", normalized: input, parsed: obj };
      }
      if (typeof obj.data === "string" && obj.data.startsWith("0x")) {
        return { kind: "calldata", normalized: obj.data, parsed: obj };
      }
    } catch {
      // fall through — not valid JSON
    }
  }

  // 2. Hex payloads.
  if (ADDRESS_RE.test(input)) {
    return { kind: "address", normalized: input.toLowerCase() };
  }
  if (HEX_RE.test(input) && input.length % 2 === 0) {
    return { kind: "calldata", normalized: input };
  }

  // 3. URL / domain (single token, no whitespace).
  if (!/\s/.test(input)) {
    const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    try {
      const url = new URL(withScheme);
      if (DOMAIN_RE.test(url.hostname) || /^https?:\/\//i.test(input)) {
        return { kind: "url", normalized: withScheme };
      }
    } catch {
      // not a URL
    }
  }

  // 4. Free text with a hint of a link or scam-y length → treat as announcement.
  if (/\s/.test(input) && input.length >= 12) {
    return { kind: "announcement", normalized: input };
  }

  return { kind: "unknown", normalized: input };
}
