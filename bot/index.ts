/**
 * exSafe Discord bot — the Community Safety Desk where members already live.
 *
 * - Auto-scans every message for links / contract addresses / transaction data
 *   and replies with a verdict card.
 * - /check <input>  — check anything on demand.
 * - /report <value> — add a scam to this community's blocklist.
 *
 * The bot is a thin client: it calls the same /api/check "brain" the web app
 * uses, scoped to the Discord guild id so each community has its own lists.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import {
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Message,
} from "discord.js";

const TOKEN = process.env.DISCORD_BOT_TOKEN ?? "";
const CLIENT_ID = process.env.DISCORD_CLIENT_ID ?? "";
const GUILD_ID = process.env.DISCORD_GUILD_ID ?? "";
const API = process.env.EXSAFE_API_URL ?? "http://localhost:3000";

if (!TOKEN || !CLIENT_ID) {
  console.error(
    "Missing DISCORD_BOT_TOKEN and/or DISCORD_CLIENT_ID. Set them in .env.local — see .env.example.",
  );
  process.exit(1);
}

interface Signal {
  label: string;
  severity: "danger" | "caution" | "safe" | "info";
  detail: string;
  source?: string;
}
interface CheckResult {
  verdict: "SAFE" | "CAUTION" | "DANGER";
  score: number;
  kind: string;
  summary: string;
  explanation: string;
  recommendation: string;
  signals: Signal[];
  meta: { chainName?: string };
}

const COLOR = { SAFE: 0x22c55e, CAUTION: 0xf59e0b, DANGER: 0xef4444 } as const;
const EMOJI = { SAFE: "🟢", CAUTION: "🟡", DANGER: "🔴" } as const;
const DOT = { danger: "🔴", caution: "🟡", safe: "🟢", info: "⚪" } as const;

async function runCheck(input: string, community?: string): Promise<CheckResult | null> {
  try {
    const res = await fetch(`${API}/api/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, community }),
    });
    if (!res.ok) return null;
    return (await res.json()) as CheckResult;
  } catch {
    return null;
  }
}

async function report(
  value: string,
  type: "domain" | "address",
  community?: string,
  reporter?: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${API}/api/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value, type, list: "block", community, reporter, reason: "Reported via Discord" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function buildEmbed(result: CheckResult): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLOR[result.verdict])
    .setTitle(`${EMOJI[result.verdict]} ${result.verdict} — ${result.summary}`.slice(0, 256))
    .setDescription(result.explanation.slice(0, 4096))
    .addFields({ name: "⚠️ What to do", value: result.recommendation.slice(0, 1024) });

  const top = result.signals
    .filter((s) => s.severity === "danger" || s.severity === "caution")
    .slice(0, 5);
  if (top.length) {
    embed.addFields({
      name: "What exSafe checked",
      value: top
        .map((s) => `${DOT[s.severity]} **${s.label}**${s.source ? ` _(${s.source})_` : ""}\n${s.detail}`)
        .join("\n")
        .slice(0, 1024),
    });
  }
  embed.setFooter({
    text: `exSafe Safety Desk • ${result.kind}${result.meta?.chainName ? ` • ${result.meta.chainName}` : ""} • risk ${result.score}`,
  });
  return embed;
}

/** Pick the most check-worthy token out of a chat message. */
function pickCandidate(content: string): string | null {
  const addr = content.match(/\b0x[0-9a-fA-F]{40}\b/);
  if (addr) return addr[0];
  const hex = content.match(/0x[0-9a-fA-F]{60,}/);
  if (hex) return hex[0];
  const url = content.match(/https?:\/\/[^\s]+/i);
  if (url) return url[0];
  const dom = content.match(
    /\b(?:[a-z0-9-]+\.)+(?:io|net|com|xyz|app|co|org|finance|gg|me|dev|fi|club|art|wtf|life|vip|lol|link|site|online)\b[^\s]*/i,
  );
  if (dom) return dom[0];
  return null;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const commands = [
  new SlashCommandBuilder()
    .setName("check")
    .setDescription("Check a link, contract, transaction, or announcement with exSafe")
    .addStringOption((o) =>
      o.setName("input").setDescription("What to check").setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("report")
    .setDescription("Report a scam to this community's blocklist")
    .addStringOption((o) =>
      o.setName("value").setDescription("Domain or 0x address to block").setRequired(true),
    )
    .addStringOption((o) =>
      o
        .setName("type")
        .setDescription("domain or address")
        .addChoices({ name: "domain", value: "domain" }, { name: "address", value: "address" })
        .setRequired(true),
    ),
].map((c) => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log(`Registered ${commands.length} guild commands.`);
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log(`Registered ${commands.length} global commands (may take up to 1h).`);
    }
  } catch (err) {
    console.error("Failed to register commands:", err);
  }
}

client.once(Events.ClientReady, (c) => {
  console.log(`exSafe bot online as ${c.user.tag}. API: ${API}`);
});

// Auto-scan every message.
client.on(Events.MessageCreate, async (message: Message) => {
  if (message.author.bot) return;
  const candidate = pickCandidate(message.content);
  if (!candidate) return;

  const result = await runCheck(candidate, message.guildId ?? undefined);
  if (!result) return;
  // Stay quiet on clearly-safe auto-scans; speak up on caution/danger.
  if (result.verdict === "SAFE") return;

  try {
    await message.reply({ embeds: [buildEmbed(result)] });
  } catch {
    // missing permissions, etc.
  }
});

// Slash commands.
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const i = interaction as ChatInputCommandInteraction;

  if (i.commandName === "check") {
    const input = i.options.getString("input", true);
    await i.deferReply();
    const result = await runCheck(input, i.guildId ?? undefined);
    if (!result) {
      await i.editReply("exSafe couldn't reach the safety desk. Try again shortly.");
      return;
    }
    await i.editReply({ embeds: [buildEmbed(result)] });
    return;
  }

  if (i.commandName === "report") {
    const value = i.options.getString("value", true);
    const type = i.options.getString("type", true) as "domain" | "address";
    await i.deferReply();
    const ok = await report(value, type, i.guildId ?? undefined, i.user.tag);
    await i.editReply(
      ok
        ? `✅ Added \`${value}\` to this community's blocklist. exSafe will now warn on it.`
        : "❌ Could not submit the report.",
    );
  }
});

async function main() {
  await registerCommands();
  await client.login(TOKEN);
}

main().catch((err) => {
  console.error("exSafe bot failed to start:", err);
  process.exit(1);
});
