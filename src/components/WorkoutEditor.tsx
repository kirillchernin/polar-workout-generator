import React from 'react';
import {
  Check,
  Plus,
  Calendar,
  Tag,
  Repeat,
  RotateCcw,
} from 'lucide-react';
import {
  Workout,
  WorkoutItem,
  WorkoutPhase,
  RepeatBlock as RepeatBlockType,
} from '../types/workout';
import { WorkoutPhaseItem } from './WorkoutPhase';
import { RepeatBlock } from './RepeatBlock';

interface WorkoutEditorProps {
  workout: Workout;
  onChange: (updated: Workout) => void;
  onDone: () => void;
  onReset: () => void;
  errorMap?: Record<string, string>;
}

export const WorkoutEditor: React.FC<WorkoutEditorProps> = ({
  workout,
  onChange,
  onDone,
  onReset,
  errorMap = {},
}) => {
  // Update phase item
  const handleUpdateItem = (index: number, updatedItem: WorkoutItem) => {
    const newPhases = [...workout.phases];
    newPhases[index] = updatedItem;
    onChange({ ...workout, phases: newPhases });
  };

  // Delete item
  const handleDeleteItem = (index: number) => {
    const newPhases = workout.phases.filter((_, i) => i !== index);
    onChange({ ...workout, phases: newPhases });
  };

  // Move item up/down
  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= workout.phases.length) return;
    const newPhases = [...workout.phases];
    const temp = newPhases[index];
    newPhases[index] = newPhases[targetIndex];
    newPhases[targetIndex] = temp;
    onChange({ ...workout, phases: newPhases });
  };

  // Add a new root phase
  const handleAddPhase = () => {
    const newPhase: WorkoutPhase = {
      id: `p_${Date.now()}`,
      type: 'phase',
      name: 'Interval',
      durationType: 'time',
      duration: 300,
      intensityType: 'easy',
    };
    onChange({ ...workout, phases: [...workout.phases, newPhase] });
  };

  // Add a new repeat block
  const handleAddRepeatBlock = () => {
    const newRepeat: RepeatBlockType = {
      id: `r_${Date.now()}`,
      type: 'repeat',
      repetitions: 5,
      phases: [
        {
          id: `p_${Date.now()}_1`,
          type: 'phase',
          name: 'Interval',
          durationType: 'distance',
          duration: 1000,
          intensityType: 'pace',
          paceMin: '4:50',
          paceMax: '5:00',
        },
        {
          id: `p_${Date.now()}_2`,
          type: 'phase',
          name: 'Recovery',
          durationType: 'time',
          duration: 120,
          intensityType: 'easy',
        },
      ],
    };
    onChange({ ...workout, phases: [...workout.phases, newRepeat] });
  };

  return (
    <div id="workout-editor-container" className="space-y-4">
      {/* Editor Header: Title, Date, Finish editing */}
      <div className="bg-white border border-neutral-300 rounded-xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-neutral-400" />
                Workout Name
              </label>
              <input
                type="text"
                value={workout.name}
                onChange={(e) => onChange({ ...workout, name: e.target.value })}
                placeholder="Workout Name"
                className="w-full text-sm font-semibold text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                Workout Date
              </label>
              <input
                type="date"
                value={workout.date}
                onChange={(e) => onChange({ ...workout, date: e.target.value })}
                className="w-full text-sm text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              type="button"
              id="reset-editor-btn"
              onClick={onReset}
              title="Reset changes back to last generated state"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-200 hover:border-neutral-400 bg-white text-neutral-600 text-xs font-medium hover:bg-neutral-50 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <button
              type="button"
              id="done-editing-btn"
              onClick={onDone}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors shadow-2xs cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Done Editing</span>
            </button>
          </div>
        </div>
      </div>

      {/* List of Editable Phases & Repeat Blocks */}
      <div className="space-y-3">
        {workout.phases.map((item, index) => {
          if (item.type === 'repeat') {
            return (
              <RepeatBlock
                key={item.id || `rep_edit_${index}`}
                repeat={item as RepeatBlockType}
                isEditable={true}
                hasError={Boolean(errorMap[item.id || `phases[${index}]`])}
                errorMessage={errorMap[item.id || `phases[${index}]`]}
                onUpdate={(updated) => handleUpdateItem(index, updated)}
                onDelete={() => handleDeleteItem(index)}
                onMoveUp={() => handleMoveItem(index, 'up')}
                onMoveDown={() => handleMoveItem(index, 'down')}
                canMoveUp={index > 0}
                canMoveDown={index < workout.phases.length - 1}
                errorMap={errorMap}
              />
            );
          }

          return (
            <WorkoutPhaseItem
              key={item.id || `ph_edit_${index}`}
              phase={item as WorkoutPhase}
              indexNumber={index + 1}
              isNested={false}
              isEditable={true}
              hasError={Boolean(errorMap[item.id || `phases[${index}]`])}
              errorMessage={errorMap[item.id || `phases[${index}]`]}
              onUpdate={(updated) => handleUpdateItem(index, updated)}
              onDelete={() => handleDeleteItem(index)}
              onMoveUp={() => handleMoveItem(index, 'up')}
              onMoveDown={() => handleMoveItem(index, 'down')}
              canMoveUp={index > 0}
              canMoveDown={index < workout.phases.length - 1}
            />
          );
        })}
      </div>

      {/* Action Add Buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          id="add-phase-btn"
          onClick={handleAddPhase}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-neutral-300 hover:border-neutral-900 bg-white hover:bg-neutral-50 text-neutral-800 text-xs font-medium transition-colors shadow-2xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Add phase</span>
        </button>

        <button
          type="button"
          id="add-repeat-block-btn"
          onClick={handleAddRepeatBlock}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-neutral-300 hover:border-neutral-900 bg-white hover:bg-neutral-50 text-neutral-800 text-xs font-medium transition-colors shadow-2xs cursor-pointer"
        >
          <Repeat className="w-3.5 h-3.5" />
          <span>+ Add repeat block</span>
        </button>
      </div>
    </div>
  );
};
