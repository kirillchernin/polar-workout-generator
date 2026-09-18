import { Workout, WorkoutItem, WorkoutPhase, RepeatBlock } from '../types/workout';
import { DefaultIntensityMapping } from '../types/zones';
import { validateWorkoutSchema } from '../utils/validation';

// Helper to ensure each phase and repeat block has a unique key for UI state
export function assignIds(workout: Workout): Workout {
  let counter = 0;
  const ensurePhase = (phase: WorkoutPhase): WorkoutPhase => {
    const updated = {
      ...phase,
      id: phase.id || `p_${Date.now()}_${++counter}`,
    };
    if (updated.intensityType === 'speed') {
      const max = updated.zoneMax ?? updated.zoneMin ?? 4;
      updated.zoneMin = 1;
      updated.zoneMax = Math.min(5, Math.max(1, max));
    } else if (
      updated.intensityType === 'heart_rate' &&
      (updated.zoneMin !== undefined || updated.zoneMax !== undefined)
    ) {
      const max = updated.zoneMax ?? updated.zoneMin ?? 2;
      updated.zoneMin = 1;
      updated.zoneMax = Math.min(5, Math.max(1, max));
    }
    return updated;
  };

  const phasesWithIds: WorkoutItem[] = (workout.phases || []).map((item) => {
    if (item.type === 'repeat') {
      const repeat = item as RepeatBlock;
      return {
        ...repeat,
        id: repeat.id || `r_${Date.now()}_${++counter}`,
        phases: (repeat.phases || []).map(ensurePhase),
      };
    }
    return ensurePhase(item as WorkoutPhase);
  });

  return {
    ...workout,
    startTime: '08:00',
    phases: phasesWithIds,
  };
}

async function handleResponse(response: Response): Promise<Workout> {
  if (!response.ok) {
    let errorMsg = `Server error (${response.status})`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMsg = errorData.error;
        if (Array.isArray(errorData.validationDetails) && errorData.validationDetails.length > 0) {
          errorMsg += `\nDetails: ${errorData.validationDetails.join('; ')}`;
        }
      } else if (errorData.message) {
        errorMsg = errorData.message;
      }
    } catch {
      const text = await response.text().catch(() => '');
      if (text) {
        errorMsg = text;
      }
    }
    throw new Error(errorMsg);
  }

  let data: any;
  try {
    data = await response.json();
  } catch (parseError: any) {
    throw new Error(
      `AI returned an invalid workout structure. Please try again.\nDetails: Failed to parse JSON response (${parseError.message})`
    );
  }

  // Schema validation before putting into application state
  const schemaCheck = validateWorkoutSchema(data);
  if (!schemaCheck.isValid) {
    throw new Error(
      `AI returned an invalid workout structure. Please try again.\nDetails: ${schemaCheck.details.join('; ')}`
    );
  }

  return assignIds(data as Workout);
}

export async function generateWorkoutFromText(
  text: string,
  workoutName?: string,
  date?: string,
  defaultIntensity?: DefaultIntensityMapping,
): Promise<Workout> {
  const response = await fetch('/api/generate-workout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      workoutName,
      date,
      defaultIntensity,
    }),
  });

  return handleResponse(response);
}
