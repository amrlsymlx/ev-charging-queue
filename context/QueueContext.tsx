import {
    PropsWithChildren,
    createContext,
    useContext,
    useMemo,
    useState,
} from "react";

import { calculateEtaMinutes } from "@/lib/eta";
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
  addQueueEntry: (input: NewQueueEntryInput) => QueueEntry;
  getQueueEntryById: (entryId: string) => QueueEntry | undefined;
  findLatestEntryByPlate: (plateNumber: string) => QueueEntry | undefined;
  getQueuePosition: (entryId: string) => number | null;
  getEtaForEntry: (entryId: string) => number;
  startCharging: (
    entryId: string,
    bayId: string,
    saName: string,
    duration?: number,
  ) => boolean;
  endCharging: (sessionId: string) => boolean;
  skipQueueEntry: (entryId: string) => void;
  removeQueueEntry: (entryId: string) => void;
  approveOverride: (entryId: string) => void;
  rejectOverride: (entryId: string) => void;
  addChargingSessionRecord: (data: {
    queueEntryId?: string;
    bayId: string;
    saName: string;
    plannedDurationMinutes?: number;
    actualDurationMinutes?: number;
    startedAt?: string;
    endedAt?: string;
    status?: "active" | "completed" | "cancelled";
  }) => ChargingSession;
}

const QueueContext = createContext<QueueContextValue | null>(null);

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

