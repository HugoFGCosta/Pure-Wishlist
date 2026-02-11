import { Session } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";
import { supabaseAdmin } from "./db.server";

const TABLE = "shopify_sessions";

/**
 * Custom session storage using Supabase REST client instead of pg directly.
 * This avoids the SSL configuration bug in the official PostgreSQL adapter
 * where ?sslmode=require is silently dropped when parsing the connection URL.
 */
export class SupabaseSessionStorage implements SessionStorage {
  constructor() {
    // Table must exist — create via migration or Supabase dashboard
  }

  async storeSession(session: Session): Promise<boolean> {
    const entries = session.toPropertyArray();
    const row: Record<string, any> = {};
    for (const [key, value] of entries) {
      // Convert expires from ms to seconds (Shopify convention)
      row[key] = key === "expires" ? Math.floor((value as number) / 1000) : value;
    }
    const { error } = await supabaseAdmin
      .from(TABLE)
      .upsert(row, { onConflict: "id" });
    if (error) {
      console.error("storeSession error:", error);
      return false;
    }
    return true;
  }

  async loadSession(id: string): Promise<Session | undefined> {
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return undefined;
    return this.rowToSession(data);
  }

  async deleteSession(id: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from(TABLE)
      .delete()
      .eq("id", id);
    if (error) {
      console.error("deleteSession error:", error);
      return false;
    }
    return true;
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from(TABLE)
      .delete()
      .in("id", ids);
    if (error) {
      console.error("deleteSessions error:", error);
      return false;
    }
    return true;
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .select("*")
      .eq("shop", shop);
    if (error || !data) return [];
    return data.map((row) => this.rowToSession(row));
  }

  private rowToSession(row: Record<string, any>): Session {
    // Convert expires from seconds back to milliseconds
    if (row.expires) row.expires = row.expires * 1000;
    return Session.fromPropertyArray(Object.entries(row));
  }
}
