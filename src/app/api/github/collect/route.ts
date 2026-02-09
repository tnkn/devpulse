import { NextRequest, NextResponse } from "next/server";
import { startCollection } from "@/lib/github";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { owner, repo } = body;

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "owner and repo are required" },
        { status: 400 }
      );
    }

    const job = startCollection(owner, repo);
    return NextResponse.json(job, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
