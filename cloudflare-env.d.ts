/// <reference types="@cloudflare/workers-types" />

declare global {
  interface Env {
    ASSETS: Fetcher;
    DB: D1Database;
  }
}

export {};
