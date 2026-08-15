type Context = { params: Promise<{ id: string }> };

import { appEnv } from "../../../../db/cloudflare";

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  const row = await appEnv.DB.prepare("SELECT game_title AS gameTitle, state, updated_at AS updatedAt FROM live_sessions WHERE id=?").bind(id).first<{ gameTitle: string; state: string; updatedAt: number }>();
  if (!row) return Response.json({ error: "Sesión no encontrada" }, { status: 404 });
  return Response.json({ ...row, state: { ...JSON.parse(row.state), hostOnline: Date.now() - row.updatedAt < 15000 } });
}

export async function PUT(request: Request, context: Context) {
  const { id } = await context.params;
  const body = await request.json() as { state?: unknown };
  await appEnv.DB.prepare("UPDATE live_sessions SET state=?, updated_at=? WHERE id=?").bind(JSON.stringify(body.state || {}), Date.now(), id).run();
  return Response.json({ ok: true });
}
