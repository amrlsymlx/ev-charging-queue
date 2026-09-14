// Supabase Edge Function: create-sa-account
// Creates a Supabase Auth user for a Service Advisor with email_confirm=true,
// so no verification email/step is required — a manager-created account is
// immediately usable. Requires SUPABASE_SERVICE_ROLE_KEY to be set as a
// function secret (never exposed to the client app).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Only the deployed app and local dev servers may read these responses.
// Mobile clients don't send an Origin header and aren't subject to CORS at
// all, so this only affects browser callers.
const PRODUCTION_ORIGIN = "https://kpachargemanage.netlify.app";

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (origin === PRODUCTION_ORIGIN) return true;
  // Expo's web dev server binds to localhost/127.0.0.1 on a variable port.
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function buildCorsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin)
      ? origin!
      : PRODUCTION_ORIGIN,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req.headers.get("Origin"));

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

    const { email, password, name } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "email and password are required." }),
        { status: 400, headers: corsHeaders },
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email address." }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 8 characters." }),
        { status: 400, headers: corsHeaders },
      );
    }

    if (name && name.length > 100) {
      return new Response(JSON.stringify({ error: "Name is too long." }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (name && !/^[A-Za-z0-9]{5,}$/.test(name.trim())) {
      return new Response(
        JSON.stringify({
          error: "Name must be at least 5 characters, letters and numbers only.",
        }),
        { status: 400, headers: corsHeaders },
      );
    }

    const { data: created, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // skip verification entirely
        user_metadata: { role: "sa", name: name || email },
      });

    if (createError || !created.user) {
      return new Response(
        JSON.stringify({
          error: createError?.message || "Failed to create SA account.",
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
            role: "sa",
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

    // Stores the password encrypted (pgcrypto, key held in Supabase Vault) —
    // only the set_sa_password/get_sa_password RPCs can write or read it.
    const { error: passwordError } = await adminClient.rpc("set_sa_password", {
      p_email: email,
      p_password: password,
    });

    if (passwordError) {
      return new Response(JSON.stringify({ error: passwordError.message }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Only managers reach this point — the role check above already
    // rejected anyone else.
    await adminClient.from("activity_logs").insert([
      {
        actor_role: "manager",
        actor_name: caller.email,
        action: "sa_account.create",
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
