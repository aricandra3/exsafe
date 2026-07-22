import { decodeFunctionData, parseAbi } from "viem";
import { config } from "@/lib/config";
import { community } from "@/lib/community/store";
import { addressIsFlagged, goPlusAddress } from "@/lib/data/goplus";
import type { Signal } from "@/lib/engine/types";
import type { CheckContext, CheckerOutput } from "./base";

/** Anything above this is treated as an "unlimited" token amount. */
const EFFECTIVELY_UNLIMITED = 10n ** 30n;

function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** 4-byte selectors of the functions attackers most often trick users into. */
const SIG: Record<string, string> = {
  "0x095ea7b3": "function approve(address spender, uint256 amount)",
  "0xa22cb465": "function setApprovalForAll(address operator, bool approved)",
  "0x39509351": "function increaseAllowance(address spender, uint256 addedValue)",
  "0xd505accf":
    "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)",
  "0x23b872dd": "function transferFrom(address from, address to, uint256 amount)",
  "0x42842e0e": "function safeTransferFrom(address from, address to, uint256 tokenId)",
  "0x87517c45":
    "function approve(address token, address spender, uint160 amount, uint48 expiration)",
};

/** Cross-check the address that would receive power against reputation sources. */
async function counterpartySignals(address: string, ctx: CheckContext): Promise<Signal[]> {
  const out: Signal[] = [];
  const addr = address.toLowerCase();

  const blocked = community.matchAddress(addr, "block", ctx.community);
  if (blocked) {
    out.push({
      id: "counterparty-blocklist",
      label: "Recipient on community blocklist",
      severity: "danger",
      detail: `The address receiving this permission (${short(addr)}) has been reported as malicious.`,
      source: "exSafe community",
    });
  }

  const flags = await goPlusAddress(addr, ctx.chainId ?? config.defaultChainId);
  const flag = addressIsFlagged(flags);
  if (flag) {
    out.push({
      id: "counterparty-flagged",
      label: `Recipient flagged: ${flag}`,
      severity: "danger",
      detail: `The address receiving this permission (${short(addr)}) is flagged by GoPlus for ${flag}.`,
      source: "GoPlus",
    });
  }
  return out;
}

export async function checkCalldata(hex: string, ctx: CheckContext): Promise<CheckerOutput> {
  const signals: Signal[] = [];
  const degraded: string[] = [];
  const data = hex as `0x${string}`;
  const selector = data.slice(0, 10).toLowerCase();
  const sig = SIG[selector];

  if (!sig) {
    signals.push({
      id: "unknown-calldata",
      label: "Unrecognised function",
      severity: "caution",
      detail: `exSafe couldn't decode this transaction (selector ${selector}). It's not one of the common approval/transfer functions — only sign if you fully trust the source.`,
      evidence: { selector },
    });
    return { signals, degraded };
  }

  let args: readonly unknown[];
  try {
    ({ args } = decodeFunctionData({ abi: parseAbi([sig]), data }) as { args: readonly unknown[] });
  } catch {
    signals.push({
      id: "decode-failed",
      label: "Could not decode arguments",
      severity: "caution",
      detail: `Recognised the function but failed to decode its arguments (selector ${selector}).`,
      evidence: { selector },
    });
    return { signals, degraded };
  }

  switch (selector) {
    case "0xa22cb465": {
      const [operator, approved] = args as [string, boolean];
      if (approved) {
        signals.push({
          id: "approval-all",
          label: "Grants access to ALL your NFTs",
          severity: "danger",
          detail: `This gives ${short(operator)} permission to transfer EVERY NFT you own in this collection. Drainers empty wallets with a single setApprovalForAll.`,
          evidence: { operator },
        });
        signals.push(...(await counterpartySignals(operator, ctx)));
      } else {
        signals.push({
          id: "approval-revoke",
          label: "Revokes NFT approval",
          severity: "safe",
          detail: `Removes ${short(operator)}'s permission to move your NFTs. Revoking approvals is safe.`,
          evidence: { operator },
        });
      }
      break;
    }
    case "0x095ea7b3": {
      const [spender, amount] = args as [string, bigint];
      const unlimited = amount > EFFECTIVELY_UNLIMITED;
      signals.push({
        id: "approve",
        label: unlimited ? "Unlimited token approval" : "Token / NFT approval",
        severity: unlimited ? "danger" : "caution",
        detail: unlimited
          ? `Grants ${short(spender)} permission to spend an UNLIMITED amount of this token. If ${short(spender)} is malicious it can drain the entire balance.`
          : `Grants ${short(spender)} approval for amount/NFT id ${amount.toString()}. Confirm this is a marketplace you trust.`,
        evidence: { spender, amount: amount.toString() },
      });
      signals.push(...(await counterpartySignals(spender, ctx)));
      break;
    }
    case "0x39509351": {
      const [spender, added] = args as [string, bigint];
      const unlimited = added > EFFECTIVELY_UNLIMITED;
      signals.push({
        id: "increase-allowance",
        label: unlimited ? "Unlimited allowance increase" : "Allowance increase",
        severity: unlimited ? "danger" : "caution",
        detail: `Increases ${short(spender)}'s spending allowance${unlimited ? " to an effectively unlimited amount" : ` by ${added.toString()} units`}.`,
        evidence: { spender, added: added.toString() },
      });
      signals.push(...(await counterpartySignals(spender, ctx)));
      break;
    }
    case "0xd505accf": {
      const [owner, spender, value] = args as [string, string, bigint, bigint, number, string, string];
      const unlimited = value > EFFECTIVELY_UNLIMITED;
      signals.push({
        id: "permit",
        label: "Off-chain token permit",
        severity: "danger",
        detail: `Signing this lets ${short(spender)} spend ${unlimited ? "an UNLIMITED amount" : `${value.toString()} units`} of your tokens — with no transaction showing in your wallet. A favourite drainer trick.`,
        evidence: { owner, spender, value: value.toString() },
      });
      signals.push(...(await counterpartySignals(spender, ctx)));
      break;
    }
    case "0x87517c45": {
      const [, spender, amount] = args as [string, string, bigint, number];
      signals.push({
        id: "permit2-approve",
        label: "Permit2 approval",
        severity: "danger",
        detail: `Grants ${short(spender)} spending power via Permit2 (amount ${amount.toString()}). Verify the spender is a marketplace you trust.`,
        evidence: { spender, amount: amount.toString() },
      });
      signals.push(...(await counterpartySignals(spender, ctx)));
      break;
    }
    case "0x23b872dd":
    case "0x42842e0e": {
      const [from, to, amountOrId] = args as [string, string, bigint];
      signals.push({
        id: "transfer-from",
        label: "Moves an asset between wallets",
        severity: "caution",
        detail: `Transfers amount/NFT id ${amountOrId.toString()} from ${short(from)} to ${short(to)}. If "from" is your wallet, this sends your asset to ${short(to)}.`,
        evidence: { from, to, value: amountOrId.toString() },
      });
      signals.push(...(await counterpartySignals(to, ctx)));
      break;
    }
  }

  return { signals, degraded };
}

