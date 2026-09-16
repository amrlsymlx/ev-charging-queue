export type QueueEntryStatus =
  | "waiting"
  | "charging"
  | "completed"
  | "cancelled"
  | "skipped";

export type ChargingBayStatus = "available" | "occupied";

export type ChargingBayOrientation = "left" | "right";

export type ChargingSessionStatus = "active" | "completed" | "cancelled";

export type UserRole = "sa" | "admin";

export type StaffPlateCategory = "INTERNAL" | "PRIORITY" | "DELIVERY" | "SERVICE";

export interface ChargingBay {
  id: string;
  name: string;
  status: ChargingBayStatus;
  enabled: boolean;
  disabledReason?: string;
  orientation: ChargingBayOrientation;
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
  agreedToTerms: boolean;
  bayId?: string;
  overrideChargingMinutes?: number;
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
  agreedToTerms: boolean;
  // The server independently recomputes gps_validated from these against
  // the showroom's coordinates — see enforce_gps_validation() — so
  // gpsValidated above only drives immediate client-side UI feedback.
  latitude?: number;
  longitude?: number;
}

export interface NewStaffQueueEntryInput {
  category: StaffPlateCategory;
  note: string;
  batteryPercentage: number;
  overrideChargingMinutes?: number;
}
