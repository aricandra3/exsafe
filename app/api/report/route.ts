import { NextResponse } from "next/server";
import { z } from "zod";
import { community } from "@/lib/community/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  value: z.string().min(1).max(400),
  type: z.enum(["domain", "address"]),
  list: z.enum(["allow", "block"]).default("block"),
  reason: z.string().max(300).optional(),
  community: z.string().max(100).optional(),
  reporter: z.string().max(100).optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const entry = community.add({
    value: body.value,
    type: body.type,
    list: body.list,
    reason: body.reason,
    community: body.community,
    reporter: body.reporter,
  });

  return NextResponse.json({ ok: true, entry });
}
