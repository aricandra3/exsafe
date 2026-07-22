/**
 * Central config + feature detection.
 *
 * Everything degrades gracefully: a missing key disables the signals that need
 * it and records the fact in `CheckResult.meta.degraded`, but the engine still
 * runs. This keeps the demo working even before every key is filled in.
 */

export const config = {
  // Claude — narration + announcement analysis
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",

  // On-chain metadata (verified source, contract age). Etherscan v2 multichain.
  etherscanApiKey: process.env.ETHERSCAN_API_KEY ?? "",

  // GoPlus works without auth (rate-limited). Keys raise the limits.
  goplusAppKey: process.env.GOPLUS_APP_KEY ?? "",
  goplusAppSecret: process.env.GOPLUS_APP_SECRET ?? "",

  // Base-first: Vibestarter / Wave 1 alignment. Override with DEFAULT_CHAIN_ID.
  defaultChainId: process.env.DEFAULT_CHAIN_ID ?? "8453",
  narrationLang: (process.env.NARRATION_LANG ?? "en") as "en" | "id",

  // Where the Discord bot reaches the web API.
  apiUrl: process.env.EXSAFE_API_URL ?? "http://localhost:3000",

  // Discord bot
  discordToken: process.env.DISCORD_BOT_TOKEN ?? "",
  discordClientId: process.env.DISCORD_CLIENT_ID ?? "",
  discordGuildId: process.env.DISCORD_GUILD_ID ?? "",

  // Public surfaces (safe to expose)
  discordInviteUrl: process.env.NEXT_PUBLIC_DISCORD_INVITE ?? "",
  githubUrl: process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/aricandra3/exsafe",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
} as const;

export const has = {
  anthropic: () => Boolean(config.anthropicApiKey),
  etherscan: () => Boolean(config.etherscanApiKey),
  discord: () => Boolean(config.discordToken && config.discordClientId),
};

/** Human-readable chain names for the chains we surface. */
export const CHAIN_NAMES: Record<string, string> = {
  "8453": "Base",
  "1": "Ethereum",
  "137": "Polygon",
  "42161": "Arbitrum",
  "10": "Optimism",
  "56": "BNB Chain",
};

/** Turn internal degraded keys into judge-friendly copy. */
export function humanizeDegraded(items: string[]): string[] {
  return items.map((raw) => {
    const s = raw.toLowerCase();
    if (s.includes("claude") || s.includes("anthropic")) {
      return "AI narration offline — using deterministic explanation";
    }
    if (s.includes("rdap") || s.includes("domain age")) {
      return "Domain age unavailable — other signals still apply";
    }
    if (s.includes("etherscan")) {
      return "Contract age / verified-source skipped (no Etherscan key)";
    }
    if (s.includes("goplus")) {
      return "GoPlus reputation temporarily unavailable";
    }
    if (s.includes("phishing")) {
      return "Phishing feed temporarily unavailable";
    }
    return raw;
  });
}
