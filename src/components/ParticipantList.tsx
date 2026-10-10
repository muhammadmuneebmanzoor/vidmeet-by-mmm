import React, { useState } from 'react';
import { Search, Mic, MicOff, Star, X, Users, VolumeX, UserMinus } from 'lucide-react';
import { Participant } from '../types';

export interface ParticipantListProps {
  participants: Participant[];
  isHost?: boolean;
  onClose?: () => void;
  onMuteParticipant?: (id: string, name: string) => void;
  onAllowParticipant?: (id: string, name: string) => void;
  onRemoveParticipant?: (id: string, name: string) => void;
  onMuteAll?: () => void;
  onAllowAll?: () => void;
}

export const ParticipantList: React.FC<ParticipantListProps> = ({
  participants,
  isHost = false,
  onClose,
  onMuteParticipant,
  onAllowParticipant,
  onRemoveParticipant,
  onMuteAll,
  onAllowAll,
}) => {
  const [search, setSearch] = useState('');

  const filtered = participants.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Mobile backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 md:hidden animate-in fade-in duration-200"
      />

      <div className="fixed inset-y-0 right-0 w-full sm:w-96 md:static md:w-84 lg:w-96 rounded-none md:rounded-2xl bg-[#151b30] border-l md:border border-[#252d47] flex flex-col shadow-2xl overflow-hidden h-full z-40 text-left animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-[#252d47] flex items-center justify-between bg-[#111728]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm font-['Bricolage_Grotesque']">
                Participants ({participants.length})
              </h3>
              <p className="text-[10px] text-slate-400">
                {isHost ? 'You are managing as Host' : 'Meeting attendee list'}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-[#252d47] transition-colors cursor-pointer"
              title="Close list"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Host Quick Actions Bar (ONLY shown to the verified host) */}
        {isHost && (
          <div className="px-3 py-2 bg-[#18213d] border-b border-[#252d47] flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-amber-300 flex items-center gap-1">
              <Star className="w-3 h-3 fill-current" /> Host Actions
            </span>
            <div className="flex items-center gap-1.5">
              {onMuteAll && (
                <button
                  onClick={onMuteAll}
                  className="px-2 py-1 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                  title="Mute and lock all microphones"
                >
                  <VolumeX className="w-3 h-3" />
                  <span>Mute All</span>
                </button>
              )}
              {onAllowAll && (
                <button
                  onClick={onAllowAll}
                  className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                  title="Allow all participants to unmute"
                >
                  <Mic className="w-3 h-3" />
                  <span>Allow All</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Search Input */}
        <div className="p-3 border-b border-[#252d47] bg-[#111728]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search participants…"
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#252d47] bg-[#0b1020] text-white text-xs focus:border-[var(--primary)] focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 text-xs">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No participants match "{search}"
            </div>
          ) : (
            filtered.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-[#1f2847] transition-colors group border border-transparent hover:border-[#252d47]"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: p.avatarColor || '#4f46e5' }}
                >
                  {p.name ? p.name[0].toUpperCase() : 'U'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-200 truncate">{p.name}</span>
                    {p.isLocal && (
                      <span className="text-[10px] text-slate-400 font-normal">(You)</span>
                    )}
                    {p.isHost && (
                      <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 fill-current" /> Host
                      </span>
                    )}
                  </div>
                </div>

                {/* Host Control Actions */}
                {isHost && !p.isLocal && (
                  <div className="flex items-center gap-1.5">
                    {p.isMicOn ? (
                      onMuteParticipant && (
                        <button
                          onClick={() => onMuteParticipant(p.id, p.name)}
                          aria-label={`Mute participant ${p.name}`}
                          className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-[#252d47] text-[11px] text-slate-300 hover:bg-[#323c61] hover:text-white transition-colors flex items-center gap-1 cursor-pointer focus-visible:ring-1 focus-visible:ring-indigo-400"
                          title={`Mute ${p.name}`}
                        >
                          <VolumeX className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Mute</span>
                        </button>
                      )
                    ) : (
                      onAllowParticipant && (
                        <button
                          onClick={() => onAllowParticipant(p.id, p.name)}
                          aria-label={`Allow participant ${p.name} to speak`}
                          className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-[11px] text-emerald-300 hover:bg-emerald-500/40 hover:text-white transition-colors flex items-center gap-1 cursor-pointer focus-visible:ring-1 focus-visible:ring-emerald-400"
                          title={`Allow ${p.name} to unmute & speak`}
                        >
                          <Mic className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="hidden sm:inline">Allow Mic</span>
                        </button>
                      )
                    )}
                    {onRemoveParticipant && (
                      <button
                        onClick={() => onRemoveParticipant(p.id, p.name)}
                        aria-label={`Remove participant ${p.name}`}
                        className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-red-500/20 text-[11px] text-red-300 hover:bg-red-500/40 hover:text-white transition-colors flex items-center gap-1 cursor-pointer focus-visible:ring-1 focus-visible:ring-red-400"
                        title={`Remove ${p.name}`}
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Remove</span>
                      </button>
                    )}
                  </div>
                )}

                <div className="flex-shrink-0 pl-1">
                  {p.isMicOn ? (
                    <Mic className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <MicOff className="w-3.5 h-3.5 text-red-400" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};
