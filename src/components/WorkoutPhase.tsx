import React from 'react';
import {
  Clock,
  MapPin,
  Flame,
  Heart,
  Zap,
  Trash2,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import { WorkoutPhase, DurationType, IntensityType } from '../types/workout';
import { formatSecondsToTime, formatMetersToDistance } from '../utils/formatters';

interface WorkoutPhaseProps {
  phase: WorkoutPhase;
  indexNumber?: number; // 1-based sequential number
  isNested?: boolean;
  isEditable?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  onUpdate?: (phase: WorkoutPhase) => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export const WorkoutPhaseItem: React.FC<WorkoutPhaseProps> = ({
  phase,
  indexNumber,
  isNested = false,
  isEditable = false,
  hasError = false,
  errorMessage,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
}) => {
  const isAmbiguous = Boolean(phase.ambiguityWarning);

  // Intensity visual helper
  const renderIntensityBadge = () => {
    switch (phase.intensityType) {
      case 'easy':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Flame className="w-3 h-3 text-emerald-500" />
            Easy
          </span>
        );
      case 'recovery':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">
            <Flame className="w-3 h-3 text-teal-500" />
            Recovery
          </span>
        );
      case 'threshold':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-800 border border-orange-200">
            <Zap className="w-3 h-3 text-orange-600" />
            Threshold
          </span>
        );
      case 'tempo':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Zap className="w-3 h-3 text-amber-600" />
            Tempo
          </span>
        );
      case 'marathon_pace':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">
            <Zap className="w-3 h-3 text-purple-600" />
            Marathon Pace
          </span>
        );
      case 'pace':
        const paceStr =
          phase.paceMin && phase.paceMax && phase.paceMin !== phase.paceMax
            ? `${phase.paceMin}–${phase.paceMax} min/km`
            : `${phase.paceMin || phase.paceMax || '—'} min/km`;
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            <Zap className="w-3 h-3 text-blue-600" />
            {paceStr}
          </span>
        );
      case 'heart_rate':
        let hrBadgeText = 'HR';
        if (phase.zoneMin !== undefined || phase.zoneMax !== undefined) {
          const max = phase.zoneMax ?? phase.zoneMin ?? 2;
          hrBadgeText = max === 1 ? 'HR Z1' : `HR Z1–Z${max}`;
        } else if (phase.hrMin || phase.hrMax) {
          hrBadgeText = phase.hrMin && phase.hrMax
            ? `${phase.hrMin}–${phase.hrMax} bpm`
            : `${phase.hrMin || phase.hrMax} bpm`;
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <Heart className="w-3 h-3 text-rose-500" />
            {hrBadgeText}
          </span>
        );
      case 'speed':
        const maxSpeed = phase.zoneMax ?? phase.zoneMin ?? 4;
        const speedZoneText = maxSpeed === 1 ? 'Pace Z1' : `Pace Z1–Z${maxSpeed}`;
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
            <Zap className="w-3 h-3 text-indigo-600" />
            {speedZoneText}
          </span>
        );
      case 'none':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs text-neutral-500 bg-neutral-100 border border-neutral-200">
            Free pace
          </span>
        );
    }
  };

  // Preview Mode View
  if (!isEditable) {
    return (
      <div
        id={`phase-preview-${phase.id || phase.name}`}
        className={`relative rounded-lg p-3.5 border transition-all ${
          hasError
            ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-300'
            : isAmbiguous
            ? 'bg-amber-50/60 border-amber-300 ring-1 ring-amber-300'
            : isNested
            ? 'bg-white border-neutral-200 shadow-2xs'
            : 'bg-white border-neutral-200 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {indexNumber !== undefined && (
              <span className="text-xs font-mono font-bold text-neutral-400 w-4">
                {indexNumber}.
              </span>
            )}
            <div className="min-w-0">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800 truncate">
                {phase.name || 'Untitled Phase'}
              </h4>
              <div className="flex items-center gap-2 mt-1">
                {phase.durationType === 'distance' ? (
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-900">
                    <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                    {formatMetersToDistance(phase.duration)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-900">
                    <Clock className="w-3.5 h-3.5 text-neutral-400" />
                    {formatSecondsToTime(phase.duration)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {renderIntensityBadge()}
          </div>
        </div>

        {/* Ambiguity or error alerts */}
        {isAmbiguous && (
          <div className="mt-2 text-[11px] text-amber-800 flex items-center gap-1.5 pt-1.5 border-t border-amber-200/60">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>{phase.ambiguityWarning}</span>
          </div>
        )}
        {hasError && errorMessage && (
          <div className="mt-2 text-[11px] text-rose-700 flex items-center gap-1.5 pt-1.5 border-t border-rose-200">
            <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    );
  }

  // Editable Mode Form
  const handleDurationChange = (valStr: string) => {
    if (!onUpdate) return;
    const num = parseFloat(valStr) || 0;
    if (phase.durationType === 'distance') {
      // Input in kilometers or meters: let's interpret if < 100 as km, else meters
      // Standardize input: user inputs in km if < 50, otherwise meters
      onUpdate({ ...phase, duration: Math.max(0, num) });
    } else {
      // User inputs in seconds
      onUpdate({ ...phase, duration: Math.max(0, num) });
    }
  };

  return (
    <div
      id={`phase-editor-${phase.id || phase.name}`}
      className={`rounded-lg p-3.5 border transition-all ${
        hasError
          ? 'bg-rose-50/40 border-rose-300 ring-1 ring-rose-300'
          : isAmbiguous
          ? 'bg-amber-50/30 border-amber-300'
          : 'bg-white border-neutral-200 shadow-xs'
      }`}
    >
      {/* Top row: Name, reorder, delete */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-1">
          {indexNumber !== undefined && (
            <span className="text-xs font-mono font-bold text-neutral-400">
              {indexNumber}.
            </span>
          )}
          <input
            type="text"
            value={phase.name}
            onChange={(e) => onUpdate && onUpdate({ ...phase, name: e.target.value })}
            placeholder="Phase Name (e.g. Warm up, Interval)"
            className="text-xs font-bold uppercase tracking-wider text-neutral-900 bg-neutral-50 border border-neutral-200 rounded px-2 py-1 w-full max-w-[220px] focus:outline-none focus:ring-1 focus:ring-neutral-800"
          />
        </div>

        <div className="flex items-center gap-1">
          {onMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              title="Move Up"
              className="p-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-neutral-100"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              title="Move Down"
              className="p-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-neutral-100"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              title="Delete phase"
              className="p-1 text-neutral-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors ml-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Inputs grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
        {/* Duration Type */}
        <div>
          <label className="block text-[11px] font-medium text-neutral-500 mb-1">
            Duration Type
          </label>
          <select
            value={phase.durationType}
            onChange={(e) => {
              const newType = e.target.value as DurationType;
              if (onUpdate) {
                onUpdate({
                  ...phase,
                  durationType: newType,
                  duration: newType === 'distance' ? 1000 : 600,
                });
              }
            }}
            className="w-full bg-neutral-50 border border-neutral-200 rounded px-2 py-1.5 text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-800"
          >
            <option value="time">Time (Duration)</option>
            <option value="distance">Distance (Meters)</option>
          </select>
        </div>

        {/* Duration Value */}
        <div>
          <label className="block text-[11px] font-medium text-neutral-500 mb-1">
            {phase.durationType === 'distance' ? 'Distance (meters)' : 'Duration (seconds)'}
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="1"
              value={phase.duration || ''}
              onChange={(e) => handleDurationChange(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded px-2 py-1.5 text-neutral-900 font-mono focus:outline-none focus:ring-1 focus:ring-neutral-800"
            />
            <span className="text-[11px] font-mono text-neutral-500 shrink-0">
              {phase.durationType === 'distance'
                ? `≈ ${formatMetersToDistance(phase.duration)}`
                : `≈ ${formatSecondsToTime(phase.duration)}`}
            </span>
          </div>
        </div>

        {/* Intensity Type */}
        <div>
          <label className="block text-[11px] font-medium text-neutral-500 mb-1">
            Intensity
          </label>
          <select
            value={phase.intensityType}
            onChange={(e) => {
              const newInt = e.target.value as IntensityType;
              if (onUpdate) {
                onUpdate({
                  ...phase,
                  intensityType: newInt,
                  paceMin: newInt === 'pace' ? phase.paceMin || '4:50' : phase.paceMin,
                  paceMax: newInt === 'pace' ? phase.paceMax || '5:00' : phase.paceMax,
                });
              }
            }}
            className="w-full bg-neutral-50 border border-neutral-200 rounded px-2 py-1.5 text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-800"
          >
            <option value="none">Free (None)</option>
            <option value="easy">Easy</option>
            <option value="recovery">Recovery</option>
            <option value="threshold">Threshold</option>
            <option value="tempo">Tempo</option>
            <option value="marathon_pace">Marathon Pace</option>
            <option value="pace">Pace (min/km)</option>
            <option value="speed">Pace Zone (1–5)</option>
            <option value="heart_rate">Heart Rate (bpm or Zone)</option>
          </select>
        </div>

        {/* Dynamic target range based on intensityType */}
        <div>
          {phase.intensityType === 'pace' && (
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                Pace Range (Faster – Slower)
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  placeholder="4:50"
                  value={phase.paceMin || ''}
                  onChange={(e) => onUpdate && onUpdate({ ...phase, paceMin: e.target.value })}
                  className="w-16 bg-neutral-50 border border-neutral-200 rounded px-1.5 py-1 text-center font-mono text-xs focus:outline-none focus:ring-1 focus:ring-neutral-800"
                />
                <span className="text-neutral-400">–</span>
                <input
                  type="text"
                  placeholder="5:00"
                  value={phase.paceMax || ''}
                  onChange={(e) => onUpdate && onUpdate({ ...phase, paceMax: e.target.value })}
                  className="w-16 bg-neutral-50 border border-neutral-200 rounded px-1.5 py-1 text-center font-mono text-xs focus:outline-none focus:ring-1 focus:ring-neutral-800"
                />
                <span className="text-[10px] text-neutral-400">/km</span>
              </div>
            </div>
          )}

          {phase.intensityType === 'speed' && (
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                Pace Target (starts at Z1)
              </label>
              <select
                value={phase.zoneMax ?? phase.zoneMin ?? 4}
                onChange={(e) => {
                  const z = parseInt(e.target.value, 10);
                  onUpdate && onUpdate({ ...phase, zoneMin: 1, zoneMax: z });
                }}
                className="bg-neutral-50 border border-neutral-200 rounded px-2 py-1 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-neutral-800"
              >
                <option value={1}>Pace Z1</option>
                <option value={2}>Pace Z1–Z2</option>
                <option value={3}>Pace Z1–Z3</option>
                <option value={4}>Pace Z1–Z4</option>
                <option value={5}>Pace Z1–Z5</option>
              </select>
            </div>
          )}

          {phase.intensityType === 'heart_rate' && (
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                {phase.zoneMin !== undefined || phase.zoneMax !== undefined
                  ? 'HR Target (starts at Z1)'
                  : 'HR Range (bpm)'}
              </label>
              {phase.zoneMin !== undefined || phase.zoneMax !== undefined ? (
                <div className="flex items-center gap-1">
                  <select
                    value={phase.zoneMax ?? phase.zoneMin ?? 2}
                    onChange={(e) => {
                      const z = parseInt(e.target.value, 10);
                      onUpdate && onUpdate({ ...phase, zoneMin: 1, zoneMax: z });
                    }}
                    className="bg-neutral-50 border border-neutral-200 rounded px-2 py-1 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-neutral-800"
                  >
                    <option value={1}>HR Z1</option>
                    <option value={2}>HR Z1–Z2</option>
                    <option value={3}>HR Z1–Z3</option>
                    <option value={4}>HR Z1–Z4</option>
                    <option value={5}>HR Z1–Z5</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => onUpdate && onUpdate({ ...phase, zoneMin: undefined, zoneMax: undefined, hrMin: 140, hrMax: 155 })}
                    className="text-[10px] text-neutral-500 hover:text-neutral-800 underline ml-1"
                  >
                    Use bpm
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    placeholder="140"
                    value={phase.hrMin || ''}
                    onChange={(e) =>
                      onUpdate &&
                      onUpdate({
                        ...phase,
                        hrMin: e.target.value ? parseInt(e.target.value, 10) : undefined,
                      })
                    }
                    className="w-16 bg-neutral-50 border border-neutral-200 rounded px-1.5 py-1 text-center font-mono text-xs focus:outline-none focus:ring-1 focus:ring-neutral-800"
                  />
                  <span className="text-neutral-400">–</span>
                  <input
                    type="number"
                    placeholder="155"
                    value={phase.hrMax || ''}
                    onChange={(e) =>
                      onUpdate &&
                      onUpdate({
                        ...phase,
                        hrMax: e.target.value ? parseInt(e.target.value, 10) : undefined,
                      })
                    }
                    className="w-16 bg-neutral-50 border border-neutral-200 rounded px-1.5 py-1 text-center font-mono text-xs focus:outline-none focus:ring-1 focus:ring-neutral-800"
                  />
                  <span className="text-[10px] text-neutral-400">bpm</span>
                  <button
                    type="button"
                    onClick={() => onUpdate && onUpdate({ ...phase, hrMin: undefined, hrMax: undefined, zoneMin: 2, zoneMax: 2 })}
                    className="text-[10px] text-neutral-500 hover:text-neutral-800 underline ml-1"
                  >
                    Use Zone
                  </button>
                </div>
              )}
            </div>
          )}

          {phase.intensityType !== 'pace' &&
            phase.intensityType !== 'speed' &&
            phase.intensityType !== 'heart_rate' && (
              <div className="text-[11px] text-neutral-500 pt-3">
                {phase.intensityType === 'easy' && 'Easy aerobic effort (maps via Polar Zones)'}
                {phase.intensityType === 'recovery' && 'Recovery / jog effort (maps via Polar Zones)'}
                {phase.intensityType === 'threshold' && 'Lactate threshold effort (maps via Polar Zones)'}
                {phase.intensityType === 'tempo' && 'Sustained tempo effort (maps via Polar Zones)'}
                {phase.intensityType === 'marathon_pace' && 'Marathon pace effort (maps via Polar Zones)'}
                {phase.intensityType === 'none' && 'Free pace (no target)'}
              </div>
            )}
        </div>
      </div>

      {/* Warnings & Errors */}
      {isAmbiguous && (
        <div className="mt-2 text-[11px] text-amber-800 flex items-center gap-1.5 pt-2 border-t border-neutral-100">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>{phase.ambiguityWarning}</span>
        </div>
      )}
      {hasError && errorMessage && (
        <div className="mt-2 text-[11px] text-rose-700 flex items-center gap-1.5 pt-2 border-t border-rose-200">
          <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
