// Supabase Edge Function: create-manager-account
// Invites a new Manager via Supabase Auth's inviteUserByEmail — unlike SA
// accounts, manager accounts require email verification. The invited
// manager receives an email with a link to confirm their address and set
// their own password; no password is set or seen by the inviting manager.
// Requires SUPABASE_SERVICE_ROLE_KEY to be set as a function secret (never
// exposed to the client app).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Allow calls from the Expo web dev server / any origin (mobile clients ignore CORS).
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

    const { email, name, redirectTo } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "email is required." }),
        { status: 400, headers: corsHeaders },
      );
    }

    // Without an explicit redirectTo, Supabase sends the invitee to the
    // project's default Site URL, which normally has nothing that reads the
    // invite's access/refresh tokens from the URL — the invite link would
    // load but silently do nothing. The client passes the actual app URL
    // for admin/reset-password.tsx, which does parse and apply those tokens.
    const { data: created, error: createError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        data: { role: "manager", name: name || email },
        ...(redirectTo ? { redirectTo } : {}),
      });

    if (createError || !created.user) {
      return new Response(
        JSON.stringify({
          error: createError?.message || "Failed to invite manager account.",
        }),
        { status: 400, headers: corsHeaders },
      );
    }

    const { error: upsertError } = await adminClient
      .from("sa_users")
      .upsert(
        [
          {
            name: name || email,
            email,
            role: "manager",
            password_plaintext: null,
          },
        ],
        {
          onConflict: "email",
        },
      );

    if (upsertError) {
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    await adminClient.from("activity_logs").insert([
      {
        actor_role: "manager",
        actor_name: caller.email,
        action: "manager_account.invite",
        target_type: "sa_user",
        target_id: created.user.id,
        details: { email, name: name || email },
      },
    ]);

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