export async function checkTypedData(
  obj: Record<string, unknown>,
  ctx: CheckContext,
): Promise<CheckerOutput> {
  const signals: Signal[] = [];
  const degraded: string[] = [];
  const primaryType = String(obj.primaryType ?? "");
  const message = (obj.message ?? {}) as Record<string, unknown>;
  const domainName = String((obj.domain as Record<string, unknown> | undefined)?.name ?? "");

  const bigintOrNull = (v: unknown): bigint | null => {
    try {
      return v === undefined || v === null ? null : BigInt(v as string);
    } catch {
      return null;
    }
  };

  if (primaryType === "Permit" && "spender" in message) {
    const spender = String(message.spender);
    const value = bigintOrNull(message.value);
    const unlimited = value !== null && value > EFFECTIVELY_UNLIMITED;
    signals.push({
      id: "permit-typed",
      label: "Off-chain token permit (signature)",
      severity: "danger",
      detail: `Signing this authorises ${short(spender)} to spend ${value === null ? "your tokens" : unlimited ? "an UNLIMITED amount of your tokens" : `${value.toString()} units`} — no transaction needed. Common drainer technique.`,
      evidence: { spender, value: value?.toString() },
    });
    signals.push(...(await counterpartySignals(spender, ctx)));
  } else if (primaryType.startsWith("Permit") && (message.details || message.spender)) {
    const spender = message.spender ? String(message.spender) : undefined;
    signals.push({
      id: "permit2-typed",
      label: "Permit2 approval (signature)",
      severity: "danger",
      detail: `A Permit2 signature that grants token-spending permission${spender ? ` to ${short(spender)}` : ""}. Verify token, amount and spender — drainers abuse Permit2.`,
      evidence: { primaryType, spender },
    });
    if (spender) signals.push(...(await counterpartySignals(spender, ctx)));
  } else if (primaryType === "OrderComponents" || domainName.toLowerCase().includes("seaport")) {
    signals.push({
      id: "seaport-order",
      label: "Marketplace order signature (Seaport)",
      severity: "danger",
      detail: `Signing this creates a Seaport order that can transfer your NFTs/tokens. Fake "verify"/"claim" prompts use this to sell your NFTs for nothing. Only sign on the official marketplace.`,
      evidence: { primaryType },
    });
  } else {
    signals.push({
      id: "typed-unknown",
      label: `Signature: ${primaryType || "unknown type"}`,
      severity: "caution",
      detail: `An off-chain signature request (${primaryType || "unknown"}) for "${domainName || "an app"}". exSafe can't fully decode it — only sign if you trust the site and understand it.`,
      evidence: { primaryType, domainName },
    });
  }

  return { signals, degraded };
}
