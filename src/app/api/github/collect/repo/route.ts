import { NextRequest, NextResponse } from "next/server";
import { deleteRepository } from "@/lib/db";

export async function DELETE(request: NextRequest) {
  try {
    const repoKey = request.nextUrl.searchParams.get("key");

    if (!repoKey) {
      return NextResponse.json(
        { error: "key is required" },
        { status: 400 }
      );
    }

    await deleteRepository(repoKey);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
