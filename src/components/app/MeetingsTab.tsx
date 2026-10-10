import React, { useState } from 'react';
import { Search, Plus, Trash2, Share2, Lock } from 'lucide-react';
import { Meeting, MeetingFilter } from '../../types';

interface MeetingsTabProps {
  meetings: Meeting[];
  onOpenCreateModal: () => void;
  onJoinMeeting: (meetingId: string) => void;
  onDeleteMeeting?: (meetingId: string) => void;
  onShowToast: (msg: string) => void;
}

export const MeetingsTab: React.FC<MeetingsTabProps> = ({
  meetings,
  onOpenCreateModal,
  onJoinMeeting,
  onDeleteMeeting,
  onShowToast,
}) => {
  const [filter, setFilter] = useState<MeetingFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = meetings.filter((m) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'hosted' && m.status === 'hosted') ||
      (filter === 'attended' && m.status === 'attended') ||
      (filter === 'recorded' && m.isRecorded);

    const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6 text-left">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-[var(--text)] tracking-tight font-['Bricolage_Grotesque']">
          Meetings
        </h2>
        <button
          onClick={onOpenCreateModal}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-d)] transition-all shadow-sm cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New meeting</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-[var(--muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search meetings by title…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-sm focus:border-[var(--primary)] focus:outline-none transition-colors"
        />
      </div>

      {/* Segmented Filter Control */}
      <div className="flex items-center gap-1 p-1 bg-[var(--border)]/40 rounded-xl w-fit">
        {(['all', 'hosted', 'attended', 'recorded'] as MeetingFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
              filter === f
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2.5">
        {filtered.length > 0 ? (
          filtered.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-4 p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs hover:border-[var(--primary)]/40 transition-colors"
            >
              {/* Date Badge */}
              <div className="w-14 text-center bg-[var(--bg)] border border-[var(--border)] rounded-xl py-1.5 flex-shrink-0">
                <span className="text-base font-extrabold text-[var(--text)] block leading-none font-['Bricolage_Grotesque']">
                  {m.date.length >= 6 ? m.date.slice(4) : m.date}
                </span>
                <small className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mt-0.5">
                  {m.date.slice(0, 3)}
                </small>
              </div>

              {/* Title & Host info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <b className="text-sm font-bold text-[var(--text)] truncate font-['Bricolage_Grotesque']">
                    {m.title}
                  </b>
                  {m.hasPassword && (
                    <span title="Password Protected" className="p-0.5 rounded text-amber-500 bg-amber-500/10">
                      <Lock className="w-3 h-3" />
                    </span>
                  )}
                  {m.isHost && (
                    <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                      · Host
                    </span>
                  )}
                  {m.isRecorded && (
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hidden sm:inline">
                      · Recorded
                    </span>
                  )}
                </div>
                <small className="text-xs text-[var(--muted)] block truncate mt-0.5">
                  {m.host} · {m.duration} · ID: <code className="font-mono text-[var(--primary)]">{m.code}</code>
                </small>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onJoinMeeting(m.code)}
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
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-[var(--text)] bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--bg)] transition-colors cursor-pointer flex items-center gap-1"
                  title="Copy meeting URL"
                >
                  <Share2 className="w-3 h-3" />
                  <span className="hidden sm:inline">Share</span>
                </button>
                {m.isHost && onDeleteMeeting && (
                  <button
                    onClick={() => onDeleteMeeting(m.id)}
                    className="p-1.5 rounded-xl text-xs font-medium text-red-500 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-colors cursor-pointer"
                    title="Delete meeting"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="p-10 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-center">
            <p className="text-sm text-[var(--muted)]">
              No meetings match your search or filter. Try a different term.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
