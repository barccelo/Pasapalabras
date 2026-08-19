import { appEnv } from "../../../../../db/cloudflare";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  const { id } = await context.params;
  const row = await appEnv.DB.prepare("SELECT state FROM live_sessions WHERE id=?")
    .bind(id).first<{ state: string }>();
  if (!row) return Response.json({ ok: true });

  const current = JSON.parse(row.state) as { finished?: boolean };
  if (current.finished) return Response.json({ ok: true });
  const state = { ...current, running: false, closed: true };
  await appEnv.DB.prepare("UPDATE live_sessions SET state=?, updated_at=? WHERE id=?")
    .bind(JSON.stringify(state), Date.now(), id).run();
  return Response.json({ ok: true });
}
