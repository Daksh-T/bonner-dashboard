import type { Status } from "../types";

export const STATUS_COLORS: Record<Status, string> = {
  Red:    "#e74c3c",
  Yellow: "#f39c12",
  Blue:   "#3498db",
  Green:  "#27ae60",
  Exempt: "#6b7280",
};

// Keep old export name for any stale imports
export const statusColors = STATUS_COLORS;

export const STATUS_ORDER: Status[] = ["Red", "Blue", "Yellow", "Green", "Exempt"];

export const STATUS_LABEL: Record<Status, string> = {
  Red:    "Needs attention",
  Yellow: "Getting close",
  Blue:   "Not started",
  Green:  "On track",
  Exempt: "Excused",
};

export const CHECKPOINTS = ["CP1", "CP2", "CP3", "CP4", "TODAY"] as const;

export const CHECKPOINT_LABEL: Record<string, string> = {
  CP1: "CP1", CP2: "CP2", CP3: "CP3", CP4: "CP4",
  TODAY: "Today's pace",
};
