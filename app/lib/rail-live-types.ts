export type RailLegLookup = {
  id: string;
  train: string;
  from: string;
  to: string;
  date: string;
  plannedDeparture: string;
  plannedArrival?: string;
  plannedDeparturePlatform?: string;
  plannedArrivalPlatform?: string;
  fromStationId?: string;
  toStationId?: string;
  timeZone?: string;
  connectionBufferMinutes?: number | null;
};

export type RailAlert = {
  title: string;
  description?: string;
  severity?: string;
  effect?: string;
  url?: string;
};

export type RailLiveState = "on_time" | "delayed" | "cancelled" | "scheduled" | "unknown";

export type RailStatusResult = {
  provider: string;
  checkedAt: string;
  state: RailLiveState;
  matched: boolean;
  confidence: number;
  realtime: boolean;
  train: string;
  destination?: string;
  departure: {
    planned: string;
    actual?: string;
    delayMinutes: number | null;
    plannedPlatform?: string;
    platform?: string;
    platformChanged: boolean;
  };
  arrival: {
    planned?: string;
    actual?: string;
    delayMinutes: number | null;
    plannedPlatform?: string;
    platform?: string;
    platformChanged: boolean;
  };
  cancelled: boolean;
  alerts: RailAlert[];
  recommendation?: string;
  sourceNote: string;
};

export type RailAlternative = {
  id: string;
  departure: string;
  arrival: string;
  durationMinutes: number;
  transfers: number;
  trains: string[];
  fromPlatform?: string;
  toPlatform?: string;
  realtime: boolean;
  cancelled: boolean;
  alerts: RailAlert[];
  bookingUrl: string;
};

export type RailAlternativesResult = {
  provider: string;
  checkedAt: string;
  alternatives: RailAlternative[];
  sourceNote: string;
};