const INITIAL_BAYS: ChargingBay[] = [
  {
    id: "bay-1",
    name: "Bay 1",
    status: "available",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: "bay-2",
    name: "Bay 2",
    status: "available",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

const INITIAL_SA_USERS: SAUser[] = [
  {
    id: "sa-1",
    name: "Aina",
    email: "aina.sa@showroom.local",
    role: "sa",
    createdAt: nowIso(),
  },
  {
    id: "sa-2",
    name: "Farid",
    email: "farid.sa@showroom.local",
    role: "admin",
    createdAt: nowIso(),
  },
];

export function QueueProvider({ children }: PropsWithChildren) {
  const [bays, setBays] = useState<ChargingBay[]>(INITIAL_BAYS);
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [chargingSessions, setChargingSessions] = useState<ChargingSession[]>(
    [],
  );

  const waitingEntries = useMemo(
    () =>
      queueEntries
        .filter((entry) => entry.status === "waiting")
        .sort((a, b) => +new Date(a.joinedAt) - +new Date(b.joinedAt)),
    [queueEntries],
  );

  const activeSessions = useMemo(
    () => chargingSessions.filter((session) => session.status === "active"),
    [chargingSessions],
  );

  const pendingOverrideEntries = useMemo(
    () =>
      waitingEntries.filter(
        (entry) => entry.gpsOverrideRequested && !entry.gpsOverrideApproved,
      ),
    [waitingEntries],
  );

  const addQueueEntry = (input: NewQueueEntryInput) => {
    const timestamp = nowIso();

    const entry: QueueEntry = {
      id: randomId("qe"),
      name: input.name,
      phoneNumber: input.phoneNumber,
      plateNumber: input.plateNumber.trim().toUpperCase(),
      batteryPercentage: input.batteryPercentage,
      joinedAt: timestamp,
      status: "waiting",
      gpsValidated: input.gpsValidated,
      gpsOverrideRequested: input.gpsOverrideRequested,
      gpsOverrideApproved: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    setQueueEntries((prev) => [...prev, entry]);

    // Persist to Supabase in background (best-effort). Keep local entry for immediate UX.
    (async () => {
      try {
        const { data, error } = await supabase.from("queue_entries").insert([
          {
            name: entry.name,
            phone_number: entry.phoneNumber,
            plate_number: entry.plateNumber,
            battery_percentage: entry.batteryPercentage,
            joined_at: entry.joinedAt,
            status: entry.status,
            gps_validated: entry.gpsValidated,
            gps_override_requested: entry.gpsOverrideRequested,
            gps_override_approved: entry.gpsOverrideApproved,
          },
        ]);

        if (!error && data && data[0] && data[0].id) {
          const remoteId = data[0].id as string;
          setQueueEntries((prev) =>
            prev.map((e) => (e.id === entry.id ? { ...e, id: remoteId } : e)),
          );
        }
      } catch (e) {
        // network or other error: keep local state
      }
    })();

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
    const candidate = waitingEntries.find((entry) => entry.id === entryId);

    if (
      !candidate ||
      (!candidate.gpsValidated && !candidate.gpsOverrideApproved)
    ) {
      return null;
    }

    const eligibleWaitingEntries = waitingEntries.filter(
      (entry) => entry.gpsValidated || entry.gpsOverrideApproved,
    );

    const index = eligibleWaitingEntries.findIndex(
      (entry) => entry.id === entryId,
    );

    return index >= 0 ? index + 1 : null;
  };

  const getEtaForEntry = (entryId: string) => {
    const position = getQueuePosition(entryId);
    if (!position) {
      return 0;
    }
    return calculateEtaMinutes(position, 2, 65);
  };

  const startCharging = (
    entryId: string,
    bayId: string,
    saName: string,
    duration = 65,
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

    const timestamp = nowIso();

    setQueueEntries((prev) =>
      prev.map((current) =>
        current.id === entryId
          ? {
              ...current,
              status: "charging",
              updatedAt: timestamp,
            }
          : current,
      ),
    );

    setBays((prev) =>
      prev.map((current) =>
        current.id === bayId
          ? {
              ...current,
              status: "occupied",
              updatedAt: timestamp,
            }
          : current,
      ),
    );

    setChargingSessions((prev) => [
      ...prev,
      {
        id: randomId("cs"),
        queueEntryId: entryId,
        bayId,
        saName,
        plannedDurationMinutes: duration,
        status: "active",
        startedAt: timestamp,
        createdAt: timestamp,
      },
    ]);

    return true;
  };

  const endCharging = (sessionId: string) => {
    const session = chargingSessions.find(
      (current) => current.id === sessionId,
    );

    if (!session || session.status !== "active" || !session.startedAt) {
      return false;
    }

    const timestamp = nowIso();
    const actualDurationMinutes = Math.max(
      Math.floor((+new Date(timestamp) - +new Date(session.startedAt)) / 60000),
      0,
    );

    setChargingSessions((prev) =>
      prev.map((current) =>
        current.id === sessionId
          ? {
              ...current,
              status: "completed",
              actualDurationMinutes,
              endedAt: timestamp,
            }
          : current,
      ),
    );

    setQueueEntries((prev) =>
      prev.map((current) =>
        current.id === session.queueEntryId
          ? {
              ...current,
              status: "completed",
              updatedAt: timestamp,
            }
          : current,
      ),
    );

    setBays((prev) =>
      prev.map((current) =>
        current.id === session.bayId
          ? {
              ...current,
              status: "available",
              updatedAt: timestamp,
            }
          : current,
      ),
    );

    return true;
  };

  const skipQueueEntry = (entryId: string) => {
    const timestamp = nowIso();
    setQueueEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              status: "skipped",
              updatedAt: timestamp,
            }
          : entry,
      ),
    );
  };

  const removeQueueEntry = (entryId: string) => {
    const timestamp = nowIso();
    setQueueEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              status: "cancelled",
              updatedAt: timestamp,
            }
          : entry,
      ),
    );
  };

  const approveOverride = (entryId: string) => {
    const timestamp = nowIso();
    setQueueEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              gpsOverrideRequested: false,
              gpsOverrideApproved: true,
              updatedAt: timestamp,
            }
          : entry,
      ),
    );
  };

  const addChargingSessionRecord = (data: {
    queueEntryId?: string;
    bayId: string;
    saName: string;
    plannedDurationMinutes?: number;
    actualDurationMinutes?: number;
    startedAt?: string;
    endedAt?: string;
    status?: "active" | "completed" | "cancelled";
  }) => {
    const timestamp = nowIso();
    const session: ChargingSession = {
      id: randomId("cs"),
      queueEntryId: data.queueEntryId ?? "",
      bayId: data.bayId,
      saName: data.saName,
      plannedDurationMinutes: data.plannedDurationMinutes ?? 65,
      actualDurationMinutes: data.actualDurationMinutes,
      startedAt: data.startedAt,
      endedAt: data.endedAt,
      status: data.status ?? (data.endedAt ? "completed" : "active"),
      createdAt: timestamp,
    };

    setChargingSessions((prev) => [...prev, session]);

    // Persist charging session to Supabase in background.
    (async () => {
      try {
        const { data: inserted, error } = await supabase
          .from("charging_sessions")
          .insert([
            {
              queue_entry_id: data.queueEntryId || null,
              bay_id: data.bayId,
              sa_name: data.saName,
              planned_duration_minutes: session.plannedDurationMinutes,
              actual_duration_minutes: session.actualDurationMinutes,
              started_at: session.startedAt || null,
              ended_at: session.endedAt || null,
              status: session.status,
            },
          ]);

        if (!error && inserted && inserted[0] && inserted[0].id) {
          const remoteId = inserted[0].id as string;
          setChargingSessions((prev) =>
            prev.map((s) => (s.id === session.id ? { ...s, id: remoteId } : s)),
          );
        }
      } catch (e) {
        // swallow for now
      }
    })();

    // If a queueEntryId was provided and the session is completed, mark it completed
    if (data.queueEntryId && session.status === "completed") {
      setQueueEntries((prev) =>
        prev.map((entry) =>
          entry.id === data.queueEntryId
            ? { ...entry, status: "completed", updatedAt: timestamp }
            : entry,
        ),
      );
    }

    // If ended, free the bay
    if (data.endedAt) {
      setBays((prev) =>
        prev.map((b) =>
          b.id === data.bayId
            ? { ...b, status: "available", updatedAt: timestamp }
            : b,
        ),
      );
    } else {
      // otherwise occupy the bay
      setBays((prev) =>
        prev.map((b) =>
          b.id === data.bayId
            ? { ...b, status: "occupied", updatedAt: timestamp }
            : b,
        ),
      );
    }

    return session;
  };

  const rejectOverride = (entryId: string) => {
    const timestamp = nowIso();
    setQueueEntries((prev) =>
      prev.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              gpsOverrideRequested: false,
              gpsOverrideApproved: false,
              status: "cancelled",
              updatedAt: timestamp,
            }
          : entry,
      ),
    );
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
    startCharging,
    endCharging,
    skipQueueEntry,
    removeQueueEntry,
    approveOverride,
    rejectOverride,
    addChargingSessionRecord,
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
