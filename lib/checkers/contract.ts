import { config, has } from "@/lib/config";
import { community } from "@/lib/community/store";
import type { Signal, SignalSeverity } from "@/lib/engine/types";
import { goPlusAddress, goPlusToken } from "@/lib/data/goplus";
import type { CheckContext, CheckerOutput } from "./base";

/** Address-reputation flags from GoPlus (value "1" means flagged). */
const ADDR_FLAGS: { key: string; severity: SignalSeverity; label: string; detail: string }[] = [
  { key: "phishing_activities", severity: "danger", label: "Flagged for phishing", detail: "GoPlus links this address to phishing activity." },
  { key: "stealing_attack", severity: "danger", label: "Flagged for wallet draining", detail: "Linked to stealing / wallet-draining attacks." },
  { key: "blackmail_activities", severity: "danger", label: "Flagged for blackmail", detail: "Linked to blackmail/extortion activity." },
  { key: "sanctioned", severity: "danger", label: "Sanctioned address", detail: "Appears on a sanctions list." },
  { key: "money_laundering", severity: "danger", label: "Money-laundering flag", detail: "Linked to money-laundering activity." },
  { key: "cybercrime", severity: "danger", label: "Cybercrime flag", detail: "Linked to cybercrime." },
  { key: "malicious_mining_activities", severity: "caution", label: "Malicious mining", detail: "Linked to malicious mining activity." },
  { key: "darkweb_transactions", severity: "caution", label: "Dark-web transactions", detail: "Has transacted with dark-web-linked addresses." },
  { key: "blacklist_doubt", severity: "caution", label: "On exchange blacklists", detail: "Suspected to be on exchange blacklists." },
  { key: "honeypot_related_address", severity: "caution", label: "Honeypot-related", detail: "Associated with honeypot token contracts." },
  { key: "fake_kyc", severity: "caution", label: "Fake KYC", detail: "Associated with fake-KYC activity." },
];

