import {
    PropsWithChildren,
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { getRemainingSeconds } from "@/lib/eta";
import { supabase } from "@/lib/supabase";
import {
    ChargingBay,
    ChargingSession,
    NewQueueEntryInput,
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
  addQueueEntry: (input: NewQueueEntryInput) => Promise<QueueEntry>;
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
  skipQueueEntry: (entryId: string) => Promise<void>;
  removeQueueEntry: (entryId: string) => Promise<void>;
  approveOverride: (entryId: string) => Promise<void>;
  rejectOverride: (entryId: string) => Promise<void>;
}

const QueueContext = createContext<QueueContextValue | null>(null);

const GRACE_MINUTES = 5;
const CHARGING_MINUTES = 60;

const INITIAL_SA_USERS: SAUser[] = [];

// Columns the anon (customer) role is granted; phone_number is deliberately
// excluded at the database column-privilege level, so this list must match.
const ANON_QUEUE_COLUMNS =
  "id, name, plate_number, battery_percentage, joined_at, status, gps_validated, gps_override_requested, gps_override_approved, bay_id, created_at, updated_at";

function mapBay(row: any): ChargingBay {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
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
    bayId: row.bay_id ?? undefined,
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

  const isStaffRef = useRef(isStaff);
  isStaffRef.current = isStaff;

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

    const baysChannel = supabase
      .channel("public:bays")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bays" },
        () => loadBays(),
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
        },
      ])
      .select(ANON_QUEUE_COLUMNS)
      .single();

    if (error || !data) {
      throw new Error(error?.message || "Failed to join queue.");
    }

    const entry = mapQueueEntry(data);
    setQueueEntries((prev) => [...prev, entry]);
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
    if (position < 1 || bays.length === 0) {
      return 0;
    }

    const activeSessionByBay = new Map(
      activeSessions.map((session) => [session.bayId, session]),
    );
    const slotSeconds = (GRACE_MINUTES + CHARGING_MINUTES) * 60;

    const freeTimes = bays.map((bay) => {
      const session = activeSessionByBay.get(bay.id);
      if (!session?.startedAt) return 0;
      return getRemainingSeconds(session.startedAt, session.plannedDurationMinutes);
    });

    for (let i = 0; i < position - 1; i++) {
      let minIndex = 0;
      for (let j = 1; j < freeTimes.length; j++) {
        if (freeTimes[j] < freeTimes[minIndex]) minIndex = j;
      }
      freeTimes[minIndex] += slotSeconds;
    }

    return Math.min(...freeTimes);
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

    if (!entry || !bay || bay.status !== "available") {
      return false;
    }

    if (
      entry.status !== "waiting" ||
      (!entry.gpsValidated && !entry.gpsOverrideApproved)
    ) {
      return false;
    }

    const timestamp = new Date().toISOString();

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
          grace_minutes: GRACE_MINUTES,
          charging_minutes: CHARGING_MINUTES,
          planned_duration_minutes: GRACE_MINUTES + CHARGING_MINUTES,
          status: "active",
          started_at: timestamp,
        },
      ]);

    if (sessionError) return false;

    await Promise.all([loadQueueEntries(), loadBays(), loadChargingSessions()]);

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

    return true;
  };

  const skipQueueEntry = async (entryId: string) => {
    const timestamp = new Date().toISOString();
    const { error } = await supabase
      .from("queue_entries")
      .update({ status: "skipped", updated_at: timestamp })
      .eq("id", entryId);
    if (!error) await loadQueueEntries();
  };

  const removeQueueEntry = async (entryId: string) => {
    const timestamp = new Date().toISOString();
    const { error } = await supabase
      .from("queue_entries")
      .update({ status: "cancelled", updated_at: timestamp })
      .eq("id", entryId);
    if (!error) await loadQueueEntries();
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
    if (!error) await loadQueueEntries();
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
    if (!error) await loadQueueEntries();
  };

  const value: QueueContextValue = {
    bays,
    queueEntries,
    chargingSessions,
    saUsers: INITIAL_SA_USERS,
    waitingEntries,
    activeSessions,
    pendingOverrideEntries,
    addQueueEntry,
    getQueueEntryById,
    findLatestEntryByPlate,
    getQueuePosition,
    getEtaForEntry,
    getEtaForPosition,
    startCharging,
    endCharging,
    skipQueueEntry,
    removeQueueEntry,
    approveOverride,
    rejectOverride,
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
