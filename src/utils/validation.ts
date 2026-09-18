import { Workout, WorkoutItem, WorkoutPhase, RepeatBlock, ValidationResult, ValidationError, IntensityType } from '../types/workout';
import { isValidPace, paceToSeconds } from './formatters';

export const VALID_INTENSITIES: IntensityType[] = [
  'none',
  'easy',
  'recovery',
  'threshold',
  'tempo',
  'marathon_pace',
  'pace',
  'heart_rate',
  'speed',
];

export function validatePhase(phase: WorkoutPhase, pathPrefix: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const id = phase.id || pathPrefix;

  if (!phase.name || !phase.name.trim()) {
    errors.push({
      id,
      path: `${pathPrefix}.name`,
      message: 'Phase name cannot be empty',
    });
  }

  if (typeof phase.duration !== 'number' || isNaN(phase.duration) || phase.duration <= 0) {
    errors.push({
      id,
      path: `${pathPrefix}.duration`,
      message: phase.durationType === 'distance' 
        ? 'Distance must be greater than 0 meters' 
        : 'Duration must be greater than 0 seconds',
    });
  }

  if (!VALID_INTENSITIES.includes(phase.intensityType)) {
    errors.push({
      id,
      path: `${pathPrefix}.intensityType`,
      message: `Invalid intensity type: "${phase.intensityType}". Allowed: ${VALID_INTENSITIES.join(', ')}`,
    });
  }

  // Only pace, heart_rate, and speed require targets!
  // easy, recovery, threshold, tempo, and marathon_pace are valid without numeric targets.
  if (phase.intensityType === 'pace') {
    if (!phase.paceMin && !phase.paceMax) {
      errors.push({
        id,
        path: `${pathPrefix}.pace`,
        message: 'Pace intensity requires at least a target pace (e.g. 4:50)',
      });
    }

    if (phase.paceMin && !isValidPace(phase.paceMin)) {
      errors.push({
        id,
        path: `${pathPrefix}.paceMin`,
        message: `Invalid pace format: "${phase.paceMin}". Use M:SS (e.g. 4:50)`,
      });
    }

    if (phase.paceMax && !isValidPace(phase.paceMax)) {
      errors.push({
        id,
        path: `${pathPrefix}.paceMax`,
        message: `Invalid pace format: "${phase.paceMax}". Use M:SS (e.g. 5:00)`,
      });
    }

    if (phase.paceMin && phase.paceMax && isValidPace(phase.paceMin) && isValidPace(phase.paceMax)) {
      const secMin = paceToSeconds(phase.paceMin)!;
      const secMax = paceToSeconds(phase.paceMax)!;
      if (secMin > secMax) {
        errors.push({
          id,
          path: `${pathPrefix}.paceRange`,
          message: `Pace range inverted: ${phase.paceMin} is slower than ${phase.paceMax}. Range should be faster to slower (e.g. 4:50–5:00)`,
        });
      }
    }
  }

  if (phase.intensityType === 'speed') {
    if (phase.zoneMin === undefined && phase.zoneMax === undefined) {
      errors.push({
        id,
        path: `${pathPrefix}.speedZone`,
        message: 'Speed/Pace intensity requires a zone number (1–5)',
      });
    }
    if (phase.zoneMin !== undefined && (isNaN(phase.zoneMin) || phase.zoneMin < 1 || phase.zoneMin > 5)) {
      errors.push({
        id,
        path: `${pathPrefix}.zoneMin`,
        message: 'Pace zone min must be between 1 and 5',
      });
    }
    if (phase.zoneMax !== undefined && (isNaN(phase.zoneMax) || phase.zoneMax < 1 || phase.zoneMax > 5)) {
      errors.push({
        id,
        path: `${pathPrefix}.zoneMax`,
        message: 'Pace zone max must be between 1 and 5',
      });
    }
    if (phase.zoneMin !== undefined && phase.zoneMax !== undefined && phase.zoneMin > phase.zoneMax) {
      errors.push({
        id,
        path: `${pathPrefix}.zoneRange`,
        message: `Pace zone min (${phase.zoneMin}) cannot be higher than max (${phase.zoneMax})`,
      });
    }
  }

  if (phase.intensityType === 'heart_rate') {
    const hasZone = phase.zoneMin !== undefined || phase.zoneMax !== undefined;
    const hasBpm = phase.hrMin !== undefined || phase.hrMax !== undefined;

    if (!hasZone && !hasBpm) {
      errors.push({
        id,
        path: `${pathPrefix}.heart_rate`,
        message: 'Heart rate target requires a zone (1–5) or bpm value',
      });
    }

    if (hasZone) {
      if (phase.zoneMin !== undefined && (isNaN(phase.zoneMin) || phase.zoneMin < 1 || phase.zoneMin > 5)) {
        errors.push({
          id,
          path: `${pathPrefix}.zoneMin`,
          message: 'HR zone min must be between 1 and 5',
        });
      }
      if (phase.zoneMax !== undefined && (isNaN(phase.zoneMax) || phase.zoneMax < 1 || phase.zoneMax > 5)) {
        errors.push({
          id,
          path: `${pathPrefix}.zoneMax`,
          message: 'HR zone max must be between 1 and 5',
        });
      }
      if (phase.zoneMin !== undefined && phase.zoneMax !== undefined && phase.zoneMin > phase.zoneMax) {
        errors.push({
          id,
          path: `${pathPrefix}.zoneRange`,
          message: `HR zone min (${phase.zoneMin}) cannot be higher than max (${phase.zoneMax})`,
        });
      }
    }

    if (hasBpm) {
      if (phase.hrMin !== undefined && (isNaN(phase.hrMin) || phase.hrMin <= 30 || phase.hrMin > 250)) {
        errors.push({
          id,
          path: `${pathPrefix}.hrMin`,
          message: 'Heart rate min must be between 30 and 250 bpm',
        });
      }
      if (phase.hrMax !== undefined && (isNaN(phase.hrMax) || phase.hrMax <= 30 || phase.hrMax > 250)) {
        errors.push({
          id,
          path: `${pathPrefix}.hrMax`,
          message: 'Heart rate max must be between 30 and 250 bpm',
        });
      }
      if (phase.hrMin !== undefined && phase.hrMax !== undefined && phase.hrMin > phase.hrMax) {
        errors.push({
          id,
          path: `${pathPrefix}.hrRange`,
          message: `HR min (${phase.hrMin} bpm) cannot be higher than HR max (${phase.hrMax} bpm)`,
        });
      }
    }
  }

  return errors;
}

