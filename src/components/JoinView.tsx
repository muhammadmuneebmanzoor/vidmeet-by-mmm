import React, { useState } from 'react';
import { Video, ArrowLeft, Hash, User, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  isSupabaseConfigured, 
  getMeetingDirectFromSupabase, 
  getLocalStoredMeetings, 
  normalizeRoomId 
} from '../lib/supabase';

interface JoinViewProps {
  onJoin: (meetingId: string, name: string) => void;
  onNavigate: (view: 'landing' | 'app') => void;
}

export const JoinView: React.FC<JoinViewProps> = ({ onJoin, onNavigate }) => {
  const { user, profile, session } = useAuth();

  const [meetingId, setMeetingId] = useState('');
  const [name, setName] = useState(profile?.name || user?.user_metadata?.name || '');
  const [password, setPassword] = useState('');
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [verifiedMeetingTitle, setVerifiedMeetingTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // Resume AudioContext on user interaction gesture for mobile devices
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        if (!(window as any).__vidmeetGlobalAudioCtx) {
          (window as any).__vidmeetGlobalAudioCtx = new AudioCtxClass();
        }
        const primeCtx = (window as any).__vidmeetGlobalAudioCtx;
        if (primeCtx.state === 'suspended') {
          primeCtx.resume().catch(() => {});
        }
      }
    } catch {}

    if (!meetingId.trim()) {
      setErrorMessage('Please enter a meeting ID or room code');
      return;
    }

    if (!name.trim()) {
      setErrorMessage('Please enter your display name to appear on your video box');
      return;
    }

    const cleanCode = meetingId.trim().replace(/^https?:\/\/.*\/meeting\//, '');
    setIsVerifying(true);

    // Resume AudioContext on mobile user interaction
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        if (!(window as any).__vidmeetGlobalAudioCtx) {
          (window as any).__vidmeetGlobalAudioCtx = new AudioCtxClass();
        }
        const primeCtx = (window as any).__vidmeetGlobalAudioCtx;
        if (primeCtx.state === 'suspended') {
          primeCtx.resume().catch(() => {});
        }
      }
    } catch {}

    try {
      let meetingInfo: any = null;

      // 1. Try verifying via server API
      try {
        const verifyRes = await fetch(`/api/meetings/verify/${encodeURIComponent(cleanCode)}`);
        const contentType = verifyRes.headers.get('content-type') || '';
        if (verifyRes.ok && contentType.includes('application/json')) {
          meetingInfo = await verifyRes.json();
        }
      } catch (err) {
        console.warn('API verify notice:', err);
      }

      // 2. Direct Supabase verification (for Vercel deployment)
      if (!meetingInfo && isSupabaseConfigured) {
        try {
          const dbMeeting = await getMeetingDirectFromSupabase(cleanCode);
          if (dbMeeting) {
            meetingInfo = {
              id: dbMeeting.id,
              title: dbMeeting.title || 'Video Meeting',
              roomId: dbMeeting.room_id || cleanCode,
              hasPassword: Boolean(dbMeeting.password_hash),
              hostId: dbMeeting.host_id,
            };
          }
        } catch (sbErr) {
          console.warn('Supabase direct verify in JoinView notice:', sbErr);
        }
      }

      // 3. Local meetings cache verification
      if (!meetingInfo) {
        const localList = getLocalStoredMeetings();
        const norm = normalizeRoomId(cleanCode);
        const match = localList.find((m) => m.code === cleanCode || m.code === norm || m.id === cleanCode);
        if (match) {
          meetingInfo = {
            id: match.id,
            title: match.title || 'Video Meeting',
            roomId: match.code || cleanCode,
            hasPassword: Boolean(match.hasPassword),
            hostId: match.isHost ? user?.id : undefined,
          };
        }
      }

      // If room ID looks valid, allow joining
      if (!meetingInfo && normalizeRoomId(cleanCode)) {
        meetingInfo = {
          id: cleanCode,
          title: `Room: ${cleanCode}`,
          roomId: cleanCode,
          hasPassword: false,
          hostId: undefined,
        };
      }

      if (!meetingInfo) {
        setErrorMessage('Meeting not found. Please verify the room ID and try again.');
        setIsVerifying(false);
        return;
      }

      setVerifiedMeetingTitle(meetingInfo.title || 'Video Meeting');

      // Check if password required
      if (meetingInfo.hasPassword && meetingInfo.hostId !== user?.id && !password) {
        setRequiresPassword(true);
        setErrorMessage('This meeting requires a password to enter.');
        setIsVerifying(false);
        return;
      }

      // 2. Perform join verification with password if required
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const joinRes = await fetch(`/api/meetings/join/${encodeURIComponent(cleanCode)}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            displayName: name.trim() || 'Guest',
            password: password.trim() || undefined,
          }),
        });

        const contentType = joinRes.headers.get('content-type') || '';
        if (joinRes.ok && contentType.includes('application/json')) {
          // Joined via server API successfully
        } else if (joinRes.status === 401 || joinRes.status === 403) {
          const joinErr = await joinRes.json().catch(() => ({}));
          setErrorMessage(joinErr.error || 'Failed to join meeting.');
          if (joinErr.requiresPassword) {
            setRequiresPassword(true);
          }
          setIsVerifying(false);
          return;
        }
      } catch (joinApiErr) {
        console.warn('API join unavailable on current deployment, continuing directly:', joinApiErr);
      }

      // Meeting and password verified! Proceed to lobby
      onJoin(cleanCode, name.trim() || 'Guest');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error communicating with server.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg)] text-[var(--text)] transition-colors">
      <div className="w-full max-w-md p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xl space-y-6 text-left">
        
        {/* Top Logo */}
        <div className="flex items-center justify-between">
          <div 
            onClick={() => onNavigate('landing')}
            className="flex items-center gap-2.5 font-extrabold text-xl cursor-pointer select-none font-['Bricolage_Grotesque']"
          >
            <img
              src="/logo.png"
              alt="VidMeet MMM Logo"
              className="w-9 h-9 object-contain rounded-lg shadow-sm bg-white p-0.5 border border-[var(--border)]"
              referrerPolicy="no-referrer"
            />
            <div className="flex flex-col leading-none">
              <span className="text-[var(--text)] font-extrabold text-lg">VidMeet</span>
              <small className="text-[11px] font-medium text-[var(--muted)]">by MMM</small>
            </div>
          </div>

          <button
            onClick={() => onNavigate('landing')}
            className="text-xs text-[var(--muted)] hover:text-[var(--text)] flex items-center gap-1 font-medium transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-extrabold text-[var(--text)] font-['Bricolage_Grotesque']">
            Join a meeting
          </h2>
          <p className="text-xs text-[var(--muted)]">
            Enter the unique meeting room ID or code to verify and enter.
          </p>
        </div>

        {/* Server Validation Feedback */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500 flex items-start gap-2 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {verifiedMeetingTitle && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>Meeting found: <strong>{verifiedMeetingTitle}</strong></span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-[var(--primary)]" />
              <span>Meeting room ID</span>
            </label>
            <input
              type="text"
              required
              value={meetingId}
              onChange={(e) => {
                setMeetingId(e.target.value);
                setErrorMessage('');
                setVerifiedMeetingTitle('');
              }}
              placeholder="Enter meeting room ID (e.g. 492-817-305)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] focus:border-[var(--primary)] focus:outline-none transition-colors text-sm font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text)] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[var(--primary)]" />
                <span>Your display name <span className="text-red-500">*</span></span>
              </span>
              <span className="text-[11px] text-[var(--muted)] font-normal">Visible to others</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter the name to be displayed on your video box"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] focus:border-[var(--primary)] focus:outline-none transition-colors text-sm"
            />
            <p className="text-[11px] text-[var(--muted)]">
              This name will be displayed on your video tile and appear to all other participants.
            </p>
          </div>

          {/* Password field revealed if meeting has a password or requested */}
          {requiresPassword && (
            <div className="space-y-1.5 animate-in fade-in duration-200">
              <label className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                <span>Meeting password</span>
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMessage('');
                }}
                placeholder="Enter room password"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] focus:border-[var(--primary)] focus:outline-none transition-colors text-sm font-mono"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isVerifying}
            className="w-full py-3 rounded-xl font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-d)] transition-all shadow-md shadow-indigo-500/20 text-sm mt-2 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            {isVerifying ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Verifying meeting...</span>
              </>
            ) : (
              <span>{requiresPassword ? 'Verify & join' : 'Join meeting'}</span>
            )}
          </button>
        </form>

        <div className="text-center pt-2">
          <button
            onClick={() => onNavigate('app')}
            className="text-xs font-semibold text-[var(--primary)] hover:underline cursor-pointer"
          >
            Go to My Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