export async function checkContract(
  address: string,
  ctx: CheckContext,
): Promise<CheckerOutput> {
  const signals: Signal[] = [];
  const degraded: string[] = [];
  const chainId = ctx.chainId ?? config.defaultChainId;
  const addr = address.toLowerCase();

  // 1. Community layer.
  const blocked = community.matchAddress(addr, "block", ctx.community);
  if (blocked) {
    signals.push({
      id: "community-blocklist",
      label: "On community blocklist",
      severity: "danger",
      detail: blocked.reason ?? "Reported by the community as malicious.",
      source: "exSafe community",
    });
  }
  const allowed = community.matchAddress(addr, "allow", ctx.community);
  if (allowed) {
    signals.push({
      id: "community-allowlist",
      label: "Verified by community",
      severity: "safe",
      detail: allowed.reason ?? "Verified by community moderators.",
      source: "exSafe community",
    });
  }

  // 2. GoPlus address reputation.
  const addrSec = await goPlusAddress(addr, chainId);
  if (!addrSec) {
    degraded.push("GoPlus address reputation (unavailable)");
  } else {
    for (const f of ADDR_FLAGS) {
      if (addrSec[f.key] === "1") {
        signals.push({
          id: `goplus-${f.key}`,
          label: f.label,
          severity: f.severity,
          detail: f.detail,
          source: "GoPlus",
        });
      }
    }
  }

  // 3. GoPlus token/contract security.
  const token = await goPlusToken(addr, chainId);
  if (!token) {
    degraded.push("GoPlus contract security (not a token or unavailable)");
  } else {
    if (token.is_honeypot === "1") {
      signals.push({ id: "goplus-honeypot", label: "Honeypot contract", severity: "danger", detail: "You may be able to buy but not sell — a classic honeypot.", source: "GoPlus" });
    }
    if (token.owner_change_balance === "1") {
      signals.push({ id: "goplus-owner-balance", label: "Owner can change balances", severity: "danger", detail: "The owner can arbitrarily change token balances.", source: "GoPlus" });
    }
    if (token.hidden_owner === "1") {
      signals.push({ id: "goplus-hidden-owner", label: "Hidden owner", severity: "danger", detail: "The contract has a concealed owner with hidden privileges.", source: "GoPlus" });
    }
    if (token.can_take_back_ownership === "1") {
      signals.push({ id: "goplus-takeback", label: "Ownership can be reclaimed", severity: "caution", detail: "Ownership can be taken back after being renounced.", source: "GoPlus" });
    }
    if (token.selfdestruct === "1") {
      signals.push({ id: "goplus-selfdestruct", label: "Self-destructable", severity: "caution", detail: "The contract can self-destruct.", source: "GoPlus" });
    }
    if (token.transfer_pausable === "1") {
      signals.push({ id: "goplus-pausable", label: "Transfers can be paused", severity: "caution", detail: "The owner can pause all transfers.", source: "GoPlus" });
    }
    if (token.is_proxy === "1") {
      signals.push({ id: "goplus-proxy", label: "Upgradeable proxy", severity: "info", detail: "Logic can be changed after deployment (common, but worth knowing).", source: "GoPlus" });
    }
    if (token.is_mintable === "1") {
      signals.push({ id: "goplus-mintable", label: "Mintable supply", severity: "info", detail: "New tokens can be minted by the owner.", source: "GoPlus" });
    }
    if (token.is_open_source === "0") {
      signals.push({ id: "goplus-closed-source", label: "Source not open/verified", severity: "caution", detail: "Contract source code is not published — you can't see what it does.", source: "GoPlus" });
    } else if (token.is_open_source === "1") {
      signals.push({ id: "goplus-open-source", label: "Source code verified", severity: "safe", detail: "Contract source code is published and readable.", source: "GoPlus" });
    }
  }

  // 4. Etherscan — verified source + contract age.
  if (!has.etherscan()) {
    degraded.push("Etherscan (no API key — verified source & contract age skipped)");
  } else {
    try {
      const base = `https://api.etherscan.io/v2/api?chainid=${chainId}&apikey=${config.etherscanApiKey}`;
      const srcRes = await fetch(`${base}&module=contract&action=getsourcecode&address=${addr}`);
      const src = (await srcRes.json()) as {
        result?: { SourceCode?: string; ContractName?: string; Proxy?: string }[];
      };
      const info = src.result?.[0];
      if (info) {
        if (!info.SourceCode) {
          signals.push({ id: "etherscan-unverified", label: "Unverified on Etherscan", severity: "caution", detail: "The contract source is not verified on Etherscan.", source: "Etherscan" });
        } else {
          signals.push({ id: "etherscan-verified", label: `Verified: ${info.ContractName || "contract"}`, severity: "safe", detail: "Contract source is verified on Etherscan.", source: "Etherscan" });
        }
      }

      const creRes = await fetch(`${base}&module=contract&action=getcontractcreation&contractaddresses=${addr}`);
      const cre = (await creRes.json()) as {
        result?: { timestamp?: string; blockNumber?: string }[];
      };
      const ts = cre.result?.[0]?.timestamp;
      if (ts) {
        const ageDays = Math.floor((Date.now() / 1000 - Number(ts)) / 86_400);
        if (ageDays < 7) {
          signals.push({ id: "contract-new", label: `Deployed ${ageDays} day(s) ago`, severity: "danger", detail: "Brand-new contracts are frequently used for scams.", source: "Etherscan", evidence: { ageDays } });
        } else if (ageDays < 30) {
          signals.push({ id: "contract-young", label: `Deployed ${ageDays} days ago`, severity: "caution", detail: "This contract is very new — be cautious.", source: "Etherscan", evidence: { ageDays } });
        } else {
          signals.push({ id: "contract-age", label: `Contract age ~${ageDays} days`, severity: "info", detail: "The contract has existed for a while.", source: "Etherscan", evidence: { ageDays } });
        }
      }
    } catch {
      degraded.push("Etherscan (request error)");
    }
  }

  if (signals.length === 0) {
    signals.push({
      id: "no-flags-contract",
      label: "No known red flags",
      severity: "info",
      detail: "No malicious flags matched — but always confirm the address from an official source.",
    });
  }
  return { signals, degraded };
}
