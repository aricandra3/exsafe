import type { Signal } from "@/lib/engine/types";
import { community } from "@/lib/community/store";
import { getPhishingConfig } from "@/lib/data/phishingList";
import {
  levenshtein,
  normalizeHomoglyphs,
  registrableDomain,
} from "@/lib/util/text";
import type { CheckContext, CheckerOutput } from "./base";

/** Official domains we protect against look-alikes. */
const BRANDS = [
  "opensea.io",
  "blur.io",
  "magiceden.io",
  "rarible.com",
  "foundation.app",
  "zora.co",
  "looksrare.org",
  "x2y2.io",
  "metamask.io",
  "uniswap.org",
];

interface BrandHit {
  brand: string;
  kind: string;
  severity: "danger" | "caution";
}

function detectBrandSquat(regd: string): BrandHit | null {
  for (const brand of BRANDS) {
    if (regd === brand) return null;
    const d = levenshtein(regd, brand);
    if (d > 0 && d <= 2) {
      return { brand, kind: "near-identical spelling", severity: "danger" };
    }
    if (normalizeHomoglyphs(regd) === normalizeHomoglyphs(brand)) {
      return { brand, kind: "look-alike characters", severity: "danger" };
    }
    const brandName = brand.split(".")[0];
    if (new RegExp(`^${brandName}[^a-z0-9]`).test(regd)) {
      return { brand, kind: `reuses the "${brandName}" name`, severity: "caution" };
    }
  }
  return null;
}

async function domainAgeDays(domain: string): Promise<number | null> {
  const res = await fetch(`https://rdap.org/domain/${domain}`, {
    headers: { Accept: "application/rdap+json" },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    events?: { eventAction: string; eventDate: string }[];
  };
  const reg = json.events?.find((e) => e.eventAction === "registration");
  if (!reg?.eventDate) return null;
  const days = Math.floor((Date.now() - new Date(reg.eventDate).getTime()) / 86_400_000);
  return days >= 0 ? days : null;
}

export async function checkUrl(rawUrl: string, ctx: CheckContext): Promise<CheckerOutput> {
  const signals: Signal[] = [];
  const degraded: string[] = [];

  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return {
      signals: [
        {
          id: "invalid-url",
          label: "Not a valid URL",
          severity: "info",
          detail: "Could not parse this input as a link.",
        },
      ],
      degraded,
    };
  }
  const regd = registrableDomain(host);

  // 1. Community layer — the highest-trust signal.
  const blocked = community.matchDomain(host, "block", ctx.community);
  if (blocked) {
    signals.push({
      id: "community-blocklist",
      label: "On community blocklist",
      severity: "danger",
      detail: blocked.reason ?? "Reported by the community as malicious.",
      source: "exSafe community",
    });
  }
  const allowed = community.matchDomain(host, "allow", ctx.community);
  if (allowed) {
    signals.push({
      id: "community-allowlist",
      label: "Verified by community",
      severity: "safe",
      detail: allowed.reason ?? "Verified by community moderators.",
      source: "exSafe community",
    });
  }
  const reports = community.reportCount(host, ctx.community);
  if (reports > 0 && !blocked) {
    signals.push({
      id: "community-reports",
      label: `${reports} community report(s)`,
      severity: "caution",
      detail: `${reports} member(s) have flagged this domain.`,
      source: "exSafe community",
    });
  }

  // 2. MetaMask eth-phishing-detect.
  const cfg = await getPhishingConfig();
  if (!cfg) {
    degraded.push("eth-phishing-detect (feed unavailable)");
  } else {
    const inList = (list: string[]) =>
      list.some((e) => host === e || host.endsWith("." + e) || regd === e);

    if (inList(cfg.whitelist)) {
      signals.push({
        id: "phishing-whitelist",
        label: "On MetaMask allowlist",
        severity: "safe",
        detail: "Recognised as a legitimate domain by MetaMask's list.",
        source: "eth-phishing-detect",
      });
    }
    if (inList(cfg.blacklist)) {
      signals.push({
        id: "phishing-blocklist",
        label: "On MetaMask phishing blocklist",
        severity: "danger",
        detail:
          "Known phishing site — this is the same blocklist MetaMask uses to block pages.",
        source: "eth-phishing-detect",
      });
    } else if (!inList(cfg.whitelist)) {
      const near = cfg.fuzzylist.find((e) => {
        const d = levenshtein(regd, e);
        return d > 0 && d <= cfg.tolerance;
      });
      if (near) {
        signals.push({
          id: "phishing-fuzzy",
          label: "Look-alike of a known site",
          severity: "danger",
          detail: `Closely resembles "${near}" — a common typosquatting trick to impersonate a trusted site.`,
          source: "eth-phishing-detect",
          evidence: { near },
        });
      }
    }
  }

  // 3. Brand typosquat / homoglyph (independent of the list above).
  const brandHit = detectBrandSquat(regd);
  if (brandHit) {
    signals.push({
      id: "brand-typosquat",
      label: `Imitates ${brandHit.brand}`,
      severity: brandHit.severity,
      detail: `"${regd}" ${brandHit.kind}. The official site is ${brandHit.brand}.`,
    });
  }
  if (host.startsWith("xn--") || host.includes(".xn--")) {
    signals.push({
      id: "punycode",
      label: "Punycode / IDN domain",
      severity: "caution",
      detail: "Uses internationalised characters that can disguise a familiar name.",
    });
  }

  // 4. Domain age (RDAP).
  try {
    const age = await domainAgeDays(regd);
    if (age === null) {
      degraded.push("domain age (RDAP had no data)");
    } else if (age < 7) {
      signals.push({
        id: "domain-new",
        label: `Registered ${age} day(s) ago`,
        severity: "danger",
        detail: "Brand-new domains are a hallmark of scam mints and drainer sites.",
        source: "RDAP",
        evidence: { ageDays: age },
      });
    } else if (age < 30) {
      signals.push({
        id: "domain-young",
        label: `Registered ${age} days ago`,
        severity: "caution",
        detail: "This domain is very new — be cautious before connecting a wallet.",
        source: "RDAP",
        evidence: { ageDays: age },
      });
    } else {
      signals.push({
        id: "domain-age",
        label: `Domain age ~${age} days`,
        severity: "info",
        detail: "The domain has existed for a while (not proof of safety on its own).",
        source: "RDAP",
        evidence: { ageDays: age },
      });
    }
  } catch {
    degraded.push("domain age (RDAP error)");
  }

  if (signals.length === 0) {
    signals.push({
      id: "no-flags-url",
      label: "No known red flags",
      severity: "info",
      detail:
        "No phishing or look-alike signals matched — but absence of a signal is not proof of safety.",
    });
  }
  return { signals, degraded };
}
