import { type NextRequest, NextResponse } from "next/server";
import { startCollection } from "@/lib/github";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { owner, repo, token_id } = body;
    // Three states, so absence has to be told from an explicit null:
    // absent carries on from the last run, a timestamp widens the
    // window, null re-reads everything.
    const sinceOverride: string | null | undefined =
      body.full === true
        ? null
        : typeof body.since === "string" && body.since
          ? body.since
          : undefined;

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "owner and repo are required" },
        { status: 400 },
      );
    }

    const job = startCollection(owner, repo, token_id, sinceOverride);
    return NextResponse.json(job, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
