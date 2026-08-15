import { appEnv } from "../../../../db/cloudflare";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id) return Response.json({ error: "Falta el identificador" }, { status: 400 });
  await appEnv.DB.prepare("DELETE FROM games WHERE id = ?").bind(id).run();
  return Response.json({ ok: true });
}
