import React, { useState } from 'react';
import { Plus, Calendar as CalIcon, Users, Clock, Video, Share2 } from 'lucide-react';
import { Meeting } from '../../types';

interface CalendarTabProps {
  meetings?: Meeting[];
  onOpenCreateModal: () => void;
  onJoinMeeting: (meetingId: string) => void;
  onShowToast: (msg: string) => void;
}

export const CalendarTab: React.FC<CalendarTabProps> = ({
  meetings = [],
  onOpenCreateModal,
  onJoinMeeting,
  onShowToast,
}) => {
  const todayDate = new Date();
  const [selectedDay, setSelectedDay] = useState<number>(todayDate.getDate());

  const currentMonthName = todayDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Map real meetings from database to calendar days
  const getMeetingsForDay = (day: number) => {
    const dayStr = day.toString().padStart(2, '0');
    return meetings.filter((m) => {
      const isToday = day === todayDate.getDate() && (m.date.toLowerCase().includes('today') || m.date.toLowerCase().includes('now'));
      return isToday || m.date.includes(dayStr) || m.date.includes(` ${day}`) || m.date.endsWith(`${day}`);
    });
  };

  const selectedDayMeetings = getMeetingsForDay(selectedDay);

  return (
    <div className="space-y-6 text-left">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-[var(--text)] tracking-tight font-['Bricolage_Grotesque']">
          Calendar
        </h2>
        <button
          onClick={onOpenCreateModal}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-d)] transition-all shadow-sm cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Schedule</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Monthly Calendar Grid */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[var(--text)] font-['Bricolage_Grotesque']">
              {currentMonthName}
            </h3>
            <span className="text-xs text-[var(--muted)] font-medium">Interactive Schedule</span>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
              <span key={i} className="text-xs font-semibold text-[var(--muted)] py-1">
                {day}
              </span>
            ))}

            {/* Empty offset padding days for October 2026 */}
            <span className="p-3"></span>
            <span className="p-3"></span>
            <span className="p-3"></span>

            {/* Days 1 to 31 */}
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
              const dayMeetings = getMeetingsForDay(d);
              const hasMeeting = dayMeetings.length > 0;
              const isToday = d === todayDate.getDate();
              const isSelected = selectedDay === d;

              return (
                <button
                  key={d}
                  onClick={() => setSelectedDay(d)}
                  className={`relative py-3 rounded-xl text-xs font-semibold transition-all flex flex-col items-center justify-center cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--primary)] text-white shadow-sm'
                      : isToday
                      ? 'border border-[var(--primary)] text-[var(--primary)] font-bold'
                      : 'hover:bg-[var(--bg)] text-[var(--text)]'
                  }`}
                >
                  <span>{d}</span>
                  {hasMeeting && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full mt-1 ${
                        isSelected ? 'bg-white' : 'bg-[var(--primary)]'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Day Meeting Details */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--text)] font-['Bricolage_Grotesque']">
              Meetings on Day {selectedDay}
            </h3>
            <span className="text-xs text-[var(--muted)]">
              {selectedDayMeetings.length} scheduled
            </span>
          </div>

          <div className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm space-y-4">
            {selectedDayMeetings.length > 0 ? (
              <div className="space-y-4">
                {selectedDayMeetings.map((m) => (
                  <div key={m.id} className="space-y-3 border-b border-[var(--border)] pb-4 last:border-b-0 last:pb-0">
                    <div className="space-y-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-[var(--primary)]">
                        {m.status === 'hosted' ? 'Hosted by You' : 'Confirmed'}
                      </span>
                      <h4 className="text-lg font-bold text-[var(--text)] font-['Bricolage_Grotesque']">
                        {m.title}
                      </h4>
                    </div>

                    <div className="space-y-2 text-xs text-[var(--muted)]">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-[var(--primary)]" />
                        <span>{m.time} ({m.duration})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-[var(--primary)]" />
                        <span>{m.host}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Video className="w-3.5 h-3.5 text-[var(--primary)]" />
                        <span>Room ID: <code className="font-mono text-[var(--primary)]">{m.code}</code></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => onJoinMeeting(m.code)}
                        className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-d)] transition-colors shadow-sm cursor-pointer"
                      >
                        Join call
                      </button>
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/meeting/${encodeURIComponent(m.code)}`;
                          navigator.clipboard.writeText(url);
                          onShowToast(`Copied room link: /meeting/${m.code}`);
                        }}
                        className="p-2 rounded-xl text-[var(--muted)] hover:text-[var(--text)] bg-[var(--bg)] border border-[var(--border)] transition-colors cursor-pointer"
                        title="Copy link"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center space-y-3">
                <CalIcon className="w-10 h-10 text-[var(--muted)] mx-auto stroke-1" />
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-[var(--text)]">No meetings on this day</h4>
                  <p className="text-xs text-[var(--muted)] max-w-xs mx-auto">
                    You have no scheduled calls on this date. Click below to schedule a session.
                  </p>
                </div>
                <button
                  onClick={onOpenCreateModal}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-d)] transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Schedule meeting</span>
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
