import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, Video, VideoOff, Monitor, MessageSquare, 
  Users, MoreVertical, PhoneOff, Shield, Smile, Lock, Unlock,
  VolumeX, VideoIcon
} from 'lucide-react';

export interface MeetingControlsProps {
  isMicOn: boolean;
  isCamOn: boolean;
  isSharing: boolean;
  activePanel: 'chat' | 'participants' | null;
  unreadChatCount?: number;
  participantsCount?: number;
  isHost?: boolean;
  isLocked?: boolean;
  isMicLockedByHost?: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleShare: () => void;
  onTogglePanel: (panel: 'chat' | 'participants') => void;
  onLeave: () => void;
  onSendReaction?: (emoji: string) => void;
  onHostAction?: (action: string) => void;
}

export const MeetingControls: React.FC<MeetingControlsProps> = ({
  isMicOn,
  isCamOn,
  isSharing,
  activePanel,
  unreadChatCount = 0,
  participantsCount = 1,
  isHost = false,
  isLocked = false,
  isMicLockedByHost = false,
  onToggleMic,
  onToggleCam,
  onToggleShare,
  onTogglePanel,
  onLeave,
  onSendReaction,
  onHostAction,
}) => {
  const [showHostMenu, setShowHostMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const hostMenuRef = useRef<HTMLDivElement | null>(null);
  const reactionsMenuRef = useRef<HTMLDivElement | null>(null);

  const emojis = ['❤️', '👏', '🎉', '👍', '🔥', '💡'];

  // Handle click outside to close menus
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (hostMenuRef.current && !hostMenuRef.current.contains(e.target as Node)) {
        setShowHostMenu(false);
      }
      if (reactionsMenuRef.current && !reactionsMenuRef.current.contains(e.target as Node)) {
        setShowReactions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="px-3 sm:px-6 py-2.5 sm:py-3 border-t border-[#252d47] bg-[#0b1020]/95 backdrop-blur-md flex items-center justify-between z-20 relative select-none">
      
      {/* Reactions Menu */}
      <div className="flex items-center gap-1.5 relative" ref={reactionsMenuRef}>
        <button
          onClick={() => setShowReactions(!showReactions)}
          aria-label="Send emoji reaction"
          aria-expanded={showReactions}
          className="min-h-[44px] px-2.5 sm:px-3 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-[#151b30] transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500"
          title="Send Reaction"
        >
          <Smile className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="text-[11px] hidden sm:inline">React</span>
        </button>

        {showReactions && (
          <div 
            role="menu"
            aria-label="Emoji reactions"
            className="absolute bottom-14 left-0 bg-[#151b30] border border-[#252d47] rounded-xl shadow-2xl p-2 flex items-center gap-1.5 z-30 animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            {emojis.map((emoji) => (
              <button
                key={emoji}
                role="menuitem"
                onClick={() => {
                  onSendReaction?.(emoji);
                  setShowReactions(false);
                }}
                className="w-9 h-9 flex items-center justify-center hover:bg-[#252d47] rounded-lg text-lg transition-transform hover:scale-125 cursor-pointer active:scale-95"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Primary Conference Control Buttons */}
      <div className="flex items-center gap-1.5 sm:gap-3 mx-auto">
        {/* Mute Mic */}
        <button
          onClick={onToggleMic}
          aria-label={isMicLockedByHost && !isHost ? 'Microphone locked by host' : isMicOn ? 'Mute microphone' : 'Unmute microphone'}
          aria-pressed={!isMicOn}
          className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-0.5 sm:gap-1 text-[11px] font-medium text-slate-300 hover:text-white px-1 sm:px-2 py-1 rounded-xl hover:bg-[#151b30] transition-colors cursor-pointer"
        >
          <span
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all shadow-md relative ${
              isMicLockedByHost && !isHost
                ? 'bg-amber-600/80 text-white border border-amber-400'
                : isMicOn
                ? 'bg-[#252d47] hover:bg-[#323c61]'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isMicOn ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5 text-white" />}
            {isMicLockedByHost && !isHost && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 p-0.5 rounded-full shadow-xs" title="Locked by host">
                <Lock className="w-3 h-3 stroke-[2.5]" />
              </span>
            )}
          </span>
          <span className="hidden md:inline">
            {isMicLockedByHost && !isHost ? 'Locked' : isMicOn ? 'Mute' : 'Unmute'}
          </span>
        </button>

        {/* Camera On / Off */}
        <button
          onClick={onToggleCam}
          aria-label={isCamOn ? 'Stop video camera' : 'Start video camera'}
          aria-pressed={isCamOn}
          className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-0.5 sm:gap-1 text-[11px] font-medium text-slate-300 hover:text-white px-1 sm:px-2 py-1 rounded-xl hover:bg-[#151b30] transition-colors cursor-pointer"
        >
          <span
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all shadow-md ${
              isCamOn ? 'bg-[#252d47] hover:bg-[#323c61]' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isCamOn ? <Video className="w-5 h-5 text-white" /> : <VideoOff className="w-5 h-5 text-white" />}
          </span>
          <span className="hidden md:inline">{isCamOn ? 'Camera' : 'Start'}</span>
        </button>

        {/* Screen Share */}
        <button
          onClick={onToggleShare}
          aria-label={isSharing ? 'Stop screen sharing' : 'Share screen'}
          aria-pressed={isSharing}
          className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-0.5 sm:gap-1 text-[11px] font-medium text-slate-300 hover:text-white px-1 sm:px-2 py-1 rounded-xl hover:bg-[#151b30] transition-colors cursor-pointer"
        >
          <span
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all shadow-md ${
              isSharing ? 'bg-[var(--primary)] text-white' : 'bg-[#252d47] hover:bg-[#323c61] text-white'
            }`}
          >
            <Monitor className="w-5 h-5" />
          </span>
          <span className="hidden md:inline">Share</span>
        </button>

        {/* Chat Toggle */}
        <button
          onClick={() => onTogglePanel('chat')}
          aria-label={`Open meeting chat, ${unreadChatCount} unread`}
          aria-pressed={activePanel === 'chat'}
          className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-0.5 sm:gap-1 text-[11px] font-medium text-slate-300 hover:text-white px-1 sm:px-2 py-1 rounded-xl hover:bg-[#151b30] transition-colors relative cursor-pointer"
        >
          <span
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all shadow-md relative ${
              activePanel === 'chat'
                ? 'bg-[var(--primary)] text-white'
                : 'bg-[#252d47] hover:bg-[#323c61] text-white'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            {unreadChatCount > 0 && activePanel !== 'chat' && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center border-2 border-[#0b1020]">
                {unreadChatCount}
              </span>
            )}
          </span>
          <span className="hidden md:inline">Chat</span>
        </button>

        {/* Participants Toggle */}
        <button
          onClick={() => onTogglePanel('participants')}
          aria-label={`View participants (${participantsCount})`}
          aria-pressed={activePanel === 'participants'}
          className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-0.5 sm:gap-1 text-[11px] font-medium text-slate-300 hover:text-white px-1 sm:px-2 py-1 rounded-xl hover:bg-[#151b30] transition-colors relative cursor-pointer"
        >
          <span
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all shadow-md ${
              activePanel === 'participants'
                ? 'bg-[var(--primary)] text-white'
                : 'bg-[#252d47] hover:bg-[#323c61] text-white'
            }`}
          >
            <Users className="w-5 h-5" />
          </span>
          <span className="hidden md:inline">People</span>
        </button>

        {/* Host controls dropdown: ONLY shown to the meeting host */}
        {isHost && (
          <div className="relative" ref={hostMenuRef}>
            <button
              onClick={() => setShowHostMenu(!showHostMenu)}
              aria-label="Host controls"
              aria-expanded={showHostMenu}
              className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-0.5 sm:gap-1 text-[11px] font-medium text-slate-300 hover:text-white px-1 sm:px-2 py-1 rounded-xl hover:bg-[#151b30] transition-colors cursor-pointer"
            >
              <span className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 flex items-center justify-center border border-amber-500/30 shadow-md">
                <Shield className="w-5 h-5" />
              </span>
              <span className="hidden md:inline">Host</span>
            </button>

            {showHostMenu && (
              <div 
                role="menu"
                aria-label="Host actions menu"
                className="absolute bottom-16 left-1/2 -translate-x-1/2 w-64 bg-[#151b30] border border-[#252d47] rounded-2xl shadow-2xl p-2 z-40 text-xs text-left space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-150"
              >
                <div className="px-3 py-1.5 font-bold text-amber-400 text-[10px] uppercase tracking-wider border-b border-[#252d47] flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Host Controls</span>
                </div>

                <button
                  role="menuitem"
                  onClick={() => {
                    setShowHostMenu(false);
                    onTogglePanel('participants');
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#252d47] text-slate-200 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Users className="w-4 h-4 text-indigo-400" />
                  <span>Manage Participants (Mute/Kick)</span>
                </button>

                <button
                  role="menuitem"
                  onClick={() => {
                    setShowHostMenu(false);
                    onHostAction?.('mute-all');
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#252d47] text-slate-200 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <VolumeX className="w-4 h-4 text-red-400" />
                  <span>Mute & lock everyone</span>
                </button>

                <button
                  role="menuitem"
                  onClick={() => {
                    setShowHostMenu(false);
                    onHostAction?.('allow-all-mic');
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#252d47] text-emerald-300 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Mic className="w-4 h-4 text-emerald-400" />
                  <span>Allow all to unmute</span>
                </button>

                <button
                  role="menuitem"
                  onClick={() => {
                    setShowHostMenu(false);
                    onLeave();
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#252d47] text-slate-300 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4 text-slate-400" />
                  <span>Leave (keep meeting open)</span>
                </button>

                <button
                  role="menuitem"
                  onClick={() => {
                    setShowHostMenu(false);
                    onHostAction?.('end-meeting-all');
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-red-500/20 text-red-400 font-semibold transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>End meeting for all</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Leave Meeting Button */}
        <button
          onClick={onLeave}
          aria-label="Leave meeting"
          className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 sm:gap-1 text-[11px] font-medium text-red-300 hover:text-red-100 px-1.5 sm:px-2 py-1 rounded-xl hover:bg-[#151b30] transition-colors ml-1 sm:ml-2 cursor-pointer"
        >
          <span className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 flex items-center justify-center text-white shadow-lg transition-all">
            <PhoneOff className="w-5 h-5" />
          </span>
          <span className="hidden md:inline">Leave</span>
        </button>
      </div>

      <div className="w-10 sm:w-16" />
    </div>
  );
};

