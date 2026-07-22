/** Thin GoPlus Security API client (free, works without a key at lower limits). */

interface GoPlusResp<T> {
  code: number;
  message: string;
  result: T;
}

export async function goPlusAddress(
  address: string,
  chainId: string,
): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(
      `https://api.gopluslabs.io/api/v1/address_security/${address}?chain_id=${chainId}`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as GoPlusResp<Record<string, string>>;
    return json.result ?? null;
  } catch {
    return null;
  }
}

export async function goPlusToken(
  address: string,
  chainId: string,
): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(
      `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${address}`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as GoPlusResp<
      Record<string, Record<string, string>>
    >;
    return json.result?.[address.toLowerCase()] ?? null;
  } catch {
    return null;
  }
}

/** True if GoPlus flags this address for phishing/stealing/etc. */
export function addressIsFlagged(flags: Record<string, string> | null): string | null {
  if (!flags) return null;
  const bad: Record<string, string> = {
    phishing_activities: "phishing",
    stealing_attack: "wallet draining",
    blackmail_activities: "blackmail",
    sanctioned: "sanctions",
    money_laundering: "money laundering",
    cybercrime: "cybercrime",
  };
  for (const [key, label] of Object.entries(bad)) {
    if (flags[key] === "1") return label;
  }
  return null;
}
