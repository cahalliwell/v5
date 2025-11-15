import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Client user context
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const userId = user.id;

    // Delete all user-related data
    await supabaseClient.from("JournalEntries").delete().eq("user_id", userId);
    await supabaseClient.from("insights_summary").delete().eq("user_id", userId);
    await supabaseClient.from("insights_counts").delete().eq("user_id", userId);
    await supabaseClient.from("insights_weekly").delete().eq("user_id", userId);
    await supabaseClient.from("insights_monthly").delete().eq("user_id", userId);
    await supabaseClient.from("insights_top5_casts").delete().eq("user_id", userId);
    await supabaseClient.from("profiles").delete().eq("id", userId);

    // Delete the Supabase Auth user
    const { error: delError } = await supabaseClient.auth.admin.deleteUser(userId);
    if (delError) throw delError;

    return new Response("Deleted", { status: 200 });
  } catch (err) {
    return new Response(err.message, { status: 500 });
  }
});
