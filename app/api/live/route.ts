const schema = `CREATE TABLE IF NOT EXISTS live_sessions (
  id TEXT PRIMARY KEY,
  game_title TEXT NOT NULL,
  state TEXT NOT NULL,
  updated_at INTEGER NOT NULL
)`;

import { appEnv } from "../../../db/cloudflare";

async function init() { await appEnv.DB.prepare(schema).run(); }

export async function POST(request: Request) {
  await init();
  const body = await request.json() as { gameTitle?: string; state?: unknown };
  const id = crypto.randomUUID().split("-")[0];
  await appEnv.DB.prepare("INSERT INTO live_sessions (id,game_title,state,updated_at) VALUES (?,?,?,?)")
    .bind(id, body.gameTitle || "Pasapalabras", JSON.stringify(body.state || {}), Date.now()).run();
  return Response.json({ id }, { status: 201 });
}
