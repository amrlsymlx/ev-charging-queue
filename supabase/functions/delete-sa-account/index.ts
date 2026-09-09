// Supabase Edge Function: delete-sa-account
// Deletes an SA user's Supabase Auth account and its sa_users row using the
// service role key. Deleting only the sa_users row (as the client previously
// did) left the Auth user behind, letting the SA still log in.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerToken = authHeader.replace("Bearer ", "");

    if (!callerToken) {
      return new Response(JSON.stringify({ error: "Missing authorization." }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Verify the caller is an authenticated manager before doing anything.
    const {
      data: { user: caller },
      error: callerError,
    } = await adminClient.auth.getUser(callerToken);

    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: "Invalid session." }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const callerRole = caller.app_metadata?.role || caller.user_metadata?.role;

    if (callerRole !== "manager" && callerRole !== "admin") {
      return new Response(JSON.stringify({ error: "Not authorized." }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const { email } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "email is required." }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Find the user by email using the Admin API.
    let userId: string | null = null;

    try {
      const listRes = await adminClient.auth.admin.listUsers();
      const users = listRes?.data?.users || [];
      const match = users.find(
        (u: any) => (u.email || "").toLowerCase() === email.toLowerCase(),
      );
      if (match) userId = match.id;
    } catch (e) {
      // ignore and fall through to "not found" handling below
    }

    if (userId) {
      const { error: deleteAuthError } =
        await adminClient.auth.admin.deleteUser(userId);
      if (deleteAuthError) {
        return new Response(
          JSON.stringify({ error: deleteAuthError.message }),
          { status: 500, headers: corsHeaders },
        );
      }
    }

    const { error: deleteRowError } = await adminClient
      .from("sa_users")
      .delete()
      .eq("email", email);

    if (deleteRowError) {
      return new Response(JSON.stringify({ error: deleteRowError.message }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: corsHeaders },
    );
  }
});
