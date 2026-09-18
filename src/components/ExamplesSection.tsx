import React from 'react';
import { Sparkles } from 'lucide-react';

interface ExamplesSectionProps {
  onSelectExample: (exampleText: string, suggestedName: string) => void;
  disabled?: boolean;
}

const EXAMPLES = [
  {
    id: 'ex-1',
    title: 'Intervals (5 x 1 km)',
    text: '10 min easy warm-up, 5 x 1 km with 2 min easy recovery, 10 min cool-down',
    name: '',
  },
  {
    id: 'ex-2',
    title: 'Tempo Run (25 min)',
    text: '15 min easy + 25 min tempo + 10 min easy',
    name: '',
  },
  {
    id: 'ex-3',
    title: 'Tempo Run (6 km Threshold)',
    text: '2 km warm up + 6 km threshold + 2 km cool down',
    name: '',
  },
  {
    id: 'ex-4',
    title: 'Sunday Long Run',
    text: 'Sunday long run: 20 km easy at conversational pace',
    name: '',
  },
  {
    id: 'ex-5',
    title: 'Easy Run (8 km)',
    text: '8 km easy conversational pace',
    name: '',
  },
];

export const ExamplesSection: React.FC<ExamplesSectionProps> = ({ onSelectExample, disabled }) => {
  return (
    <div id="examples-section" className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-5 shadow-2xs">
      <div className="flex items-center gap-2 mb-2.5 text-xs font-semibold tracking-wider text-neutral-500 uppercase">
        <Sparkles className="w-3.5 h-3.5 text-neutral-400" />
        <span>Examples</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.id}
            id={`example-btn-${ex.id}`}
            type="button"
            disabled={disabled}
            onClick={() => onSelectExample(ex.text, ex.name)}
            className="text-left p-2.5 rounded-lg border border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
          >
            <div className="text-xs font-semibold text-neutral-900 group-hover:text-red-700 transition-colors">
              {ex.title}
            </div>
            <div className="text-[11px] text-neutral-500 line-clamp-2 mt-1 leading-relaxed">
              "{ex.text}"
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
