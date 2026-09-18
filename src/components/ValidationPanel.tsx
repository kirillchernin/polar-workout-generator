import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ValidationResult } from '../types/workout';

interface ValidationPanelProps {
  validation: ValidationResult;
  onJumpToError?: (errorId: string) => void;
}

export const ValidationPanel: React.FC<ValidationPanelProps> = ({ validation, onJumpToError }) => {
  const { isValid, errors, warnings } = validation;

  if (isValid && warnings.length === 0) {
    return (
      <div
        id="validation-success-panel"
        className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium"
      >
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>Valid Polar Phased Target structure. Ready for training or export.</span>
      </div>
    );
  }

  return (
    <div id="validation-panel" className="space-y-2">
      {/* Ambiguity / Warnings */}
      {warnings.length > 0 && (
        <div
          id="validation-warning-box"
          className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs"
        >
          <div className="flex items-center gap-2 font-semibold text-amber-950 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Some workout details are ambiguous. Please review the highlighted phase.</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 ml-1 text-amber-800">
            {warnings.map((warn, i) => (
              <li key={`warn-${i}`}>{warn}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Strict Validation Errors */}
      {errors.length > 0 && (
        <div
          id="validation-error-box"
          className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs"
        >
          <div className="flex items-center gap-2 font-semibold text-rose-950 mb-1.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Validation issues detected ({errors.length}):</span>
          </div>
          <ul className="space-y-1 ml-1 text-rose-800">
            {errors.map((err, i) => (
              <li
                key={`err-${i}`}
                className="flex items-start gap-1.5 cursor-pointer hover:text-rose-950 transition-colors"
                onClick={() => onJumpToError && onJumpToError(err.id)}
              >
                <span className="font-mono text-[11px] bg-rose-100 text-rose-800 px-1 py-0.5 rounded">
                  {err.path}
                </span>
                <span>{err.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
