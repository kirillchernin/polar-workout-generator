import React, { useMemo } from 'react';
import { Workout, WorkoutItem, RepeatBlock as RepeatBlockType, WorkoutPhase } from '../types/workout';
import { formatSecondsToTime } from '../utils/formatters';
import { loadZoneSettings, resolveQualitativeIntensity } from '../utils/zoneStorage';
import { cleanPhaseName } from '../utils/polarExport';
import { DefaultIntensityMapping } from '../types/zones';

interface WorkoutPreviewProps {
  workout: Workout;
  onEdit: () => void;
  errorMap?: Record<string, string>;
}

/**
 * Format duration or distance into a clean string (e.g. "15:00", "800 m", "3 km")
 */
function formatPhaseDuration(phase: WorkoutPhase): string {
  if (phase.durationType === 'distance') {
    if (phase.duration >= 1000) {
      const km = phase.duration / 1000;
      return `${parseFloat(km.toFixed(2))} km`;
    }
    return `${Math.round(phase.duration)} m`;
  }
  return formatSecondsToTime(phase.duration);
}

/**
 * Split phase into clean name and duration without duplicating values
 */
function getPhaseLabels(phase: WorkoutPhase, indexPrefix?: string): { name: string; duration: string } {
  const durationStr = formatPhaseDuration(phase);
  const baseName = cleanPhaseName(phase.name);
  const displayName = indexPrefix ? `${indexPrefix} ${baseName || 'Phase'}` : (baseName || durationStr);

  if (!baseName) {
    return { name: displayName, duration: '' };
  }

  // Normalize by removing spaces, periods, and mapping Cyrillic distance units to Latin
  const normName = baseName.toLowerCase().replace(/[\s\.]/g, '').replace(/км/g, 'km').replace(/м/g, 'm');
  const normDur = durationStr.toLowerCase().replace(/[\s\.]/g, '');

  // If the phase name is literally just the duration (e.g. "800m", "15:00")
  if (normName === normDur) {
    return { name: displayName, duration: '' };
  }

  // If the phase name already contains the duration (e.g. "2:00 recovery")
  if (normName.includes(normDur)) {
    return { name: displayName, duration: '' };
  }

  return { name: displayName, duration: durationStr };
}

/**
 * Generate compact, schema-free intensity badge text & styling type
 */
function getIntensityBadge(
  phase: WorkoutPhase,
  defaultMapping?: DefaultIntensityMapping
): { text: string; type: 'hr' | 'pace' | 'neutral' } | null {
  if (phase.intensityType === 'none') {
    return null;
  }

  // Explicit speed / pace zone (e.g. Pace Z4 or Pace Z1–Z4)
  if (phase.intensityType === 'speed') {
    const max = phase.zoneMax ?? phase.zoneMin ?? 4;
    const text = max === 1 ? 'Pace Z1' : `Pace Z1–Z${max}`;
    return { text, type: 'pace' };
  }

  // Explicit heart rate (zone or bpm)
  if (phase.intensityType === 'heart_rate') {
    if (phase.zoneMin !== undefined || phase.zoneMax !== undefined) {
      const max = phase.zoneMax ?? phase.zoneMin ?? 2;
      const text = max === 1 ? 'HR Z1' : `HR Z1–Z${max}`;
      return { text, type: 'hr' };
    }
    if (phase.hrMin || phase.hrMax) {
      const text =
        phase.hrMin && phase.hrMax
          ? `${phase.hrMin}–${phase.hrMax} bpm`
          : `${phase.hrMin || phase.hrMax} bpm`;
      return { text, type: 'hr' };
    }
    return { text: 'HR', type: 'hr' };
  }

  // Explicit numeric pace (e.g. 4:30 /km)
  if (phase.intensityType === 'pace') {
    if (phase.paceMin && phase.paceMax && phase.paceMin !== phase.paceMax) {
      return { text: `${phase.paceMin}–${phase.paceMax} /km`, type: 'pace' };
    }
    const p = phase.paceMin || phase.paceMax;
    return { text: p ? `${p} /km` : 'Pace', type: 'pace' };
  }

  // Qualitative intensity mapped via user default settings
  if (defaultMapping) {
    const resolved = resolveQualitativeIntensity(phase.intensityType, defaultMapping);
    if (resolved) {
      const isHr = resolved.intensityType === 'heart_rate';
      const max = resolved.zoneMax;
      const zonePart = max === 1 ? 'Z1' : `Z1–Z${max}`;
      return {
        text: isHr ? `HR ${zonePart}` : `Pace ${zonePart}`,
        type: isHr ? 'hr' : 'pace',
      };
    }
  }

  // Fallback for unmapped qualitative
  const title = phase.intensityType.replace('_', ' ');
  return { text: title.charAt(0).toUpperCase() + title.slice(1), type: 'neutral' };
}

