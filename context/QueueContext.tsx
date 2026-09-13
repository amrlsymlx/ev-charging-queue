import {
    PropsWithChildren,
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { logActivity } from "@/lib/activityLog";
import { getRemainingSeconds } from "@/lib/eta";
import { supabase } from "@/lib/supabase";
import {
    ChargingBay,
    ChargingSession,
    NewQueueEntryInput,
    NewStaffQueueEntryInput,
    QueueEntry,
    SAUser,
} from "@/types/domain";

interface QueueContextValue {
  bays: ChargingBay[];
  queueEntries: QueueEntry[];
  chargingSessions: ChargingSession[];
  saUsers: SAUser[];
  waitingEntries: QueueEntry[];
  activeSessions: ChargingSession[];
  pendingOverrideEntries: QueueEntry[];
  defaultChargingMinutes: number;
  showroomName: string;
  rainMode: boolean;
  setRainMode: (
    enabled: boolean,
    actor: { actorRole: "sa" | "manager"; actorName?: string },
  ) => Promise<void>;
  addQueueEntry: (input: NewQueueEntryInput) => Promise<QueueEntry>;
  addStaffQueueEntry: (input: NewStaffQueueEntryInput) => Promise<QueueEntry>;
  getQueueEntryById: (entryId: string) => QueueEntry | undefined;
  findLatestEntryByPlate: (plateNumber: string) => QueueEntry | undefined;
  getQueuePosition: (entryId: string) => number | null;
  getEtaForEntry: (entryId: string) => number;
  getEtaForPosition: (position: number) => number;
  startCharging: (
    entryId: string,
    bayId: string,
    saName: string,
  ) => Promise<boolean>;
  endCharging: (sessionId: string) => Promise<boolean>;
  removeQueueEntry: (entryId: string) => Promise<void>;
  deleteQueueEntries: (entryIds: string[]) => Promise<{ error?: string }>;
  approveOverride: (entryId: string) => Promise<void>;
  rejectOverride: (entryId: string) => Promise<void>;
  addBay: (name: string) => Promise<void>;
  renameBay: (bayId: string, name: string) => Promise<void>;
  deleteBay: (bayId: string) => Promise<void>;
  setBayEnabled: (
    bayId: string,
    enabled: boolean,
    reason?: string,
  ) => Promise<void>;
}

const QueueContext = createContext<QueueContextValue | null>(null);

const GRACE_MINUTES = 5;
const CHARGING_MINUTES = 60;

const INITIAL_SA_USERS: SAUser[] = [];

// Columns the anon (customer) role is granted; phone_number is deliberately
// excluded at the database column-privilege level, so this list must match.
const ANON_QUEUE_COLUMNS =
  "id, name, plate_number, battery_percentage, joined_at, status, gps_validated, gps_override_requested, gps_override_approved, agreed_to_terms, bay_id, created_at, updated_at";

function mapBay(row: any): ChargingBay {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    enabled: row.enabled ?? true,
    disabledReason: row.disabled_reason ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapQueueEntry(row: any): QueueEntry {
  return {
    id: row.id,
    name: row.name,
    phoneNumber: row.phone_number ?? "",
    plateNumber: row.plate_number,
    batteryPercentage: row.battery_percentage,
    joinedAt: row.joined_at,
    status: row.status,
    gpsValidated: row.gps_validated,
    gpsOverrideRequested: row.gps_override_requested,
    gpsOverrideApproved: row.gps_override_approved,
    agreedToTerms: row.agreed_to_terms ?? false,
    bayId: row.bay_id ?? undefined,
    overrideChargingMinutes: row.override_charging_minutes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSession(row: any): ChargingSession {
  return {
    id: row.id,
    queueEntryId: row.queue_entry_id ?? "",
    bayId: row.bay_id,
    saName: row.sa_name,
    graceMinutes: row.grace_minutes,
    chargingMinutes: row.charging_minutes,
    plannedDurationMinutes: row.planned_duration_minutes,
    actualDurationMinutes: row.actual_duration_minutes ?? undefined,
    startedAt: row.started_at ?? undefined,
    endedAt: row.ended_at ?? undefined,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function QueueProvider({ children }: PropsWithChildren) {
  const [bays, setBays] = useState<ChargingBay[]>([]);
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [chargingSessions, setChargingSessions] = useState<ChargingSession[]>(
    [],
  );
  const [isStaff, setIsStaff] = useState(false);
  const [graceMinutes, setGraceMinutes] = useState(GRACE_MINUTES);
  const [chargingMinutes, setChargingMinutes] = useState(CHARGING_MINUTES);
  const [rainMode, setRainModeState] = useState(false);
  const [showroomName, setShowroomName] = useState("Main Showroom");

  const isStaffRef = useRef(isStaff);
  isStaffRef.current = isStaff;

  const loggedOvertimeRef = useRef<Set<string>>(new Set());

  const loadTimerSettings = async () => {
    const { data, error } = await supabase
      .from("showroom_settings")
      .select("grace_minutes, charging_minutes, rain_mode, showroom_name")
      .eq("id", "main")
      .maybeSingle();
    if (!error && data) {
      if (typeof data.grace_minutes === "number") {
        setGraceMinutes(data.grace_minutes);
      }
      if (typeof data.charging_minutes === "number") {
        setChargingMinutes(data.charging_minutes);
      }
      if (typeof data.rain_mode === "boolean") {
        setRainModeState(data.rain_mode);
      }
      if (typeof data.showroom_name === "string" && data.showroom_name) {
        setShowroomName(data.showroom_name);
      }
    }
  };

  const loadBays = async () => {
    const { data, error } = await supabase
      .from("bays")
      .select("*")
      .order("id", { ascending: true });
    if (!error && data) setBays(data.map(mapBay));
  };

  const loadChargingSessions = async () => {
    const { data, error } = await supabase
      .from("charging_sessions")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setChargingSessions(data.map(mapSession));
  };

  const loadQueueEntries = async () => {
    const query = supabase
      .from("queue_entries")
      .select(isStaffRef.current ? "*" : ANON_QUEUE_COLUMNS)
      .order("joined_at", { ascending: true });
    const { data, error } = await query;
    if (!error && data) setQueueEntries((data as any[]).map(mapQueueEntry));
  };

  // Track whether the current Supabase Auth session belongs to SA/manager
  // staff, since that changes both which columns we can read and whether we
  // get realtime pushes vs. polling for queue_entries.
  useEffect(() => {
    const resolveStaff = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        const role = user?.app_metadata?.role || user?.user_metadata?.role;
        setIsStaff(role === "sa" || role === "manager" || role === "admin");
      } catch {
        setIsStaff(false);
      }
    };

    resolveStaff();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      resolveStaff();
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    loadBays();
    loadChargingSessions();
    loadQueueEntries();
    loadTimerSettings();

    const baysChannel = supabase
      .channel("public:bays")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bays" },
        () => loadBays(),
      )
      .subscribe();

    const showroomSettingsChannel = supabase
      .channel("public:showroom_settings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "showroom_settings" },
        () => loadTimerSettings(),
      )
      .subscribe();

    const sessionsChannel = supabase
      .channel("public:charging_sessions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "charging_sessions" },
        () => {
          loadChargingSessions();
          loadQueueEntries();
        },
      )
      .subscribe();

    // queue_entries carries phone numbers, so it's deliberately excluded from
    // the realtime publication (RLS row-visibility doesn't guarantee a WAL
    // broadcast masks columns). Poll it instead; staff gets a shorter
    // interval since they act on it directly.
    const pollMs = isStaff ? 4000 : 5000;
    const interval = setInterval(loadQueueEntries, pollMs);

    return () => {
      supabase.removeChannel(baysChannel);
      supabase.removeChannel(sessionsChannel);
      supabase.removeChannel(showroomSettingsChannel);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaff]);

  // Entries with status "waiting", regardless of GPS approval. Entries still
  // pending GPS override approval are NOT yet in the queue proper — they
  // only surface via pendingOverrideEntries until an SA approves them.
  const allWaitingEntries = useMemo(
    () =>
      queueEntries
        .filter((entry) => entry.status === "waiting")
        .sort((a, b) => +new Date(a.joinedAt) - +new Date(b.joinedAt)),
    [queueEntries],
  );

  const waitingEntries = useMemo(
    () =>
      allWaitingEntries.filter(
        (entry) => entry.gpsValidated || entry.gpsOverrideApproved,
      ),
    [allWaitingEntries],
  );

  const activeSessions = useMemo(
    () => chargingSessions.filter((session) => session.status === "active"),
    [chargingSessions],
  );

  // Auto-detects sessions where charging finished but nobody (SA or system)
  // has ended the session 5+ minutes past the planned end time — logs "Over
  // Time" without waiting for an SA/manager action. loggedOvertimeRef avoids
  // re-checking the same session on every poll tick within this client; the
  // activity_logs lookup guards against duplicate rows across multiple
  // clients (customer/SA/admin apps) that each run this same check.
  useEffect(() => {
    const checkOvertime = async () => {
      const now = Date.now();

      for (const session of activeSessions) {
        if (!session.startedAt) continue;
        if (loggedOvertimeRef.current.has(session.id)) continue;

        const plannedEndTime =
          +new Date(session.startedAt) +
          session.plannedDurationMinutes * 60000;
        const overtimeMinutes = Math.floor((now - plannedEndTime) / 60000);
        if (overtimeMinutes < 5) continue;

        const entry = queueEntries.find(
          (item) => item.id === session.queueEntryId,
        );
        // queueEntries may not have loaded this entry yet (e.g. right after
        // mount) — skip without marking as logged so it retries next tick
        // instead of permanently falling back to the raw queueEntryId.
        if (!entry) continue;
        const plateNumber = entry.plateNumber;

        loggedOvertimeRef.current.add(session.id);

        const { data: existing } = await supabase
          .from("activity_logs")
          .select("id")
          .eq("action", "over_time")
          .eq("target_type", "queue_entry")
          .eq("target_id", plateNumber)
          .gte("created_at", session.startedAt)
          .limit(1);

        if (existing && existing.length > 0) continue;

        void logActivity({
          action: "over_time",
          actorRole: "customer",
          actorName: plateNumber,
          targetType: "queue_entry",
          targetId: plateNumber,
          details: {
            plateNumber,
            bayId: session.bayId,
            overtimeMinutes,
          },
        });
      }
    };

    checkOvertime();
    const interval = setInterval(checkOvertime, 30000);
    return () => clearInterval(interval);
  }, [activeSessions, queueEntries]);

  const pendingOverrideEntries = useMemo(
    () =>
      allWaitingEntries.filter(
        (entry) => entry.gpsOverrideRequested && !entry.gpsOverrideApproved,
      ),
    [allWaitingEntries],
  );

  const addQueueEntry = async (
    input: NewQueueEntryInput,
  ): Promise<QueueEntry> => {
    const timestamp = new Date().toISOString();

    const { data, error } = await supabase
      .from("queue_entries")
      .insert([
        {
          name: input.name,
          phone_number: input.phoneNumber,
          plate_number: input.plateNumber.trim().toUpperCase(),
          battery_percentage: input.batteryPercentage,
          joined_at: timestamp,
          status: "waiting",
          gps_validated: input.gpsValidated,
          gps_override_requested: input.gpsOverrideRequested,
          gps_override_approved: false,
          agreed_to_terms: input.agreedToTerms,
        },
      ])
      .select(ANON_QUEUE_COLUMNS)
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Failed to join queue.");
    }

    const entry = mapQueueEntry(data);
    setQueueEntries((prev) => [...prev, entry]);

    void logActivity({
      action: "queue.join",
      actorRole: "customer",
      actorName: input.name,
      targetType: "queue_entry",
      targetId: entry.id,
      details: {
        plateNumber: entry.plateNumber,
        gpsValidated: entry.gpsValidated,
        gpsOverrideRequested: entry.gpsOverrideRequested,
      },
    });

    return entry;
  };

  // SA-created entries for internal/priority/delivery/service vehicles —
  // skips the customer GPS flow entirely (staff are on-site by definition)
  // and lets the SA set a per-entry charging-time override up front.
  const addStaffQueueEntry = async (
    input: NewStaffQueueEntryInput,
  ): Promise<QueueEntry> => {
    const timestamp = new Date().toISOString();

    const { data, error } = await supabase
      .from("queue_entries")
      .insert([
        {
          name: input.note.trim() || input.category,
          phone_number: "-",
          plate_number: input.category,
          battery_percentage: input.batteryPercentage,
          joined_at: timestamp,
          status: "waiting",
          gps_validated: true,
          gps_override_requested: false,
          gps_override_approved: true,
          agreed_to_terms: false,
          override_charging_minutes: input.overrideChargingMinutes ?? null,
        },
      ])
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Failed to add queue entry.");
    }

    const entry = mapQueueEntry(data);
    setQueueEntries((prev) => [...prev, entry]);

    void logActivity({
      action: "queue.staff_add",
      targetType: "queue_entry",
      targetId: entry.id,
      details: {
        category: input.category,
        note: input.note,
        overrideChargingMinutes: input.overrideChargingMinutes,
      },
    });

    return entry;
  };

  const getQueueEntryById = (entryId: string) =>
    queueEntries.find((entry) => entry.id === entryId);

  const findLatestEntryByPlate = (plateNumber: string) => {
    const needle = plateNumber.trim().toUpperCase();
    const sortedMatches = queueEntries
      .filter((entry) => entry.plateNumber === needle)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    return sortedMatches[0];
  };

  const getQueuePosition = (entryId: string) => {
    const index = waitingEntries.findIndex((entry) => entry.id === entryId);
    return index >= 0 ? index + 1 : null;
  };

  // Returns ETA in seconds for a given 1-indexed queue position. Position 1
  // is served by whichever bay frees up soonest; position 2 by whichever bay
  // frees up second-soonest; and so on — each further position simulates the
  // person ahead of them occupying the bay they were assigned to for a full
  // grace+charging slot.
  const getEtaForPosition = (position: number) => {
    const enabledBays = bays.filter((bay) => bay.enabled);

    if (position < 1 || enabledBays.length === 0) {
      return 0;
    }

    const activeSessionByBay = new Map(
      activeSessions.map((session) => [session.bayId, session]),
    );

    const freeTimes = enabledBays
      .map((bay) => {
        const session = activeSessionByBay.get(bay.id);
        if (!session?.startedAt) return 0;
        return getRemainingSeconds(session.startedAt, session.plannedDurationMinutes);
      })
      .sort((a, b) => a - b);

    // Round-robin across the sorted free times: the first `bayCount`
    // positions are served by each bay's own current free time (soonest to
    // latest); position `bayCount + k` reuses the same bay as position `k`,
    // one full default slot later. Picking whichever bay is momentarily
    // soonest at each step (instead of this fixed pairing) would let an
    // unusually short-remaining bay get "recycled" ahead of a bay that's
    // merely running an unusually long session — e.g. it would place
    // position 2 on bay 1's *next* slot instead of bay 2's current one,
    // even though bay 2 frees first.
    const bayCount = freeTimes.length;
    const lane = (position - 1) % bayCount;
    const cycleCount = Math.floor((position - 1) / bayCount);

    let eta = freeTimes[lane];

    // Every earlier cycle on this same lane is occupied by whichever
    // waiting-queue entry actually holds that queue position — its own
    // charging-time override (if the SA set one), not the global default,
    // is how long the bay stays busy before the next entry in this lane
    // can start. Using the global default here would, e.g., free a bay
    // "early" for a later position even though the entry ahead of it in
    // the same lane is a 300-minute override that hasn't started yet.
    for (let cycle = 0; cycle < cycleCount; cycle++) {
      const laneQueuePosition = lane + 1 + cycle * bayCount;
      const laneEntry = waitingEntries[laneQueuePosition - 1];
      const laneChargingMinutes = laneEntry?.overrideChargingMinutes ?? chargingMinutes;
      eta += (graceMinutes + laneChargingMinutes) * 60;
    }

    return eta;
  };

  const getEtaForEntry = (entryId: string) => {
    const position = getQueuePosition(entryId);
    if (!position) {
      return 0;
    }
    return getEtaForPosition(position);
  };

  const startCharging = async (
    entryId: string,
    bayId: string,
    saName: string,
  ) => {
    const entry = queueEntries.find((current) => current.id === entryId);
    const bay = bays.find((current) => current.id === bayId);

    if (!entry || !bay || bay.status !== "available" || !bay.enabled) {
      return false;
    }

    if (
      entry.status !== "waiting" ||
      (!entry.gpsValidated && !entry.gpsOverrideApproved)
    ) {
      return false;
    }

    const timestamp = new Date().toISOString();
    const effectiveChargingMinutes =
      entry.overrideChargingMinutes ?? chargingMinutes;

    const { error: entryError } = await supabase
      .from("queue_entries")
      .update({ status: "charging", bay_id: bayId, updated_at: timestamp })
      .eq("id", entryId);

    if (entryError) return false;

    const { error: bayError } = await supabase
      .from("bays")
      .update({ status: "occupied", updated_at: timestamp })
      .eq("id", bayId);

    if (bayError) return false;

    const { error: sessionError } = await supabase
      .from("charging_sessions")
      .insert([
        {
          queue_entry_id: entryId,
          bay_id: bayId,
          sa_name: saName,
          grace_minutes: graceMinutes,
          charging_minutes: effectiveChargingMinutes,
          planned_duration_minutes: graceMinutes + effectiveChargingMinutes,
          status: "active",
          started_at: timestamp,
        },
      ]);

    if (sessionError) return false;

    await Promise.all([loadQueueEntries(), loadBays(), loadChargingSessions()]);

    void logActivity({
      action: "session.start",
      actorName: saName,
      targetType: "queue_entry",
      targetId: entryId,
      details: {
        bayId,
        plateNumber: entry.plateNumber,
        chargingMinutes: effectiveChargingMinutes,
      },
    });

    return true;
  };

  const endCharging = async (sessionId: string) => {
    const session = chargingSessions.find(
      (current) => current.id === sessionId,
    );

    if (!session || session.status !== "active" || !session.startedAt) {
      return false;
    }

    const timestamp = new Date().toISOString();
    const actualDurationMinutes = Math.max(
      Math.floor((+new Date(timestamp) - +new Date(session.startedAt)) / 60000),
      0,
    );

    const { error: sessionError } = await supabase
      .from("charging_sessions")
      .update({
        status: "completed",
        actual_duration_minutes: actualDurationMinutes,
        ended_at: timestamp,
      })
      .eq("id", sessionId);

    if (sessionError) return false;

    await supabase
      .from("queue_entries")
      .update({ status: "completed", updated_at: timestamp })
      .eq("id", session.queueEntryId);

    await supabase
      .from("bays")
      .update({ status: "available", updated_at: timestamp })
      .eq("id", session.bayId);

    await Promise.all([loadQueueEntries(), loadBays(), loadChargingSessions()]);

    const entry = queueEntries.find(
      (current) => current.id === session.queueEntryId,
    );

    void logActivity({
      action: "session.end",
      actorName: session.saName,
      targetType: "charging_session",
      targetId: sessionId,
      details: {
        bayId: session.bayId,
        plateNumber: entry?.plateNumber,
        actualDurationMinutes,
      },
    });

    return true;
  };

  const removeQueueEntry = async (entryId: string) => {
    const timestamp = new Date().toISOString();
    const { error } = await supabase
      .from("queue_entries")
      .update({ status: "cancelled", updated_at: timestamp })
      .eq("id", entryId);
    if (!error) {
      await loadQueueEntries();
      void logActivity({
        action: "queue.cancel",
        targetType: "queue_entry",
        targetId: entryId,
      });
    }
  };

  // Permanently deletes queue entries and their charging sessions — unlike
  // removeQueueEntry (which just marks status "cancelled"), this is a hard
  // delete used by the manager's Customer History "Reset" action. Sessions
  // must go first: charging_sessions.queue_entry_id has no ON DELETE CASCADE.
  const deleteQueueEntries = async (
    entryIds: string[],
  ): Promise<{ error?: string }> => {
    if (entryIds.length === 0) return {};

    const { error: sessionsError } = await supabase
      .from("charging_sessions")
      .delete()
      .in("queue_entry_id", entryIds);

    if (sessionsError) return { error: sessionsError.message };

    const { error: entriesError } = await supabase
      .from("queue_entries")
      .delete()
      .in("id", entryIds);

    if (entriesError) return { error: entriesError.message };

    await Promise.all([loadQueueEntries(), loadChargingSessions()]);

    void logActivity({
      action: "queue.bulk_delete",
      targetType: "queue_entry",
      details: { count: entryIds.length },
    });

    return {};
  };

  const approveOverride = async (entryId: string) => {
    const timestamp = new Date().toISOString();
    const { error } = await supabase
      .from("queue_entries")
      .update({
        gps_override_requested: false,
        gps_override_approved: true,
        updated_at: timestamp,
      })
      .eq("id", entryId);
    if (!error) {
      await loadQueueEntries();
      const entry = getQueueEntryById(entryId);
      void logActivity({
        action: "queue.override_approve",
        targetType: "queue_entry",
        targetId: entryId,
        details: { plateNumber: entry?.plateNumber },
      });
    }
  };

  const rejectOverride = async (entryId: string) => {
    const timestamp = new Date().toISOString();
    const { error } = await supabase
      .from("queue_entries")
      .update({
        gps_override_requested: false,
        gps_override_approved: false,
        status: "cancelled",
        updated_at: timestamp,
      })
      .eq("id", entryId);
    if (!error) {
      await loadQueueEntries();
      const entry = getQueueEntryById(entryId);
      void logActivity({
        action: "queue.override_reject",
        targetType: "queue_entry",
        targetId: entryId,
        details: { plateNumber: entry?.plateNumber },
      });
    }
  };

  const addBay = async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Bay name is required.");

    const slug = trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const id = `bay-${slug || "unnamed"}-${Date.now().toString(36)}`;

    const { error } = await supabase.from("bays").insert([
      {
        id,
        name: trimmedName,
        status: "available",
        enabled: true,
      },
    ]);

    if (error) throw new Error(error.message || "Failed to add bay.");
    await loadBays();
    void logActivity({
      action: "bay.create",
      targetType: "bay",
      targetId: id,
      details: { name: trimmedName },
    });
  };

  const renameBay = async (bayId: string, name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Bay name is required.");

    const { error } = await supabase
      .from("bays")
      .update({ name: trimmedName, updated_at: new Date().toISOString() })
      .eq("id", bayId);

    if (error) throw new Error(error.message || "Failed to rename bay.");
    await loadBays();
    void logActivity({
      action: "bay.rename",
      targetType: "bay",
      targetId: bayId,
      details: { name: trimmedName },
    });
  };

  const setBayEnabled = async (
    bayId: string,
    enabled: boolean,
    reason?: string,
  ) => {
    const { error } = await supabase
      .from("bays")
      .update({
        enabled,
        disabled_reason: enabled ? null : reason || "Unspecified",
        updated_at: new Date().toISOString(),
      })
      .eq("id", bayId);

    if (error) throw new Error(error.message || "Failed to update bay.");
    await loadBays();
    void logActivity({
      action: enabled ? "bay.enable" : "bay.disable",
      targetType: "bay",
      targetId: bayId,
      details: enabled ? undefined : { reason: reason || "Unspecified" },
    });
  };

  const setRainMode = async (
    enabled: boolean,
    actor: { actorRole: "sa" | "manager"; actorName?: string },
  ) => {
    const previous = rainMode;
    setRainModeState(enabled);

    // showroom_settings' own UPDATE policy is manager/admin-only (it also
    // guards manager-only fields like grace_minutes/charging_minutes), so
    // this goes through a SECURITY DEFINER RPC scoped to just rain_mode that
    // additionally allows the "sa" role.
    const { error } = await supabase.rpc("set_rain_mode", {
      p_enabled: enabled,
    });

    if (error) {
      setRainModeState(previous);
      throw new Error(error.message || "Failed to update rain mode.");
    }

    // Attributed explicitly from which panel (SA vs manager) triggered the
    // toggle, rather than inferred from the shared Supabase Auth session —
    // that session is a single global client persisted across tabs, so if
    // an SA and a manager are both signed in on the same browser, whichever
    // signed in most recently silently becomes "the current user" for every
    // tab, misattributing actions.
    void logActivity({
      action: enabled ? "showroom_settings.rain_mode_on" : "showroom_settings.rain_mode_off",
      actorRole: actor.actorRole,
      actorName: actor.actorName,
      targetType: "showroom_settings",
      targetId: "main",
      details: { enabled },
    });
  };

  const deleteBay = async (bayId: string) => {
    const { error } = await supabase.from("bays").delete().eq("id", bayId);

    if (error) {
      // Postgres FK violation: this bay has queue/session history referencing it.
      if (error.code === "23503") {
        throw new Error(
          "This bay has queue or charging history and can't be deleted. Disable it instead.",
        );
      }
      throw new Error(error.message || "Failed to delete bay.");
    }

    await loadBays();
    void logActivity({
      action: "bay.delete",
      targetType: "bay",
      targetId: bayId,
    });
  };

  const value: QueueContextValue = {
    bays,
    queueEntries,
    chargingSessions,
    saUsers: INITIAL_SA_USERS,
    waitingEntries,
    activeSessions,
    pendingOverrideEntries,
    defaultChargingMinutes: chargingMinutes,
    showroomName,
    rainMode,
    setRainMode,
    addQueueEntry,
    addStaffQueueEntry,
    getQueueEntryById,
    findLatestEntryByPlate,
    getQueuePosition,
    getEtaForEntry,
    getEtaForPosition,
    startCharging,
    endCharging,
    removeQueueEntry,
    deleteQueueEntries,
    approveOverride,
    rejectOverride,
    addBay,
    renameBay,
    deleteBay,
    setBayEnabled,
  };

  return (
    <QueueContext.Provider value={value}>{children}</QueueContext.Provider>
  );
}

export function useQueue() {
  const context = useContext(QueueContext);

  if (!context) {
    throw new Error("useQueue must be used inside QueueProvider");
  }

  return context;
}
