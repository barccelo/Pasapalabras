import { env as platformEnv } from "cloudflare:workers";

type AppEnv = typeof platformEnv & {
  ASSETS: Fetcher;
  DB: D1Database;
};

export const appEnv = platformEnv as AppEnv;
