import React, { useState } from 'react';
import { X, Calendar, Clock, Lock } from 'lucide-react';
import { Meeting } from '../types';

export interface CreateMeetingInput {
  title: string;
  password?: string;
  isScheduled: boolean;
  scheduledDate?: string;
  scheduledTime?: string;
  duration?: string;
  isInstant: boolean;
}

interface CreateMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (input: CreateMeetingInput) => Promise<void> | void;
  onShowToast: (msg: string) => void;
}

export const CreateMeetingModal: React.FC<CreateMeetingModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  onShowToast,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [title, setTitle] = useState('');
  const [password, setPassword] = useState('');
  const [meetingType, setMeetingType] = useState<'instant' | 'scheduled'>('instant');
  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState('30 min');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      onShowToast('Please enter a meeting title');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate({
        title: title.trim(),
        password: password.trim() || undefined,
        isScheduled: meetingType === 'scheduled',
        scheduledDate: date,
        scheduledTime: time,
        duration,
        isInstant: meetingType === 'instant',
      });
      onClose();
    } catch (err: any) {
      onShowToast(err?.message || 'Failed to create meeting');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 md:p-7 shadow-2xl space-y-5 text-left text-[var(--text)]">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold font-['Bricolage_Grotesque'] text-[var(--text)]">
            Create meeting
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--bg)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text)]">Meeting title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly Team Standup"
              className="w-full px-3.5 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:border-[var(--primary)] focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text)] flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-[var(--muted)]" />
              <span>Meeting password (optional)</span>
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank for open access or enter passcode"
              className="w-full px-3.5 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:border-[var(--primary)] focus:outline-none font-mono"
            />
          </div>

          {/* Type Segment Picker */}
          <div className="inline-flex p-1 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
            <button
              type="button"
              onClick={() => setMeetingType('instant')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                meetingType === 'instant'
                  ? 'bg-[var(--primary)] text-white shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              Instant
            </button>
            <button
              type="button"
              onClick={() => setMeetingType('scheduled')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                meetingType === 'scheduled'
                  ? 'bg-[var(--primary)] text-white shadow-sm'
                  : 'text-[var(--muted)] hover:text-[var(--text)]'
              }`}
            >
              Scheduled
            </button>
          </div>

          {/* Scheduled specifics */}
          {meetingType === 'scheduled' && (
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[var(--muted)]">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[var(--muted)]">Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[var(--muted)]">Length</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text)]"
                >
                  <option value="15 min">15 min</option>
                  <option value="30 min">30 min</option>
                  <option value="45 min">45 min</option>
                  <option value="60 min">60 min</option>
                </select>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text)] hover:bg-[var(--bg)] border border-[var(--border)] transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-d)] transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting && (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              <span>
                {isSubmitting
                  ? 'Saving to database...'
                  : meetingType === 'instant'
                  ? 'Start meeting'
                  : 'Schedule meeting'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
