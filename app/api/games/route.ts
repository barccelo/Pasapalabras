const schema = `CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  words TEXT NOT NULL,
  mode TEXT NOT NULL,
  duration INTEGER NOT NULL,
  team_a TEXT NOT NULL,
  team_b TEXT NOT NULL,
  created_at INTEGER NOT NULL
)`;

import { appEnv } from "../../../db/cloudflare";

async function init() {
  await appEnv.DB.prepare(schema).run();
  await appEnv.DB.prepare("CREATE INDEX IF NOT EXISTS games_category_idx ON games(category)").run();
}

export async function GET() {
  await init();
  const result = await appEnv.DB.prepare("SELECT id, title, category, words, mode, duration, team_a AS teamA, team_b AS teamB, created_at AS createdAt FROM games ORDER BY created_at DESC").all();
  return Response.json(result.results);
}

export async function POST(request: Request) {
  await init();
  const body = await request.json() as { title?: string; category?: string; words?: string; mode?: string; duration?: number; teamNames?: string[] };
  if (!body.title?.trim() || !body.category?.trim() || !body.words?.trim()) return Response.json({ error: "Faltan datos" }, { status: 400 });
  const id = crypto.randomUUID();
  await appEnv.DB.prepare("INSERT INTO games (id,title,category,words,mode,duration,team_a,team_b,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(id, body.title.trim(), body.category.trim(), body.words, body.mode || "solo", body.duration || 120, body.teamNames?.[0] || "Equipo A", body.teamNames?.[1] || "Equipo B", Date.now()).run();
  return Response.json({ id }, { status: 201 });
}