export function validateWorkout(workout: Workout): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  if (!workout.name || !workout.name.trim()) {
    errors.push({
      id: 'workout_name',
      path: 'name',
      message: 'Workout name is required',
    });
  }

  if (!workout.phases || workout.phases.length === 0) {
    errors.push({
      id: 'workout_phases',
      path: 'phases',
      message: 'Workout must have at least one phase',
    });
  } else {
    workout.phases.forEach((item: WorkoutItem, index: number) => {
      const pathPrefix = `phases[${index}]`;
      if (item.type === 'repeat') {
        const repeat = item as RepeatBlock;
        if (!repeat.repetitions || repeat.repetitions < 1) {
          errors.push({
            id: repeat.id || pathPrefix,
            path: `${pathPrefix}.repetitions`,
            message: 'Repeat repetitions must be at least 1',
          });
        }
        if (!repeat.phases || repeat.phases.length === 0) {
          errors.push({
            id: repeat.id || pathPrefix,
            path: `${pathPrefix}.phases`,
            message: 'Repeat block must contain at least one phase',
          });
        } else {
          repeat.phases.forEach((phase: WorkoutPhase, subIndex: number) => {
            const subErrors = validatePhase(phase, `${pathPrefix}.phases[${subIndex}]`);
            errors.push(...subErrors);
          });
        }
      } else {
        const phaseErrors = validatePhase(item as WorkoutPhase, pathPrefix);
        errors.push(...phaseErrors);
      }
    });
  }

  // Collect warnings
  if (workout.warnings && workout.warnings.length > 0) {
    warnings.push(...workout.warnings);
  }
  workout.phases?.forEach((item) => {
    if (item.ambiguityWarning) {
      warnings.push(item.ambiguityWarning);
    }
    if (item.type === 'repeat') {
      item.phases?.forEach((p) => {
        if (p.ambiguityWarning) {
          warnings.push(p.ambiguityWarning);
        }
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateWorkoutSchema(data: any): { isValid: boolean; details: string[] } {
  const details: string[] = [];

  if (!data || typeof data !== 'object') {
    return { isValid: false, details: ['Response is not a valid JSON object'] };
  }

  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    details.push('Workout name is missing or empty');
  }

  if (!Array.isArray(data.phases) || data.phases.length === 0) {
    details.push('Workout phases must be a non-empty list');
    return { isValid: false, details };
  }

  data.phases.forEach((item: any, idx: number) => {
    const pPrefix = `Phase #${idx + 1}`;
    if (!item || typeof item !== 'object') {
      details.push(`${pPrefix} is not an object`);
      return;
    }

    if (item.type === 'repeat') {
      if (typeof item.repetitions !== 'number' || item.repetitions < 1) {
        details.push(`${pPrefix} (Repeat block): repetitions must be a positive number (got ${item.repetitions})`);
      }
      if (!Array.isArray(item.phases) || item.phases.length === 0) {
        details.push(`${pPrefix} (Repeat block): must contain at least one nested phase`);
      } else {
        item.phases.forEach((sub: any, subIdx: number) => {
          const subPrefix = `${pPrefix} sub-item #${subIdx + 1}`;
          checkPhaseSchema(sub, subPrefix, details);
        });
      }
    } else if (item.type === 'phase') {
      checkPhaseSchema(item, pPrefix, details);
    } else {
      details.push(`${pPrefix}: unknown type "${item.type}" (must be "phase" or "repeat")`);
    }
  });

  return {
    isValid: details.length === 0,
    details,
  };
}

function checkPhaseSchema(phase: any, prefix: string, details: string[]) {
  if (!phase || typeof phase !== 'object') {
    details.push(`${prefix} is not an object`);
    return;
  }
  if (!phase.name || typeof phase.name !== 'string') {
    details.push(`${prefix}: name is required`);
  }
  if (phase.durationType !== 'time' && phase.durationType !== 'distance') {
    details.push(`${prefix}: durationType must be "time" or "distance" (got "${phase.durationType}")`);
  }
  if (typeof phase.duration !== 'number' || isNaN(phase.duration) || phase.duration <= 0) {
    details.push(`${prefix}: duration must be a number > 0 (got ${phase.duration})`);
  }
  if (!phase.intensityType || !VALID_INTENSITIES.includes(phase.intensityType)) {
    details.push(`${prefix}: intensityType "${phase.intensityType}" is invalid (must be one of: ${VALID_INTENSITIES.join(', ')})`);
  } else {
    if (phase.intensityType === 'pace' && !phase.paceMin && !phase.paceMax) {
      details.push(`${prefix}: intensityType is "pace" but paceMin and paceMax are missing`);
    }
  }
}