export const WorkoutPreview: React.FC<WorkoutPreviewProps> = ({
  workout,
  onEdit,
}) => {
  // Load user's default intensity mappings for badge resolution
  const zoneSettings = useMemo(() => loadZoneSettings(), []);

  // Compute total flattened phase count for global numbering
  const totalFlatPhases = useMemo(() => {
    let count = 0;
    for (const item of workout.phases || []) {
      if (item.type === 'repeat') {
        const reps = Math.max(1, item.repetitions || 1);
        count += reps * (item.phases?.length || 0);
      } else {
        count += 1;
      }
    }
    return Math.max(1, count);
  }, [workout.phases]);

  // Running counter for sequential position
  let flatIndex = 0;

  return (
    <div id="workout-preview-container" className="bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs">
      {/* 1. Workout Name */}
      <h2 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight pb-3.5 border-b border-neutral-100">
        {workout.name || 'Running Workout'}
      </h2>

      {/* 2. Compact Workout Structure */}
      <div className="divide-y divide-neutral-100 py-1">
        {(workout.phases || []).map((item: WorkoutItem, idx: number) => {
          if (item.type === 'repeat') {
            const repeat = item as RepeatBlockType;
            const reps = Math.max(1, repeat.repetitions || 1);
            const childCount = repeat.phases?.length || 0;
            const repPhaseCount = reps * childCount;
            const startNum = flatIndex + 1;
            const endNum = flatIndex + repPhaseCount;
            flatIndex += repPhaseCount;

            return (
              <div key={repeat.id || `rep_${idx}`} className="py-2.5">
                {/* Compact repeat header: e.g. "5 × (phases 2–11 of 13)" */}
                <div className="text-sm font-semibold text-neutral-900 mb-1">
                  {reps} × {repPhaseCount > 1 ? (
                    <span className="text-xs font-normal text-neutral-500 ml-1">
                      (phases {startNum}–{endNum} of {totalFlatPhases})
                    </span>
                  ) : ''}
                </div>
                {/* 2-3 compact rows for child phases, indented */}
                <div className="pl-3 sm:pl-4 space-y-1 border-l-2 border-neutral-200">
                  {(repeat.phases || []).map((child: WorkoutPhase, childIdx: number) => {
                    const { name, duration } = getPhaseLabels(child);
                    const badge = getIntensityBadge(child, zoneSettings.defaultIntensity);

                    return (
                      <div
                        key={child.id || `rep_child_${childIdx}`}
                        className="grid grid-cols-[1fr_80px_70px] sm:grid-cols-[1fr_110px_90px] items-center gap-2 sm:gap-4 py-0.5 text-sm"
                      >
                        <span className="font-medium text-neutral-800 truncate">{name}</span>
                        <span className="font-mono text-neutral-600 text-xs sm:text-sm text-right pr-1">
                          {duration}
                        </span>
                        <div className="flex justify-end">
                          {badge && (
                            <span
                              className={`inline-block text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded whitespace-nowrap ${
                                badge.type === 'hr'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200/70'
                                  : badge.type === 'pace'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/70'
                                  : 'bg-neutral-100 text-neutral-700'
                              }`}
                            >
                              {badge.text}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }

          // Normal single phase with global numbering (e.g. 1/5 Warm up)
          const phase = item as WorkoutPhase;
          const currentNum = ++flatIndex;
          const indexPrefix = `${currentNum}/${totalFlatPhases}`;
          const { name, duration } = getPhaseLabels(phase, indexPrefix);
          const badge = getIntensityBadge(phase, zoneSettings.defaultIntensity);

          return (
            <div key={phase.id || `phase_${idx}`} className="py-2.5">
              <div className="grid grid-cols-[1fr_80px_70px] sm:grid-cols-[1fr_110px_90px] items-center gap-2 sm:gap-4 text-sm">
                <span className="font-medium text-neutral-800 truncate">{name}</span>
                <span className="font-mono text-neutral-600 text-xs sm:text-sm text-right pr-1">
                  {duration}
                </span>
                <div className="flex justify-end">
                  {badge && (
                    <span
                      className={`inline-block text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded whitespace-nowrap ${
                        badge.type === 'hr'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200/70'
                          : badge.type === 'pace'
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/70'
                          : 'bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      {badge.text}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Actions: Only [ Edit ] */}
      <div className="pt-3.5 mt-2 border-t border-neutral-100 flex items-center justify-end">
        <button
          type="button"
          id="edit-workout-btn"
          onClick={onEdit}
          className="px-4 py-2 rounded-lg border border-neutral-300 hover:border-neutral-400 bg-white text-neutral-700 text-xs sm:text-sm font-medium hover:bg-neutral-50 transition-colors cursor-pointer"
        >
          Edit
        </button>
      </div>
    </div>
  );
};


