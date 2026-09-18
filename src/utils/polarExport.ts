import { Workout, WorkoutItem, WorkoutPhase } from '../types/workout';
import { DefaultIntensityMapping } from '../types/zones';
import { loadZoneSettings, resolveQualitativeIntensity } from './zoneStorage';

export interface PolarExport {
  schemaVersion: number;
  source: string;
  workout: Workout;
}

/**
 * Strips any leading sequential numbering pattern like "1/8 " or "2/15 "
 * so repeated exports or re-numbering never nest.
 */
export function cleanPhaseName(name: string): string {
  return (name || '').replace(/^\d+\/\d+\s+/, '').trim();
}

/**
 * Flattens all repeat blocks into a sequential flat list of WorkoutPhase items.
 * Repeats are expanded by their repetition count.
 * Does not mutate the input array.
 */
export function flattenWorkoutPhases(items: WorkoutItem[]): WorkoutPhase[] {
  const result: WorkoutPhase[] = [];
  for (const item of items) {
    if (item.type === 'repeat') {
      const reps = Math.max(1, item.repetitions || 1);
      for (let r = 0; r < reps; r++) {
        for (const child of item.phases || []) {
          result.push({
            ...child,
            id: child.id ? `${child.id}_rep${r + 1}` : undefined,
          });
        }
      }
    } else {
      result.push({ ...item });
    }
  }
  return result;
}

/**
 * Applies global sequential numbering to flat phases.
 * Format: "current/total Phase name" (e.g. "1/8 Warm up", "2/8 Interval").
 * Does not mutate original objects.
 */
export function numberPolarPhases(flatPhases: WorkoutPhase[]): WorkoutPhase[] {
  const total = flatPhases.length;
  return flatPhases.map((phase, index) => {
    const baseName = cleanPhaseName(phase.name) || 'Phase';
    return {
      ...phase,
      name: `${index + 1}/${total} ${baseName}`,
    };
  });
}

/**
 * Normalizes a single phase for Polar Flow Chrome Extension export:
 * - Converts qualitative intensities ("easy", "recovery", "tempo", "threshold", "marathon_pace")
 *   to either "heart_rate" or "speed" with zoneMin / zoneMax.
 * - Retains explicit "pace" (with paceMin / paceMax).
 * - Retains explicit "heart_rate" and "speed" with zoneMin / zoneMax.
 * - Strips any power fields.
 */
function normalizePhaseForPolar(
  phase: WorkoutPhase,
  defaultMapping: DefaultIntensityMapping
): WorkoutPhase {
  // 1. If explicit numeric pace
  if (phase.intensityType === 'pace') {
    return {
      type: 'phase',
      name: phase.name,
      durationType: phase.durationType,
      duration: phase.duration,
      intensityType: 'pace',
      ...(phase.paceMin ? { paceMin: phase.paceMin } : {}),
      ...(phase.paceMax ? { paceMax: phase.paceMax } : {}),
    };
  }

  // 2. If explicit speed / pace zone
  if (phase.intensityType === 'speed') {
    const max = phase.zoneMax ?? phase.zoneMin ?? 4;
    return {
      type: 'phase',
      name: phase.name,
      durationType: phase.durationType,
      duration: phase.duration,
      intensityType: 'speed',
      zoneMin: 1,
      zoneMax: Math.min(5, Math.max(1, max)),
    };
  }

  // 3. If heart_rate
  if (phase.intensityType === 'heart_rate') {
    const isZoneBased = phase.zoneMin !== undefined || phase.zoneMax !== undefined;
    const max = phase.zoneMax ?? phase.zoneMin ?? 2;
    return {
      type: 'phase',
      name: phase.name,
      durationType: phase.durationType,
      duration: phase.duration,
      intensityType: 'heart_rate',
      ...(isZoneBased
        ? {
            zoneMin: 1,
            zoneMax: Math.min(5, Math.max(1, max)),
          }
        : {}),
      ...(phase.hrMin !== undefined ? { hrMin: phase.hrMin } : {}),
      ...(phase.hrMax !== undefined ? { hrMax: phase.hrMax } : {}),
    };
  }

  // 4. If none
  if (phase.intensityType === 'none') {
    return {
      type: 'phase',
      name: phase.name,
      durationType: phase.durationType,
      duration: phase.duration,
      intensityType: 'none',
    };
  }

  // 5. Qualitative intensity: map through Default intensity
  const mapped = resolveQualitativeIntensity(phase.intensityType, defaultMapping);
  if (mapped) {
    return {
      type: 'phase',
      name: phase.name,
      durationType: phase.durationType,
      duration: phase.duration,
      intensityType: mapped.intensityType,
      zoneMin: 1,
      zoneMax: mapped.zoneMax,
    };
  }

  // Fallback if unrecognized qualitative: default to HR Z1-Z2
  return {
    type: 'phase',
    name: phase.name,
    durationType: phase.durationType,
    duration: phase.duration,
    intensityType: 'heart_rate',
    zoneMin: 1,
    zoneMax: 2,
  };
}

/**
 * Creates the canonical, versioned export object for the Polar Flow Chrome Extension.
 * - Flattens repeats into sequential phases.
 * - Normalizes all phases to Polar Flow requirements.
 * - Numbers all phases sequentially (1/N, 2/N, ... N/N).
 * - Ensures schemaVersion is fixed so the extension can depend upon it.
 */
export function createPolarExport(
  workout: Workout,
  customMapping?: DefaultIntensityMapping
): PolarExport {
  const mapping = customMapping || loadZoneSettings().defaultIntensity;

  // 1. Flatten all repeat blocks into sequential flat phases
  const flatPhases = flattenWorkoutPhases(workout.phases || []);

  // 2. Normalize intensity and targets for Polar Flow
  const normalizedPhases = flatPhases.map((p) => normalizePhaseForPolar(p, mapping));

  // 3. Apply global phase numbering (1/N, 2/N, ... N/N) to all phases sent to Polar
  const numberedPhases = numberPolarPhases(normalizedPhases);

  const cleanWorkout: Workout = {
    name: workout.name ? workout.name.trim() : 'Running Workout',
    sport: workout.sport || 'running',
    date: workout.date || new Date().toISOString().split('T')[0],
    startTime: '08:00', // Always 08:00, automatic and invisible to the user
    phases: numberedPhases,
  };

  return {
    schemaVersion: 1,
    source: 'polar-workout-generator',
    workout: cleanWorkout,
  };
}

/**
 * Copies the validated Polar export payload to the clipboard.
 */
export async function copyPolarExport(
  workout: Workout,
  customMapping?: DefaultIntensityMapping
): Promise<void> {
  const exportData = createPolarExport(workout, customMapping);
  const jsonString = JSON.stringify(exportData, null, 2);

  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(jsonString);
  } else {
    // Robust fallback for iframes or restricted clipboard permissions
    const textArea = document.createElement('textarea');
    textArea.value = jsonString;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(textArea);
    }
  }
}

/**
 * Downloads the exact same PolarExport object as a formatted .json file.
 * Serves as a debugging and fallback mechanism.
 */
export function downloadPolarExport(
  workout: Workout,
  customMapping?: DefaultIntensityMapping
): void {
  const exportData = createPolarExport(workout, customMapping);
  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  const safeName = (workout.name || 'polar-phased-target')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'workout';
  const fileName = `${safeName}-${workout.date || 'target'}.json`;

  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
