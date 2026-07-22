/**
 * Central config + feature detection.
 *
 * Everything degrades gracefully: a missing key disables the signals that need
 * it and records the fact in `CheckResult.meta.degraded`, but the engine still
 * runs. This keeps the demo working even before every key is filled in.
 */

export type AiProvider = "anthropic" | "openai" | "none";

function env(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

/** Resolve which LLM backend to use for narration / announcement analysis. */
function resolveAiProvider(): AiProvider {
  const forced = env("AI_PROVIDER").toLowerCase();
  if (forced === "anthropic" || forced === "claude") return env("ANTHROPIC_API_KEY") ? "anthropic" : "none";
  if (forced === "openai" || forced === "openai-compatible" || forced === "mimo") {
    return env("AI_API_KEY") || env("OPENAI_API_KEY") ? "openai" : "none";
  }
  // auto
  if (env("AI_API_KEY") || env("OPENAI_API_KEY")) return "openai";
  if (env("ANTHROPIC_API_KEY")) return "anthropic";
  return "none";
}

const aiProvider = resolveAiProvider();

export const config = {
  // ---- LLM (narration + announcement analysis) ----------------------------
  // Provider: "anthropic" | "openai" | "none" (auto-detected unless AI_PROVIDER set)
  aiProvider,
  // OpenAI-compatible (Xiaomi MiMo, OpenRouter, OpenAI, 9Router public URL, …)
  openaiApiKey: env("AI_API_KEY") || env("OPENAI_API_KEY"),
  openaiBaseUrl: (env("AI_BASE_URL") || env("OPENAI_BASE_URL") || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  ),
  openaiModel: env("AI_MODEL") || env("OPENAI_MODEL") || "mimo-v2.5-pro",
  // Anthropic (Claude) — still supported
  anthropicApiKey: env("ANTHROPIC_API_KEY"),
  anthropicModel: env("ANTHROPIC_MODEL") || "claude-sonnet-4-20250514",

  // On-chain metadata (verified source, contract age). Etherscan v2 multichain.
  etherscanApiKey: env("ETHERSCAN_API_KEY"),

  // GoPlus works without auth (rate-limited). Keys raise the limits.
  goplusAppKey: env("GOPLUS_APP_KEY"),
  goplusAppSecret: env("GOPLUS_APP_SECRET"),

  // Base-first: Vibestarter / Wave 1 alignment. Override with DEFAULT_CHAIN_ID.
  defaultChainId: env("DEFAULT_CHAIN_ID") || "8453",
  narrationLang: (env("NARRATION_LANG") || "en") as "en" | "id",

  // Where the Discord bot reaches the web API.
  apiUrl: env("EXSAFE_API_URL") || "http://localhost:3000",

  // Discord bot
  discordToken: env("DISCORD_BOT_TOKEN"),
  discordClientId: env("DISCORD_CLIENT_ID"),
  discordGuildId: env("DISCORD_GUILD_ID"),

  // Public surfaces (safe to expose)
  discordInviteUrl: env("NEXT_PUBLIC_DISCORD_INVITE"),
  githubUrl: env("NEXT_PUBLIC_GITHUB_URL") || "https://github.com/aricandra3/exsafe",
  siteUrl: env("NEXT_PUBLIC_SITE_URL"),
} as const;

export const has = {
  ai: () => config.aiProvider !== "none",
  anthropic: () => config.aiProvider === "anthropic",
  openai: () => config.aiProvider === "openai",
  etherscan: () => Boolean(config.etherscanApiKey),
  discord: () => Boolean(config.discordToken && config.discordClientId),
};

/** Human label for the active AI backend (UI / signal source). */
export function aiBackendLabel(): string {
  if (config.aiProvider === "anthropic") return "Claude";
  if (config.aiProvider === "openai") {
    const base = config.openaiBaseUrl.toLowerCase();
    if (base.includes("xiaomimimo") || config.openaiModel.toLowerCase().includes("mimo")) return "MiMo";
    if (base.includes("openrouter")) return "OpenRouter";
    return "AI";
  }
  return "none";
}

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
    if (
      s.includes("claude") ||
      s.includes("anthropic") ||
      s.includes("mimo") ||
      s.includes("openai") ||
      s.includes("no api key") ||
      s.includes("ai narration") ||
      s.includes("ai (")
    ) {
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
