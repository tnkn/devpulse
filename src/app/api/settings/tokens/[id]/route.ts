import { NextResponse } from "next/server";
import { deleteToken, isTokenUIAllowed, updateToken } from "@/lib/tokens";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTokenUIAllowed()) {
    return NextResponse.json(
      { error: "Token management is disabled (ALLOW_TOKEN_UI=false)" },
      { status: 403 },
    );
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const updates: { label?: string; is_default?: boolean } = {};

    if (body.label !== undefined) updates.label = body.label;
    if (body.is_default !== undefined) updates.is_default = body.is_default;

    await updateToken(id, updates);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTokenUIAllowed()) {
    return NextResponse.json(
      { error: "Token management is disabled (ALLOW_TOKEN_UI=false)" },
      { status: 403 },
    );
  }

  try {
    const { id } = await params;
    await deleteToken(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
