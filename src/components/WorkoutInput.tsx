import React from 'react';
import { Calendar, Play, Tag, Loader2, RotateCcw, Check } from 'lucide-react';

export type CreateButtonState =
  | 'READY'
  | 'WORKING'
  | 'SUCCESS'
  | 'ERROR_EXTENSION_MISSING'
  | 'ERROR_POLAR_LOGIN'
  | 'ERROR_OTHER';

interface WorkoutInputProps {
  text: string;
  onTextChange: (text: string) => void;
  workoutName: string;
  onWorkoutNameChange: (name: string) => void;
  date: string;
  onDateChange: (date: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
  onCreateInPolar: () => void;
  isCreating: boolean;
  createButtonState: CreateButtonState;
  createErrorMessage: string | null;
  hasValidWorkout: boolean;
  isExtensionAvailable: boolean | null;
}

function getCreateButtonContent(
  state: CreateButtonState,
  isCreating: boolean,
  customErrorMsg: string | null
) {
  if (isCreating || state === 'WORKING') {
    return (
      <>
        <Loader2 className="w-4 h-4 animate-spin text-white" />
        <span>Creating...</span>
      </>
    );
  }
  if (state === 'SUCCESS') {
    return (
      <>
        <Check className="w-4 h-4 text-white" />
        <span>Target scheduled in Polar Flow ✓</span>
      </>
    );
  }
  if (state === 'ERROR_EXTENSION_MISSING') {
    return <span>Polar extension not installed</span>;
  }
  if (state === 'ERROR_POLAR_LOGIN') {
    return <span>Please log in to Polar Flow</span>;
  }
  if (state === 'ERROR_OTHER') {
    return (
      <span>
        {customErrorMsg && customErrorMsg.length <= 32
          ? customErrorMsg
          : 'Could not create workout'}
      </span>
    );
  }
  return <span>Create in Polar Flow</span>;
}

export const WorkoutInput: React.FC<WorkoutInputProps> = ({
  text,
  onTextChange,
  workoutName,
  onWorkoutNameChange,
  date,
  onDateChange,
  onGenerate,
  isLoading,
  onCreateInPolar,
  isCreating,
  createButtonState,
  createErrorMessage,
  hasValidWorkout,
  isExtensionAvailable,
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isLoading || isCreating) return;
    onGenerate();
  };

  const handleClear = () => {
    onTextChange('');
    onWorkoutNameChange('');
  };

  const getCreateButtonClasses = () => {
    if (!hasValidWorkout) {
      return 'bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed';
    }
    if (isCreating || createButtonState === 'WORKING') {
      return 'bg-red-600/80 text-white cursor-not-allowed opacity-90';
    }
    if (createButtonState === 'SUCCESS') {
      return 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-default shadow-xs';
    }
    if (createButtonState === 'ERROR_EXTENSION_MISSING') {
      return 'bg-neutral-800 hover:bg-neutral-900 text-white cursor-pointer shadow-xs';
    }
    if (createButtonState === 'ERROR_POLAR_LOGIN') {
      return 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs';
    }
    if (createButtonState === 'ERROR_OTHER') {
      return 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs';
    }
    return 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white cursor-pointer shadow-xs';
  };

  return (
    <div
      id="workout-input-card"
      className="bg-white border border-neutral-200 rounded-xl p-5 sm:p-6 shadow-xs"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 1. Workout Description */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="workout-text-input"
              className="text-xs font-semibold uppercase tracking-wider text-neutral-600"
            >
              Workout Description
            </label>
            {text && (
              <button
                type="button"
                id="clear-input-btn"
                onClick={handleClear}
                disabled={isLoading || isCreating}
                className="text-xs text-neutral-400 hover:text-neutral-700 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
          <textarea
            id="workout-text-input"
            rows={4}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            disabled={isLoading || isCreating}
            placeholder="Example: 10 min easy warm-up, then 5 x 1 km at 4:50-5:00/km with 2 min easy recovery, then 10 min cool-down."
            className="w-full text-sm sm:text-base text-neutral-900 placeholder:text-neutral-400 bg-neutral-50/50 border border-neutral-200 rounded-lg p-3.5 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all resize-y min-h-[110px]"
          />
        </div>

        {/* 2. Workout Name (left) and Date (right) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label
              htmlFor="workout-name-input"
              className="block text-xs font-medium text-neutral-700 mb-1 flex items-center gap-1.5"
            >
              <Tag className="w-3.5 h-3.5 text-neutral-400" />
              Workout Name <span className="text-neutral-400 text-[11px]">(optional)</span>
            </label>
            <input
              type="text"
              id="workout-name-input"
              value={workoutName}
              onChange={(e) => onWorkoutNameChange(e.target.value)}
              disabled={isLoading || isCreating}
              placeholder="Leave blank to auto-detect"
              className="w-full text-sm text-neutral-900 placeholder:text-neutral-400 bg-white border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label
              htmlFor="workout-date-input"
              className="block text-xs font-medium text-neutral-700 mb-1 flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
              Date
            </label>
            <input
              type="date"
              id="workout-date-input"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              disabled={isLoading || isCreating}
              className="w-full text-sm text-neutral-900 bg-white border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* 3. Main Action Buttons: [ Generate Workout ] [ Create in Polar Flow ] */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Generate Workout */}
          <button
            type="submit"
            id="generate-workout-btn"
            disabled={isLoading || isCreating || !text.trim()}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 active:bg-black text-white text-sm font-semibold transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-neutral-300" />
                <span>Parsing Workout...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Generate Workout</span>
              </>
            )}
          </button>

          {/* Create in Polar Flow */}
          <button
            type="button"
            id="create-polar-flow-btn"
            onClick={onCreateInPolar}
            disabled={!hasValidWorkout || isLoading || isCreating}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${getCreateButtonClasses()}`}
          >
            {getCreateButtonContent(createButtonState, isCreating, createErrorMessage)}
          </button>
        </div>

        {/* Status / Notices below action row */}
        {((isExtensionAvailable === false && createButtonState === 'READY') ||
          (createButtonState === 'ERROR_OTHER' &&
            createErrorMessage &&
            createErrorMessage.length > 32)) && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-0.5">
            {isExtensionAvailable === false && createButtonState === 'READY' && (
              <span className="text-xs text-amber-700 font-medium">
                Polar extension required
              </span>
            )}
            {createButtonState === 'ERROR_OTHER' && createErrorMessage && (
              <span className="text-xs text-rose-700 font-medium">
                {createErrorMessage}
              </span>
            )}
          </div>
        )}
      </form>
    </div>
  );
};
