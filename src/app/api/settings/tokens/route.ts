import { NextResponse } from "next/server";
import {
  listTokens,
  addToken,
  testToken,
  isTokenUIAllowed,
} from "@/lib/tokens";

export async function GET() {
  try {
    const tokens = await listTokens();
    return NextResponse.json({
      tokens,
      allowTokenUI: isTokenUIAllowed(),
      hasEnvToken: !!process.env.GITHUB_TOKEN,
    });
  } catch (err) {
    console.error("[tokens] GET error:", err);
    return NextResponse.json({
      tokens: [],
      allowTokenUI: isTokenUIAllowed(),
      hasEnvToken: !!process.env.GITHUB_TOKEN,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

export async function POST(request: Request) {
  if (!isTokenUIAllowed()) {
    return NextResponse.json(
      { error: "Token management is disabled (ALLOW_TOKEN_UI=false)" },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { label, token } = body as { label: string; token: string };

    if (!label || !token) {
      return NextResponse.json(
        { error: "label and token are required" },
        { status: 400 }
      );
    }

    // Validate token against GitHub API
    const validation = await testToken(token);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Invalid token: ${validation.error}` },
        { status: 400 }
      );
    }

    const created = await addToken(label, token);
    return NextResponse.json({ token: created, login: validation.login });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
