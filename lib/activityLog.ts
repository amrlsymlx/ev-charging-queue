import { supabase } from "./supabase";

export type ActivityActorRole = "customer" | "sa" | "manager" | "system";

type LogActivityParams = {
  action: string;
  actorRole?: ActivityActorRole;
  actorName?: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
};

// Best-effort activity logging: never throws, never blocks the caller's
// main flow. When actorRole/actorName aren't given explicitly, they're
// resolved from the current Supabase Auth session (customers are never
// signed in, so an absent session logs as "customer").
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    let actorRole = params.actorRole;
    let actorName = params.actorName;

    if (!actorRole) {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      const role = user?.app_metadata?.role || user?.user_metadata?.role;

      actorRole =
        role === "manager" || role === "admin"
          ? "manager"
          : role === "sa"
            ? "sa"
            : "customer";

      if (!actorName) {
        actorName = user?.user_metadata?.name || user?.email || undefined;
      }
    }

    await supabase.from("activity_logs").insert([
      {
        actor_role: actorRole,
        actor_name: actorName || null,
        action: params.action,
        target_type: params.targetType || null,
        target_id: params.targetId || null,
        details: params.details || null,
      },
    ]);
  } catch {
    // Logging must never break the feature it's observing.
  }
}
