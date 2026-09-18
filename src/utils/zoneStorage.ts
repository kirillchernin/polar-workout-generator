import {
  PolarZoneSettings,
  DEFAULT_ZONE_SETTINGS,
  DEFAULT_HR_ZONES,
  DEFAULT_PACE_ZONES,
  DEFAULT_INTENSITY_MAPPING,
  ZoneSetting,
  DefaultIntensityMapping,
} from '../types/zones';
import { isValidPace, paceToSeconds } from './formatters';

const STORAGE_KEY = 'polar_zone_settings_v1';

/**
 * Normalizes any stored value (legacy string or ZoneSetting object) into a clean ZoneSetting.
 * Stored object contains ONLY intensityType and zoneMax (1-5). zoneMin is NOT stored.
 */
export function normalizeToZoneSetting(item: any, fallback: ZoneSetting): ZoneSetting {
  if (!item) return fallback;

  if (typeof item === 'object') {
    const intensityType: 'heart_rate' | 'speed' =
      item.intensityType === 'speed' ? 'speed' : 'heart_rate';
    const parsedMax =
      typeof item.zoneMax === 'number'
        ? item.zoneMax
        : typeof item.zoneMin === 'number'
        ? item.zoneMin
        : fallback.zoneMax;
    const zoneMax = (Math.min(5, Math.max(1, Math.round(parsedMax))) as 1 | 2 | 3 | 4 | 5);
    return { intensityType, zoneMax };
  }

  if (typeof item === 'string') {
    const isHr = item.toUpperCase().startsWith('HR');
    const intensityType: 'heart_rate' | 'speed' = isHr ? 'heart_rate' : 'speed';
    const matches = Array.from(item.matchAll(/\d+/g)).map((m) => parseInt(m[0], 10));
    if (matches.length > 0) {
      const highest = Math.max(...matches);
      const zoneMax = (Math.min(5, Math.max(1, highest)) as 1 | 2 | 3 | 4 | 5);
      return { intensityType, zoneMax };
    }
    return fallback;
  }

  return fallback;
}

/**
 * Loads Polar zone settings from localStorage with fallback to default values.
 */
export function loadZoneSettings(): PolarZoneSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ZONE_SETTINGS;
    const parsed = JSON.parse(raw);

    const hrZones = Array.isArray(parsed.hrZones) && parsed.hrZones.length === 5
      ? parsed.hrZones
      : DEFAULT_HR_ZONES;

    const paceZones = Array.isArray(parsed.paceZones) && parsed.paceZones.length === 5
      ? parsed.paceZones
      : DEFAULT_PACE_ZONES;

    const rawMap = parsed.defaultIntensity || {};
    const defaultIntensity: DefaultIntensityMapping = {
      easy: normalizeToZoneSetting(rawMap.easy, DEFAULT_INTENSITY_MAPPING.easy),
      recovery: normalizeToZoneSetting(rawMap.recovery, DEFAULT_INTENSITY_MAPPING.recovery),
      tempo: normalizeToZoneSetting(rawMap.tempo, DEFAULT_INTENSITY_MAPPING.tempo),
      threshold: normalizeToZoneSetting(rawMap.threshold, DEFAULT_INTENSITY_MAPPING.threshold),
      intervals: normalizeToZoneSetting(rawMap.intervals, DEFAULT_INTENSITY_MAPPING.intervals),
    };

    return {
      hrZones,
      paceZones,
      defaultIntensity,
    };
  } catch (err) {
    console.error('Failed to load zone settings from localStorage:', err);
    return DEFAULT_ZONE_SETTINGS;
  }
}

/**
 * Saves Polar zone settings to localStorage.
 * Ensures defaultIntensity only stores intensityType and zoneMax.
 */
export function saveZoneSettings(settings: PolarZoneSettings): void {
  try {
    const cleanSettings: PolarZoneSettings = {
      hrZones: settings.hrZones,
      paceZones: settings.paceZones,
      defaultIntensity: {
        easy: { intensityType: settings.defaultIntensity.easy.intensityType, zoneMax: settings.defaultIntensity.easy.zoneMax },
        recovery: { intensityType: settings.defaultIntensity.recovery.intensityType, zoneMax: settings.defaultIntensity.recovery.zoneMax },
        tempo: { intensityType: settings.defaultIntensity.tempo.intensityType, zoneMax: settings.defaultIntensity.tempo.zoneMax },
        threshold: { intensityType: settings.defaultIntensity.threshold.intensityType, zoneMax: settings.defaultIntensity.threshold.zoneMax },
        intervals: { intensityType: settings.defaultIntensity.intervals.intensityType, zoneMax: settings.defaultIntensity.intervals.zoneMax },
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanSettings));
  } catch (err) {
    console.error('Failed to save zone settings to localStorage:', err);
  }
}

/**
 * Validates zone settings according to Polar rules:
 * - HR: 1 <= min <= max <= 250
 * - Pace: valid MM:SS values (Z5 faster can be blank)
 * - Zone numbers: 1 to 5
 */
