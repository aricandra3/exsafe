import { NextResponse } from "next/server";
import { z } from "zod";
import { runCheck } from "@/lib/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  input: z.string().min(1).max(20_000),
  community: z.string().optional(),
  chainId: z.string().optional(),
  kind: z
    .enum(["url", "address", "calldata", "typed-data", "announcement", "unknown"])
    .optional(),
  lang: z.enum(["en", "id"]).optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const result = await runCheck(body.input, {
      community: body.community,
      chainId: body.chainId,
      kind: body.kind,
      lang: body.lang,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("check failed", err);
    return NextResponse.json({ error: "Check failed" }, { status: 500 });
  }
}
