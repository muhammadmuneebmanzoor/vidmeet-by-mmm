import React from 'react';
import { Video, Calendar, Clock, ArrowRight, Plus, Disc, Users } from 'lucide-react';
import { Meeting, Recording } from '../../types';

interface DashboardTabProps {
  meetings: Meeting[];
  recordings?: Recording[];
  userName: string;
  onOpenCreateModal: () => void;
  onJoinDirect: (meetingId: string) => void;
  onViewMeetings: () => void;
  onShowToast: (msg: string) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  meetings,
  recordings = [],
  userName,
  onOpenCreateModal,
  onJoinDirect,
  onViewMeetings,
  onShowToast,
}) => {
  // Real upcoming meetings from PostgreSQL
  const upcomingMeetings = meetings.filter(
    (m) =>
      m.status === 'scheduled' ||
      m.date.toLowerCase().includes('today') ||
      m.date.toLowerCase().includes('now')
  );

  const recentMeetings = meetings.slice(0, 5);

  // Real statistics derived exclusively from database data (no mock numbers)
  const totalMeetings = meetings.length;
  const hostedMeetings = meetings.filter((m) => m.isHost || m.status === 'hosted').length;
  const totalPeople = meetings.reduce((sum, m) => sum + (m.participantsCount || 1), 0);
  const totalRecordings = recordings.length;

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="space-y-7 text-left">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-[var(--text)] tracking-tight font-['Bricolage_Grotesque']">
            Welcome back, {userName || 'User'}
          </h2>
          <p className="text-xs md:text-sm text-[var(--muted)] mt-1">
            {todayFormatted} · You have {meetings.length} meeting{meetings.length === 1 ? '' : 's'} recorded
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={onOpenCreateModal}
            className="px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm text-white bg-[var(--primary)] hover:bg-[var(--primary-d)] transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            <Video className="w-3.5 h-3.5" />
            <span>Create meeting</span>
          </button>

          <button
            onClick={() => onJoinDirect('')}
            className="px-4 py-2.5 rounded-xl font-semibold text-xs md:text-sm text-[var(--text)] bg-[var(--surface)] hover:bg-[var(--bg)] border border-[var(--border)] transition-all shadow-sm cursor-pointer"
          >
            Join meeting
          </button>

          <button
            onClick={onOpenCreateModal}
            className="px-4 py-2.5 rounded-xl font-semibold text-xs md:text-sm text-[var(--text)] bg-[var(--surface)] hover:bg-[var(--bg)] border border-[var(--border)] transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Schedule</span>
          </button>
        </div>
      </div>

      {/* Real Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
          <b className="text-2xl md:text-3xl font-extrabold text-[var(--text)] font-['Bricolage_Grotesque'] tabular-nums block">
            {totalMeetings}
          </b>
          <span className="text-xs text-[var(--muted)] font-medium">Total meetings</span>
        </div>

        <div className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
          <b className="text-2xl md:text-3xl font-extrabold text-[var(--text)] font-['Bricolage_Grotesque'] tabular-nums block">
            {hostedMeetings}
          </b>
          <span className="text-xs text-[var(--muted)] font-medium">Hosted by you</span>
        </div>

        <div className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
          <b className="text-2xl md:text-3xl font-extrabold text-[var(--text)] font-['Bricolage_Grotesque'] tabular-nums block">
            {totalPeople}
          </b>
          <span className="text-xs text-[var(--muted)] font-medium">Participants connected</span>
        </div>
      </div>

      {/* Upcoming Meetings Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[var(--text)] font-['Bricolage_Grotesque']">
            Upcoming & Scheduled meetings
          </h3>
          {upcomingMeetings.length > 0 && (
            <button
              onClick={onViewMeetings}
              className="text-xs font-semibold text-[var(--primary)] hover:underline cursor-pointer"
            >
              View all
            </button>
          )}
        </div>

        <div className="space-y-2.5">
          {upcomingMeetings.length > 0 ? (
            upcomingMeetings.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-3.5 md:p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-sm hover:border-[var(--primary)]/40 transition-colors"
              >
                {/* Date Box */}
                <div className="w-14 text-center bg-[var(--bg)] border border-[var(--border)] rounded-xl py-1.5 flex-shrink-0">
                  <span className="text-base font-extrabold text-[var(--text)] block leading-none">
                    {item.date.length >= 6 ? item.date.slice(4) : item.date}
                  </span>
                  <small className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
                    {item.date.slice(0, 3)}
                  </small>
                </div>

                {/* Title & Info */}
                <div className="flex-1 min-w-0">
                  <b className="text-sm font-bold text-[var(--text)] block truncate">
                    {item.title}
                  </b>
                  <small className="text-xs text-[var(--muted)] block truncate">
                    {item.time} · {item.host} · ID: <code className="font-mono text-[var(--primary)]">{item.code}</code>
                  </small>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onJoinDirect(item.code)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--primary)] text-white hover:bg-[var(--primary-d)] shadow-sm transition-all cursor-pointer"
                  >
                    Join
                  </button>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/meeting/${encodeURIComponent(item.code)}`;
                      navigator.clipboard.writeText(url);
                      onShowToast(`Copied room link: /meeting/${item.code}`);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[var(--text)] bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--bg)] transition-colors cursor-pointer hidden sm:inline"
                  >
                    Share
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[var(--muted)]">
              <div>
                <p className="font-medium text-[var(--text)]">No upcoming meetings scheduled</p>
                <p className="text-[11px] mt-0.5">Plan ahead with your team or clients with calendar sync.</p>
              </div>
              <button
                onClick={onOpenCreateModal}
                className="px-4 py-2 rounded-xl font-bold text-xs text-white bg-[var(--primary)] hover:bg-[var(--primary-d)] transition-colors cursor-pointer flex items-center gap-1.5 flex-shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Schedule a meeting</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Recent Meetings Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[var(--text)] font-['Bricolage_Grotesque']">
            Recent meetings
          </h3>
          <button
            onClick={onViewMeetings}
            className="text-xs font-semibold text-[var(--primary)] hover:underline cursor-pointer"
          >
            View all ({meetings.length})
          </button>
        </div>

        <div className="space-y-2.5">
          {recentMeetings.length > 0 ? (
            recentMeetings.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-4 p-3.5 md:p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-sm hover:border-[var(--primary)]/40 transition-colors"
              >
                {/* Date Box */}
                <div className="w-14 text-center bg-[var(--bg)] border border-[var(--border)] rounded-xl py-1.5 flex-shrink-0">
                  <span className="text-base font-extrabold text-[var(--text)] block leading-none">
                    {m.date.length >= 6 ? m.date.slice(4) : m.date}
                  </span>
                  <small className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">
                    {m.date.slice(0, 3)}
                  </small>
                </div>

                {/* Title & Info */}
                <div className="flex-1 min-w-0">
                  <b className="text-sm font-bold text-[var(--text)] block truncate">
                    {m.title}
                  </b>
                  <small className="text-xs text-[var(--muted)] block truncate">
                    {m.host} · {m.duration} · ID: <code className="font-mono text-[var(--primary)]">{m.code}</code>
                  </small>
                </div>

                {m.isRecorded && (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hidden sm:inline">
                    · Recorded
                  </span>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onJoinDirect(m.code)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-d)] transition-colors shadow-sm cursor-pointer"
                  >
                    Join
                  </button>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/meeting/${encodeURIComponent(m.code)}`;
                      navigator.clipboard.writeText(url);
                      onShowToast(`Link copied: /meeting/${m.code}`);
                    }}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-[var(--text)] bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--bg)] transition-colors hidden sm:inline cursor-pointer"
                  >
                    Share
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-center text-xs text-[var(--muted)] flex flex-col items-center justify-center gap-2">
              <p className="font-medium text-[var(--text)]">No meetings in your history yet</p>
              <p className="text-[11px]">Start an instant video room or join using a code.</p>
              <div className="flex items-center gap-2.5 mt-2">
                <button
                  onClick={onOpenCreateModal}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-d)] transition-colors cursor-pointer"
                >
                  Create first meeting
                </button>
                <button
                  onClick={() => onJoinDirect('')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text)] bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--bg)] transition-colors cursor-pointer"
                >
                  Join with ID
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