export function validateZoneSettings(settings: PolarZoneSettings): { isValid: boolean; error: string | null } {
  if (!settings || !Array.isArray(settings.hrZones) || settings.hrZones.length !== 5) {
    return { isValid: false, error: 'Must specify all 5 Heart Rate zones.' };
  }
  if (!Array.isArray(settings.paceZones) || settings.paceZones.length !== 5) {
    return { isValid: false, error: 'Must specify all 5 Pace zones.' };
  }

  // Validate HR zones
  for (const hr of settings.hrZones) {
    if (typeof hr.min !== 'number' || typeof hr.max !== 'number' || isNaN(hr.min) || isNaN(hr.max)) {
      return { isValid: false, error: `HR Z${hr.zone}: Min and Max must be valid numbers.` };
    }
    if (hr.min < 1 || hr.min > 250 || hr.max < 1 || hr.max > 250) {
      return { isValid: false, error: `HR Z${hr.zone}: Values must be between 1 and 250 bpm.` };
    }
    if (hr.min > hr.max) {
      return { isValid: false, error: `HR Z${hr.zone}: Min (${hr.min}) cannot exceed Max (${hr.max}).` };
    }
  }

  // Validate Pace zones
  for (const pace of settings.paceZones) {
    // Slower pace is mandatory for all 5 zones
    if (!pace.slower || !isValidPace(pace.slower.trim())) {
      return { isValid: false, error: `Pace Z${pace.zone}: Slower pace must be in M:SS format (e.g. 5:56).` };
    }

    // Faster pace is mandatory for Z1-Z4, optional for Z5
    if (pace.zone < 5) {
      if (!pace.faster || !isValidPace(pace.faster.trim())) {
        return { isValid: false, error: `Pace Z${pace.zone}: Faster pace must be in M:SS format (e.g. 4:55).` };
      }
      const fasterSec = paceToSeconds(pace.faster.trim())!;
      const slowerSec = paceToSeconds(pace.slower.trim())!;
      if (fasterSec > slowerSec) {
        return {
          isValid: false,
          error: `Pace Z${pace.zone}: Faster pace (${pace.faster}) is slower than Slower pace (${pace.slower}).`,
        };
      }
    } else {
      // Zone 5: if faster is specified, must be valid and faster than slower
      if (pace.faster && pace.faster.trim()) {
        if (!isValidPace(pace.faster.trim())) {
          return { isValid: false, error: `Pace Z5: Faster pace must be valid M:SS format or blank.` };
        }
        const fasterSec = paceToSeconds(pace.faster.trim())!;
        const slowerSec = paceToSeconds(pace.slower.trim())!;
        if (fasterSec > slowerSec) {
          return {
            isValid: false,
            error: `Pace Z5: Faster pace (${pace.faster}) is slower than Slower pace (${pace.slower}).`,
          };
        }
      }
    }
  }

  return { isValid: true, error: null };
}

/**
 * Parses a ZoneChoice string or ZoneSetting into intensityType ("heart_rate" | "speed"),
 * where zoneMin is ALWAYS 1, and zoneMax is the upper zone (1-5).
 * Examples:
 * "HR Z2" -> { intensityType: "heart_rate", zoneMin: 1, zoneMax: 2 }
 * "HR Z1-Z2" -> { intensityType: "heart_rate", zoneMin: 1, zoneMax: 2 }
 * "HR Z2-Z4" -> { intensityType: "heart_rate", zoneMin: 1, zoneMax: 4 } (normalized to start at 1)
 * "Pace Z3" -> { intensityType: "speed", zoneMin: 1, zoneMax: 3 }
 */
export function parseZoneChoice(choice: any): {
  intensityType: 'heart_rate' | 'speed';
  zoneMin: 1;
  zoneMax: number;
} {
  if (!choice) {
    return { intensityType: 'heart_rate', zoneMin: 1, zoneMax: 2 };
  }

  if (typeof choice === 'object') {
    const intensityType: 'heart_rate' | 'speed' =
      choice.intensityType === 'speed' ? 'speed' : 'heart_rate';
    const parsedMax =
      typeof choice.zoneMax === 'number'
        ? choice.zoneMax
        : typeof choice.zoneMin === 'number'
        ? choice.zoneMin
        : 2;
    const max = Math.min(5, Math.max(1, Math.round(parsedMax)));
    return { intensityType, zoneMin: 1, zoneMax: max };
  }

  if (typeof choice === 'string') {
    const isHr = choice.toUpperCase().startsWith('HR');
    const intensityType: 'heart_rate' | 'speed' = isHr ? 'heart_rate' : 'speed';
    const matches = Array.from(choice.matchAll(/\d+/g)).map((m) => parseInt(m[0], 10));
    if (matches.length > 0) {
      const highest = Math.max(...matches);
      const max = Math.min(5, Math.max(1, highest));
      return { intensityType, zoneMin: 1, zoneMax: max };
    }
    return { intensityType, zoneMin: 1, zoneMax: 2 };
  }

  return { intensityType: 'heart_rate', zoneMin: 1, zoneMax: 2 };
}

/**
 * Resolves a qualitative term ("easy", "recovery", "tempo", "threshold", "intervals", "interval")
 * to its mapped intensityType, with zoneMin ALWAYS 1 and zoneMax from user's default setting.
 */
export function resolveQualitativeIntensity(
  term: string,
  mapping: DefaultIntensityMapping
): { intensityType: 'heart_rate' | 'speed'; zoneMin: 1; zoneMax: number } | null {
  const normalized = term.toLowerCase().trim();

  let setting: ZoneSetting | undefined;
  if (normalized === 'easy' || normalized === 'легко' || normalized === 'разминка' || normalized === 'заминка') {
    setting = mapping.easy;
  } else if (normalized === 'recovery' || normalized === 'восстановление' || normalized === 'отдых') {
    setting = mapping.recovery;
  } else if (normalized === 'tempo' || normalized === 'темп' || normalized === 'темповый') {
    setting = mapping.tempo;
  } else if (normalized === 'threshold' || normalized === 'порог' || normalized === 'пано') {
    setting = mapping.threshold;
  } else if (normalized === 'interval' || normalized === 'intervals' || normalized === 'интервал' || normalized === 'интервалы') {
    setting = mapping.intervals;
  }

  if (setting) {
    return {
      intensityType: setting.intensityType,
      zoneMin: 1,
      zoneMax: setting.zoneMax,
    };
  }

  return null;
}
