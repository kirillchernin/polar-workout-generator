import React from 'react';
import {
  Repeat,
  Trash2,
  ChevronUp,
  ChevronDown,
  Plus,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import { RepeatBlock as RepeatBlockType, WorkoutPhase } from '../types/workout';
import { WorkoutPhaseItem } from './WorkoutPhase';

interface RepeatBlockProps {
  repeat: RepeatBlockType;
  isEditable?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  onUpdate?: (updated: RepeatBlockType) => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  errorMap?: Record<string, string>;
}

export const RepeatBlock: React.FC<RepeatBlockProps> = ({
  repeat,
  isEditable = false,
  hasError = false,
  errorMessage,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  errorMap = {},
}) => {
  const isAmbiguous = Boolean(repeat.ambiguityWarning);

  // Sub-phase operations
  const handleUpdateSubPhase = (subIndex: number, updatedPhase: WorkoutPhase) => {
    if (!onUpdate) return;
    const newPhases = [...repeat.phases];
    newPhases[subIndex] = updatedPhase;
    onUpdate({ ...repeat, phases: newPhases });
  };

  const handleDeleteSubPhase = (subIndex: number) => {
    if (!onUpdate) return;
    const newPhases = repeat.phases.filter((_, i) => i !== subIndex);
    onUpdate({ ...repeat, phases: newPhases });
  };

  const handleMoveSubPhase = (subIndex: number, direction: 'up' | 'down') => {
    if (!onUpdate) return;
    const targetIndex = direction === 'up' ? subIndex - 1 : subIndex + 1;
    if (targetIndex < 0 || targetIndex >= repeat.phases.length) return;
    const newPhases = [...repeat.phases];
    const temp = newPhases[subIndex];
    newPhases[subIndex] = newPhases[targetIndex];
    newPhases[targetIndex] = temp;
    onUpdate({ ...repeat, phases: newPhases });
  };

  const handleAddSubPhase = () => {
    if (!onUpdate) return;
    const newPhase: WorkoutPhase = {
      id: `p_${Date.now()}`,
      type: 'phase',
      name: repeat.phases.length % 2 === 0 ? 'Interval' : 'Recovery',
      durationType: 'time',
      duration: 120,
      intensityType: 'easy',
    };
    onUpdate({ ...repeat, phases: [...repeat.phases, newPhase] });
  };

  // Preview Mode
  if (!isEditable) {
    return (
      <div
        id={`repeat-preview-${repeat.id || 'block'}`}
        className={`rounded-xl border p-4 transition-all ${
          hasError
            ? 'bg-rose-50/40 border-rose-300 ring-1 ring-rose-300'
            : isAmbiguous
            ? 'bg-amber-50/30 border-amber-300'
            : 'bg-neutral-50/80 border-neutral-300 shadow-2xs'
        }`}
      >
        {/* Repeat Header Badge */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-neutral-900 text-white text-xs font-bold tracking-wider uppercase">
            <Repeat className="w-3.5 h-3.5 text-neutral-300" />
            <span>REPEAT × {repeat.repetitions}</span>
          </div>

          <div className="text-[11px] text-neutral-500 font-medium">
            {repeat.phases.length} {repeat.phases.length === 1 ? 'phase' : 'phases'} per cycle
          </div>
        </div>

        {/* Nested Indented Container with Vertical Guideline */}
        <div className="relative pl-4 sm:pl-5 space-y-2 border-l-2 border-neutral-300 ml-2 sm:ml-3">
          {repeat.phases.map((phase, idx) => (
            <WorkoutPhaseItem
              key={phase.id || `sub_${idx}`}
              phase={phase}
              indexNumber={idx + 1}
              isNested={true}
              isEditable={false}
              hasError={Boolean(errorMap[phase.id || `phases[${idx}]`])}
              errorMessage={errorMap[phase.id || `phases[${idx}]`]}
            />
          ))}

          {repeat.phases.length === 0 && (
            <div className="text-xs text-neutral-400 italic py-2">
              No phases defined inside repeat block.
            </div>
          )}
        </div>

        {hasError && errorMessage && (
          <div className="mt-2 text-xs text-rose-700 flex items-center gap-1.5 pt-2 border-t border-rose-200">
            <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    );
  }

  // Editable Mode
  return (
    <div
      id={`repeat-editor-${repeat.id || 'block'}`}
      className={`rounded-xl border p-4 transition-all ${
        hasError
          ? 'bg-rose-50/20 border-rose-300 ring-1 ring-rose-300'
          : isAmbiguous
          ? 'bg-amber-50/20 border-amber-300'
          : 'bg-neutral-50/60 border-neutral-300 shadow-xs'
      }`}
    >
      {/* Header bar: repetitions input, reorder, delete */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5 pb-2.5 border-b border-neutral-200">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-900 text-white text-xs font-bold uppercase tracking-wider">
            <Repeat className="w-3.5 h-3.5" />
            <span>REPEAT</span>
          </div>

          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-xs text-neutral-600 font-medium">Count:</span>
            <input
              type="number"
              min="1"
              max="99"
              value={repeat.repetitions || ''}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (onUpdate) {
                  onUpdate({ ...repeat, repetitions: isNaN(val) ? 1 : Math.max(1, val) });
                }
              }}
              className="w-16 bg-white border border-neutral-300 rounded px-2 py-1 text-center font-bold text-xs text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-800"
            />
            <span className="text-xs text-neutral-500 font-medium">times</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              title="Move repeat block up"
              className="p-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-30 rounded hover:bg-neutral-200/60"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              title="Move repeat block down"
              className="p-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-30 rounded hover:bg-neutral-200/60"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              title="Delete entire repeat block"
              className="p-1 text-neutral-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors ml-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Sub-phases list */}
      <div className="relative pl-3.5 sm:pl-4 space-y-2.5 border-l-2 border-neutral-300 ml-1 sm:ml-2">
        {repeat.phases.map((phase, idx) => (
          <WorkoutPhaseItem
            key={phase.id || `sub_edit_${idx}`}
            phase={phase}
            indexNumber={idx + 1}
            isNested={true}
            isEditable={true}
            hasError={Boolean(errorMap[phase.id || `phases[${idx}]`])}
            errorMessage={errorMap[phase.id || `phases[${idx}]`]}
            onUpdate={(updated) => handleUpdateSubPhase(idx, updated)}
            onDelete={() => handleDeleteSubPhase(idx)}
            onMoveUp={() => handleMoveSubPhase(idx, 'up')}
            onMoveDown={() => handleMoveSubPhase(idx, 'down')}
            canMoveUp={idx > 0}
            canMoveDown={idx < repeat.phases.length - 1}
          />
        ))}

        {/* Add sub-phase button */}
        <button
          type="button"
          onClick={handleAddSubPhase}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900 bg-white hover:bg-neutral-100 border border-neutral-300 border-dashed rounded-lg px-3 py-1.5 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add phase to repeat</span>
        </button>
      </div>

      {hasError && errorMessage && (
        <div className="mt-2 text-xs text-rose-700 flex items-center gap-1.5 pt-2 border-t border-rose-200">
          <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
