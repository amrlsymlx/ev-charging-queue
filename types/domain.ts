export type QueueEntryStatus =
  | "waiting"
  | "charging"
  | "completed"
  | "cancelled"
  | "skipped";

export type ChargingBayStatus = "available" | "occupied";

export type ChargingSessionStatus = "active" | "completed" | "cancelled";

export type UserRole = "sa" | "admin";

export interface ChargingBay {
  id: string;
  name: string;
  status: ChargingBayStatus;
  createdAt: string;
  updatedAt: string;
}

export interface QueueEntry {
  id: string;
  name: string;
  phoneNumber: string;
  plateNumber: string;
  batteryPercentage: number;
  joinedAt: string;
  status: QueueEntryStatus;
  gpsValidated: boolean;
  gpsOverrideRequested: boolean;
  gpsOverrideApproved: boolean;
  bayId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChargingSession {
  id: string;
  queueEntryId: string;
  bayId: string;
  saName: string;
  graceMinutes: number;
  chargingMinutes: number;
  plannedDurationMinutes: number;
  actualDurationMinutes?: number;
  startedAt?: string;
  endedAt?: string;
  status: ChargingSessionStatus;
  createdAt: string;
}

export interface SAUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface NewQueueEntryInput {
  name: string;
  phoneNumber: string;
  plateNumber: string;
  batteryPercentage: number;
  gpsValidated: boolean;
  gpsOverrideRequested: boolean;
}
