import React, { useState } from 'react';
import { Code, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { Workout } from '../types/workout';
import { createPolarExport } from '../utils/polarExport';

interface JsonViewerProps {
  workout: Workout;
  isOpen?: boolean;
  onToggle?: () => void;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({
  workout,
  isOpen: controlledIsOpen,
  onToggle: controlledOnToggle,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const toggleOpen = controlledOnToggle || (() => setInternalIsOpen(!internalIsOpen));
  const [copied, setCopied] = useState(false);

  // Canonical PolarExport JSON containing schemaVersion, source, and workout with startTime: "08:00"
  const cleanJson = JSON.stringify(createPolarExport(workout), null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleanJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy JSON:', e);
    }
  };

  return (
    <div id="json-viewer-container" className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
      {/* Header bar with toggle switch and copy button */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 border-b border-neutral-200">
        <div className="flex items-center gap-2">
          <Code className="w-4 h-4 text-neutral-600" />
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">
            Raw Workout JSON
          </span>
          <span className="text-[11px] text-neutral-400 font-mono">
            (Polar Phased Target schema)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            id="toggle-json-btn"
            onClick={toggleOpen}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-200 rounded-md transition-colors cursor-pointer"
          >
            {isOpen ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Hide JSON</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Show JSON</span>
              </>
            )}
          </button>

          {isOpen && (
            <button
              type="button"
              id="copy-json-btn"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:text-neutral-900 bg-white border border-neutral-200 hover:border-neutral-300 rounded-md transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Collapsible JSON Body */}
      {isOpen && (
        <div className="relative p-4 bg-neutral-900 text-neutral-100 font-mono text-xs overflow-x-auto max-h-96">
          <pre className="leading-relaxed whitespace-pre font-mono">
            {cleanJson}
          </pre>
        </div>
      )}
    </div>
  );
};
