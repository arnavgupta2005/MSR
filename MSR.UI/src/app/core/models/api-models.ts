// ============================================================
// Typed models mirroring MSR.API DTOs.
// Property names match the backend JSON (camelCase) exactly.
// ============================================================

// ---- Development / Sprint Performance ----

export interface SprintPerformanceKpi {
  capacity: number | null;
  velocity: number | null;
  assignedPoints: number | null;
  deliveredPoints: number | null;
  rollovers: number | null;
  rolloverPoints: number | null;
  plannedItems: number | null;
  deliveredItems: number | null;
  completionPercentage: number | null;
}

export interface VelocityTrend {
  sprintId: number;
  sprintNumber: number;
  actualVelocity: number;
  trailingVelocity: number;
}

export interface RolloverTrend {
  sprintId: number;
  sprintNumber: number;
  rollover: number;
  rolloverPoints: number;
}

export interface TeamRolloverTrend {
  teamId: number;
  teamName: string;
  sprintId: number;
  sprintNumber: number;
  rollover: number;
  rolloverPoints: number;
}

export interface TeamVelocityTrend {
  teamId: number;
  teamName: string;
  sprintId: number;
  sprintNumber: number;
  actualVelocity: number;
  capacity: number;
  trailingVelocity: number;
}

export interface TeamVelocityHeadcount {
  teamId: number;
  teamName: string;
  sprintId: number;
  sprintNumber: number;
  actualVelocity: number;
  headcount: number;
}

export interface TeamCompletionTrend {
  teamId: number;
  teamName: string;
  sprintId: number;
  sprintNumber: number;
  assignedPoints: number;
  deliveredPoints: number;
  completionPercentage: number;
}

export interface ResourceVelocityTrend {
  employeeId: number;
  employeeName: string;
  teamId: number;
  teamName: string;
  sprintId: number;
  sprintNumber: number;
  actualVelocity: number;
  assignedPoints: number;
  capacity: number;
  trailingVelocity: number;
}

export interface ResourceCompletion {
  employeeId: number;
  employeeName: string;
  teamId: number;
  teamName: string;
  sprintId: number;
  sprintNumber: number;
  assignedPoints: number;
  deliveredPoints: number;
  completionPercentage: number;
}

// ---- QA ----

export interface QaKpi {
  totalStories: number;
  capacity: number;
  totalStoryPoints: number;
  rollovers: number;
  rolloverPoints: number;
  observations: number;
}

export interface QaRolloverTrend {
  sprintId: number;
  sprintNumber: number;
  rolloverPoints: number;
}

export interface QaStoryPointsTested {
  sprintId: number;
  sprintNumber: number;
  employeeId: number;
  employeeName: string;
  deliveredPoints: number;
}

export interface QaDeliveryTrend {
  sprintId: number;
  sprintNumber: number;
  day: number;
  delivery: number;
}

// ---- Feature Release ----

export interface FeatureRelease {
  featureDescription: string;
  plannedSprint: number | null;
  releasedSprint: number | null;
  delayReason: string | null;
}
