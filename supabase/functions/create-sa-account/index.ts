// Supabase Edge Function: create-sa-account
// Creates a Supabase Auth user for a Service Advisor with email_confirm=true,
// so no verification email/step is required — a manager-created account is
// immediately usable. Requires SUPABASE_SERVICE_ROLE_KEY to be set as a
// function secret (never exposed to the client app).

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

    const { email, password, name } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "email and password are required." }),
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
      .upsert([{ name: name || email, email, role: "sa" }], {
        onConflict: "email",
      });

    if (upsertError) {
      return new Response(JSON.stringify({ error: upsertError.message }), {
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
