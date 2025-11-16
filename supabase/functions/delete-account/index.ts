import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401 });
    }

    const tokenMatch = authHeader.match(/^Bearer\s+(.*)$/i);
    if (!tokenMatch) {
      return new Response("Unauthorized", { status: 401 });
    }

    const accessToken = tokenMatch[1];

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error("Supabase credentials are not configured.");
    }

    const supabaseAuthed = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await supabaseAuthed.auth.getUser();

    if (userError || !user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const userId = user.id;

    const tablesToWipe = [
      { table: "JournalEntries", column: "user_id" },
      { table: "insights_summary", column: "user_id" },
      { table: "insights_counts", column: "user_id" },
      { table: "insights_weekly", column: "user_id" },
      { table: "insights_monthly", column: "user_id" },
      { table: "insights_top5_casts", column: "user_id" },
      { table: "profiles", column: "id" },
    ];

    for (const { table, column } of tablesToWipe) {
      const { error } = await supabaseAdmin.from(table).delete().eq(column, userId);
      if (error) {
        throw new Error(`Failed to delete from ${table}: ${error.message}`);
      }
    }

    const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (delError) {
      throw new Error(`Failed to delete auth user: ${delError.message}`);
    }

    return new Response("Deleted", { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return new Response(message, { status: 500 });
  }
});
