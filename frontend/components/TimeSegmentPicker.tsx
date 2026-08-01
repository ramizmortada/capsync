'use client';

import React, { useRef } from 'react';

export interface TimeValue {
  hours: string;
  minutes: string;
  seconds: string;
}

interface TimeSegmentPickerProps {
  label: string;
  value: TimeValue;
  onChange: (val: TimeValue) => void;
  hasError?: boolean;
  idPrefix?: string;
  onNavigateBoundary?: (direction: 'left' | 'right') => void;
}

export default function TimeSegmentPicker({ label, value, onChange, hasError, idPrefix, onNavigateBoundary }: TimeSegmentPickerProps) {
  const hoursRef = useRef<HTMLInputElement>(null);
  const minutesRef = useRef<HTMLInputElement>(null);
  const secondsRef = useRef<HTMLInputElement>(null);

  const updateField = (field: keyof TimeValue, rawVal: string) => {
    // Keep only digits, max 2 chars
    const digitsOnly = rawVal.replace(/\D/g, '').slice(0, 2);
    let num = parseInt(digitsOnly || '0', 10);

    if (field === 'minutes' || field === 'seconds') {
      if (num > 59) num = 59;
    } else if (field === 'hours') {
      if (num > 99) num = 99;
    }

    const newStr = digitsOnly;
    const updated = { ...value, [field]: newStr };
    onChange(updated);

    // Auto-advance focus
    if (newStr.length === 2) {
      if (field === 'hours') minutesRef.current?.select();
      else if (field === 'minutes') secondsRef.current?.select();
    }
  };

  const handleBlur = (field: keyof TimeValue) => {
    const rawVal = value[field];
    if (!rawVal) {
      onChange({ ...value, [field]: '00' });
    } else {
      const padded = rawVal.padStart(2, '0');
      onChange({ ...value, [field]: padded });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, field: keyof TimeValue) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const current = parseInt(value[field] || '0', 10);
      const delta = e.key === 'ArrowUp' ? 1 : -1;
      let next = current + delta;

      const max = field === 'hours' ? 99 : 59;
      if (next < 0) next = max;
      if (next > max) next = 0;

      const formatted = next.toString().padStart(2, '0');
      onChange({ ...value, [field]: formatted });
    } else if (e.key === 'Backspace' && !value[field] && field !== 'hours') {
      if (field === 'seconds') minutesRef.current?.select();
      else if (field === 'minutes') hoursRef.current?.select();
    } else if (e.key === 'ArrowLeft') {
      if (e.currentTarget.selectionStart === 0) {
        if (field === 'seconds') {
          e.preventDefault();
          minutesRef.current?.select();
        } else if (field === 'minutes') {
          e.preventDefault();
          hoursRef.current?.select();
        } else if (field === 'hours' && onNavigateBoundary) {
          e.preventDefault();
          onNavigateBoundary('left');
        }
      }
    } else if (e.key === 'ArrowRight') {
      if (e.currentTarget.selectionEnd === e.currentTarget.value.length) {
        if (field === 'hours') {
          e.preventDefault();
          minutesRef.current?.select();
        } else if (field === 'minutes') {
          e.preventDefault();
          secondsRef.current?.select();
        } else if (field === 'seconds' && onNavigateBoundary) {
          e.preventDefault();
          onNavigateBoundary('right');
        }
      }
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-zinc-400 font-medium ml-1">{label}</label>
      <div className={`flex items-center gap-1 border rounded-lg p-1.5 text-zinc-100 font-mono text-xs w-full justify-center transition-colors ${
        hasError 
          ? 'bg-red-950/30 border-red-500/80' 
          : 'bg-zinc-900 border-zinc-800'
      }`}>
        {/* Hours */}
        <div className="flex flex-col items-center">
          <input
            id={idPrefix ? `${idPrefix}-hours` : undefined}
            ref={hoursRef}
            type="text"
            inputMode="numeric"
            value={value.hours}
            placeholder="00"
            onChange={(e) => updateField('hours', e.target.value)}
            onBlur={() => handleBlur('hours')}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => handleKeyDown(e, 'hours')}
            className="w-7 text-center bg-zinc-800 hover:bg-zinc-700/80 border border-zinc-700/60 rounded py-0.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors"
          />
          <span className="text-[8px] text-zinc-500 font-sans mt-0.5 font-semibold">HH</span>
        </div>

        <span className="text-zinc-500 font-bold pb-2.5">:</span>

        {/* Minutes */}
        <div className="flex flex-col items-center">
          <input
            id={idPrefix ? `${idPrefix}-minutes` : undefined}
            ref={minutesRef}
            type="text"
            inputMode="numeric"
            value={value.minutes}
            placeholder="00"
            onChange={(e) => updateField('minutes', e.target.value)}
            onBlur={() => handleBlur('minutes')}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => handleKeyDown(e, 'minutes')}
            className="w-7 text-center bg-zinc-800 hover:bg-zinc-700/80 border border-zinc-700/60 rounded py-0.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors"
          />
          <span className="text-[8px] text-zinc-500 font-sans mt-0.5 font-semibold">MM</span>
        </div>

        <span className="text-zinc-500 font-bold pb-2.5">:</span>

        {/* Seconds */}
        <div className="flex flex-col items-center">
          <input
            id={idPrefix ? `${idPrefix}-seconds` : undefined}
            ref={secondsRef}
            type="text"
            inputMode="numeric"
            value={value.seconds}
            placeholder="00"
            onChange={(e) => updateField('seconds', e.target.value)}
            onBlur={() => handleBlur('seconds')}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => handleKeyDown(e, 'seconds')}
            className="w-7 text-center bg-zinc-800 hover:bg-zinc-700/80 border border-zinc-700/60 rounded py-0.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors"
          />
          <span className="text-[8px] text-zinc-500 font-sans mt-0.5 font-semibold">SS</span>
        </div>
      </div>
    </div>
  );
}
