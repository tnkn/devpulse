import { NextResponse } from "next/server";
import { getDecryptedToken, testToken } from "@/lib/tokens";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const token = await getDecryptedToken(id);
    if (!token) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    const result = await testToken(token);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
