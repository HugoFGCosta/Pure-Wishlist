import { Session } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";
import { supabaseAdmin } from "./db.server";

const TABLE = "shopify_sessions";

export class SupabaseSessionStorage implements SessionStorage {
  private tableReady: Promise<void>;

  constructor() {
    this.tableReady = this.ensureTable();
  }

  private async ensureTable() {
    // Auto-create table if it doesn't exist (via raw SQL through Supabase rpc or direct query)
    // We test with a simple select; if it fails, we create the table
    const { error } = await supabaseAdmin.from(TABLE).select("id").limit(0);
    if (error) {
      console.log(`[session-storage] Table ${TABLE} not found, creating...`, error.message);
      const { error: rpcError } = await supabaseAdmin.rpc("exec_sql", {
        query: `
          CREATE TABLE IF NOT EXISTS "${TABLE}" (
            "id" VARCHAR(255) NOT NULL PRIMARY KEY,
            "shop" VARCHAR(255) NOT NULL,
            "state" VARCHAR(255) NOT NULL,
            "isOnline" BOOLEAN NOT NULL DEFAULT false,
            "scope" VARCHAR(255),
            "expires" INTEGER,
            "onlineAccessInfo" VARCHAR(255),
            "accessToken" VARCHAR(255)
          );
          CREATE INDEX IF NOT EXISTS idx_shopify_sessions_shop ON "${TABLE}"("shop");
        `,
      });
      if (rpcError) {
        // rpc might not exist — user must create table manually
        console.error(`[session-storage] Could not auto-create table. Run migration 005_shopify_sessions.sql manually.`, rpcError.message);
      }
    } else {
      console.log(`[session-storage] Table ${TABLE} exists, ready.`);
    }
  }

  async storeSession(session: Session): Promise<boolean> {
    await this.tableReady;
    const entries = session.toPropertyArray();
    const row: Record<string, any> = {};
    for (const [key, value] of entries) {
      row[key] = key === "expires" ? Math.floor((value as number) / 1000) : value;
    }
    console.log(`[session-storage] storeSession id=${session.id} shop=${session.shop}`);
    const { error } = await supabaseAdmin
      .from(TABLE)
      .upsert(row, { onConflict: "id" });
    if (error) {
      console.error("[session-storage] storeSession error:", error);
      return false;
    }
    return true;
  }

  async loadSession(id: string): Promise<Session | undefined> {
    await this.tableReady;
    console.log(`[session-storage] loadSession id=${id}`);
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) {
      console.log(`[session-storage] loadSession id=${id} → not found`, error?.message);
      return undefined;
    }
    console.log(`[session-storage] loadSession id=${id} → found shop=${data.shop}`);
    return this.rowToSession(data);
  }

  async deleteSession(id: string): Promise<boolean> {
    await this.tableReady;
    console.log(`[session-storage] deleteSession id=${id}`);
    const { error } = await supabaseAdmin
      .from(TABLE)
      .delete()
      .eq("id", id);
    if (error) {
      console.error("[session-storage] deleteSession error:", error);
      return false;
    }
    return true;
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    await this.tableReady;
    console.log(`[session-storage] deleteSessions ids=${ids.join(",")}`);
    const { error } = await supabaseAdmin
      .from(TABLE)
      .delete()
      .in("id", ids);
    if (error) {
      console.error("[session-storage] deleteSessions error:", error);
      return false;
    }
    return true;
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    await this.tableReady;
    console.log(`[session-storage] findSessionsByShop shop=${shop}`);
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .select("*")
      .eq("shop", shop);
    if (error || !data) {
      console.log(`[session-storage] findSessionsByShop shop=${shop} → error`, error?.message);
      return [];
    }
    console.log(`[session-storage] findSessionsByShop shop=${shop} → ${data.length} sessions`);
    return data.map((row) => this.rowToSession(row));
  }

  private rowToSession(row: Record<string, any>): Session {
    if (row.expires) row.expires = row.expires * 1000;
    return Session.fromPropertyArray(Object.entries(row));
  }
}
