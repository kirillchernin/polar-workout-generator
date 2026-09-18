export type DurationType = 'time' | 'distance';
export type IntensityType =
  | 'none'
  | 'easy'
  | 'recovery'
  | 'threshold'
  | 'tempo'
  | 'marathon_pace'
  | 'pace'
  | 'heart_rate'
  | 'speed';

export interface WorkoutPhase {
  id?: string;
  type: 'phase';
  name: string;
  durationType: DurationType;
  duration: number; // in seconds (for 'time') or meters (for 'distance')
  intensityType: IntensityType;
  zoneMin?: number; // Polar zone min (1-5)
  zoneMax?: number; // Polar zone max (1-5)
  paceMin?: string; // 'M:SS', e.g. '4:50'
  paceMax?: string; // 'M:SS', e.g. '5:00'
  hrMin?: number; // bpm, e.g. 140
  hrMax?: number; // bpm, e.g. 155
  ambiguityWarning?: string;
}

export interface RepeatBlock {
  id?: string;
  type: 'repeat';
  repetitions: number;
  phases: WorkoutPhase[];
  ambiguityWarning?: string;
}

export type WorkoutItem = WorkoutPhase | RepeatBlock;

export interface Workout {
  name: string;
  sport: 'running';
  date: string; // YYYY-MM-DD
  startTime?: string; // Always "08:00"
  phases: WorkoutItem[];
  warnings?: string[];
}

export interface ValidationError {
  id: string; // unique ID or item identifier
  path: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
}
