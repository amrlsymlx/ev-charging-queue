// Supabase Edge Function: reset-sa-password
// Resets an SA user's password using the service role key.

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

    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "email and password are required." }),
        { status: 400, headers: corsHeaders },
      );
    }

    // Find the user by email using the Admin API.
    let userId: string | null = null;

    try {
      // @ts-ignore
      if (typeof adminClient.auth.admin.listUsers === "function") {
        // @ts-ignore
        const listRes = await adminClient.auth.admin.listUsers();
        // @ts-ignore
        const users = listRes?.data?.users || listRes?.users || [];
        const match = users.find(
          (u: any) => (u.email || "").toLowerCase() === email.toLowerCase(),
        );
        if (match) userId = match.id;
      }
    } catch (e) {
      // ignore and try alternative below
    }

    if (!userId) {
      // try adminClient.auth.admin.getUserByEmail if available
      try {
        // @ts-ignore
        if (typeof adminClient.auth.admin.getUserByEmail === "function") {
          // @ts-ignore
          const getRes = await adminClient.auth.admin.getUserByEmail(email);
          // @ts-ignore
          if (getRes && getRes.data && getRes.data.user)
            userId = getRes.data.user.id;
        }
      } catch (e) {
        // ignore
      }
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "SA user not found." }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Attempt to update the user's password using admin API
    try {
      // @ts-ignore
      if (typeof adminClient.auth.admin.updateUserById === "function") {
        // @ts-ignore
        const upd = await adminClient.auth.admin.updateUserById(userId, {
          password,
        });
        // @ts-ignore
        if (upd.error) throw upd.error;
      } else {
        // Fallback: use the REST admin endpoint directly
        const resp = await fetch(
          `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/admin/users/${userId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              apikey: SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ password }),
          },
        );

        if (!resp.ok) {
          const txt = await resp.text();
          throw new Error(`Admin API failed: ${resp.status} ${txt}`);
        }
      }
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e?.message || String(e) }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Keep the manager-visible plaintext copy in sync with the new password.
    await adminClient
      .from("sa_users")
      .update({ password_plaintext: password })
      .eq("email", email);

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
