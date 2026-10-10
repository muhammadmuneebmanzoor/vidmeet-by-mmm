import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, Sparkles, ArrowLeft, Lock, AlertCircle, ShieldAlert, FlipHorizontal } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  isSupabaseConfigured, 
  getMeetingDirectFromSupabase, 
  getLocalStoredMeetings, 
  normalizeRoomId 
} from '../lib/supabase';

interface WaitingRoomProps {
  initialName: string;
  initialMeetingId: string;
  onJoinMeeting: (params: {
    name: string;
    isMicOn: boolean;
    isCamOn: boolean;
    meetingId: string;
    meetingDbId?: string;
    meetingTitle?: string;
    isHost?: boolean;
    isLocked?: boolean;
    password?: string;
  }) => void;
  onCancel: () => void;
  onShowToast: (msg: string) => void;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({
  initialName,
  initialMeetingId,
  onJoinMeeting,
  onCancel,
  onShowToast,
}) => {
  const { user, session } = useAuth();

  const [name, setName] = useState(initialName || user?.user_metadata?.name || '');
  const [password, setPassword] = useState('');
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isMirrored, setIsMirrored] = useState(true); // Default: mirrored
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  // Server Verification State
  const [meetingDetails, setMeetingDetails] = useState<{
    exists?: boolean;
    id?: string;
    roomId?: string;
    title: string;
    hasPassword: boolean;
    isLocked: boolean;
    hostId?: string;
    isWaitingRoomEnabled?: boolean;
  } | null>(null);
  const [isCheckingMeeting, setIsCheckingMeeting] = useState(true);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 1. Verify meeting existence on server
  useEffect(() => {
    let active = true;

    async function verifyMeeting() {
      setIsCheckingMeeting(true);
      setVerificationError(null);

      // Check 1: Server API verify
      try {
        const res = await fetch(`/api/meetings/verify/${encodeURIComponent(initialMeetingId)}`);
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (active) {
            setMeetingDetails(data);
            setIsCheckingMeeting(false);
            return;
          }
        }
      } catch (err: any) {
        console.warn('Server verify check notice:', err);
      }

      // Check 2: Direct Supabase database query (for Vercel deployment)
      if (isSupabaseConfigured) {
        try {
          const dbMeeting = await getMeetingDirectFromSupabase(initialMeetingId);
          if (dbMeeting && active) {
            setMeetingDetails({
              id: dbMeeting.id,
              title: dbMeeting.title || 'Video Meeting',
              roomId: dbMeeting.room_id || initialMeetingId,
              hasPassword: Boolean(dbMeeting.password_hash),
              isLocked: Boolean(dbMeeting.is_locked),
              isWaitingRoomEnabled: dbMeeting.is_waiting_room_enabled !== false,
              hostId: dbMeeting.host_id,
            });
            setIsCheckingMeeting(false);
            return;
          }
        } catch (sbErr) {
          console.warn('Supabase direct verify check notice:', sbErr);
        }
      }

      // Check 3: Check local meetings cache
      const localList = getLocalStoredMeetings();
      const norm = normalizeRoomId(initialMeetingId);
      const localMatch = localList.find((m) => m.code === initialMeetingId || m.code === norm || m.id === initialMeetingId);
      if (localMatch && active) {
        setMeetingDetails({
          id: localMatch.id,
          title: localMatch.title || 'Video Meeting',
          roomId: localMatch.code || initialMeetingId,
          hasPassword: Boolean(localMatch.hasPassword),
          isLocked: Boolean(localMatch.isLocked),
          isWaitingRoomEnabled: true,
          hostId: localMatch.isHost ? user?.id : undefined,
        });
        setIsCheckingMeeting(false);
        return;
      }

      // Check 4: Check if current user is the creator (sessionStorage)
      const isCreator = sessionStorage.getItem(`vidmeet_creator_${initialMeetingId}`) === 'true' ||
                        sessionStorage.getItem(`vidmeet_creator_${norm}`) === 'true';
      if (isCreator && active) {
        setMeetingDetails({
          id: initialMeetingId,
          title: `Room: ${initialMeetingId}`,
          roomId: initialMeetingId,
          hasPassword: false,
          isLocked: false,
          isWaitingRoomEnabled: true,
          hostId: user?.id,
        });
        setIsCheckingMeeting(false);
        return;
      }

      // Check 5: If room ID has a valid code structure, allow entering room lobby gracefully
      if (norm && active) {
        setMeetingDetails({
          id: initialMeetingId,
          title: `Room: ${initialMeetingId}`,
          roomId: initialMeetingId,
          hasPassword: false,
          isLocked: false,
          isWaitingRoomEnabled: true,
          hostId: undefined,
        });
        setIsCheckingMeeting(false);
        return;
      }

      if (active) {
        setVerificationError('Meeting not found. Please check the meeting code.');
        setIsCheckingMeeting(false);
      }
    }

    verifyMeeting();

    return () => {
      active = false;
    };
  }, [initialMeetingId]);

  // 2. Request real camera stream if available in browser
  useEffect(() => {
    let active = true;

    async function setupCamera() {
      if (!isCamOn) {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        return;
      }

      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          let stream: MediaStream | null = null;
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 1280 }, height: { ideal: 720 } },
              audio: false,
            });
          } catch {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          }

          if (!active) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }

          streamRef.current = stream;
          setHasCameraPermission(true);

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        }
      } catch (err: any) {
        console.warn('Camera preview not available or permission denied:', err);
        setHasCameraPermission(false);
      }
    }

    setupCamera();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isCamOn]);

  // Keep video element synchronized with active stream
  useEffect(() => {
    if (videoRef.current && streamRef.current && isCamOn && hasCameraPermission) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [hasCameraPermission, isCamOn]);

  // 3. Audio Activity Level Detection (Live Web Audio API)
  useEffect(() => {
    let active = true;

    async function setupAudioMeter() {
      if (!isMicOn) {
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((t) => t.stop());
          audioStreamRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
        setAudioLevel(0);
        return;
      }

      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

          if (!active) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }

          audioStreamRef.current = stream;
          setHasMicPermission(true);

          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioContextClass();
          audioContextRef.current = ctx;

          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const checkLevel = () => {
            if (!active) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            animFrameRef.current = requestAnimationFrame(checkLevel);
          };

          checkLevel();
        }
      } catch (err) {
        console.warn('Microphone access denied or unavailable in lobby:', err);
        setHasMicPermission(false);
      }
    }

    setupAudioMeter();

    return () => {
      active = false;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [isMicOn]);

  const toggleMic = () => {
    setIsMicOn((prev) => {
      const next = !prev;
      onShowToast(next ? 'Microphone on' : 'Microphone muted');
      return next;
    });
  };

  const toggleCam = () => {
    setIsCamOn((prev) => {
      const next = !prev;
      onShowToast(next ? 'Camera on' : 'Camera turned off');
      return next;
    });
  };

  const isCreator = sessionStorage.getItem(`vidmeet_creator_${initialMeetingId}`) === 'true';
  const isUserHost = Boolean(
    isCreator ||
    (user && meetingDetails && meetingDetails.hostId && meetingDetails.hostId !== 'host-auto' && meetingDetails.hostId === user.id)
  );

  const handleJoin = async () => {
    // Prime and resume Web Audio AudioContext on user interaction gesture for mobile iOS/Android
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

    setVerificationError(null);

    if (!name.trim()) {
      setVerificationError('Please enter your display name to appear on your video box.');
      return;
    }

    setIsJoining(true);

    try {
      const headers: Record<string, string> = { 
        'Content-Type': 'application/json',
        ...(isUserHost ? { 'x-is-host': 'true' } : {}),
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      let joinData: any = null;
      try {
        const res = await fetch(`/api/meetings/join/${encodeURIComponent(initialMeetingId)}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            displayName: name.trim() || 'Guest',
            password: password.trim() || undefined,
            isHostClaim: isUserHost,
          }),
        });

        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          joinData = await res.json();
        } else if (res.status === 401 || res.status === 403) {
          const errData = await res.json().catch(() => ({}));
          setVerificationError(errData.error || 'Password incorrect or entry denied.');
          setIsJoining(false);
          return;
        }
      } catch (apiErr) {
        console.warn('API join unavailable on current deployment, proceeding directly:', apiErr);
      }

      const finalIsHost = Boolean(joinData?.isHost || isUserHost);

      // Release preview media streams before entering LiveKit meeting
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }

      onJoinMeeting({
        name: name.trim() || 'Guest',
        isMicOn,
        isCamOn,
        meetingId: initialMeetingId,
        meetingDbId: joinData?.meetingId || meetingDetails?.id,
        meetingTitle: joinData?.title || meetingDetails?.title || 'Video Meeting',
        isHost: finalIsHost,
        isLocked: meetingDetails?.isLocked ?? false,
        password: password.trim() || undefined,
      });
    } catch (err: any) {
      if (isMountedRef.current) setVerificationError(err.message || 'Connection error.');
    } finally {
      if (isMountedRef.current) {
        setIsJoining(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1020] text-[#e8ecf8] flex items-center justify-center p-6 md:p-12">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        
        {/* Left: Video Preview & Device Pre-checks */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="w-full aspect-[16/10] rounded-2xl bg-gradient-to-br from-[#1e2a55] to-[#3b3f9e] relative overflow-hidden flex items-center justify-center shadow-2xl border border-[#252d47]">
            
            {/* Real Video Element */}
            {isCamOn && hasCameraPermission ? (
              <video
                ref={(el) => {
                  videoRef.current = el;
                  if (el && streamRef.current && el.srcObject !== streamRef.current) {
                    el.srcObject = streamRef.current;
                    el.play().catch(() => {});
                  }
                }}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transition-all"
                style={{
                  transform: isMirrored ? 'scaleX(-1)' : 'none',
                }}
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-[var(--primary)] flex items-center justify-center text-4xl font-extrabold text-white shadow-xl border-4 border-white/20 select-none">
                {name ? name[0].toUpperCase() : 'U'}
              </div>
            )}

            {/* Name & Audio Level Badge */}
            <div className="absolute left-3.5 bottom-3.5 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-semibold text-white flex items-center gap-2 border border-white/10">
              <span>{name || 'Guest'}</span>
              {isMicOn ? (
                <div className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full transition-colors ${audioLevel > 15 ? 'bg-emerald-400 scale-125' : 'bg-emerald-500'}`} />
                  {audioLevel > 10 && (
                    <div className="flex items-end gap-0.5 h-3">
                      <span className="w-0.5 bg-emerald-400 rounded-full animate-pulse" style={{ height: `${Math.min(100, Math.max(30, audioLevel))}%` }} />
                      <span className="w-0.5 bg-emerald-400 rounded-full animate-pulse" style={{ height: `${Math.min(100, Math.max(50, audioLevel * 1.2))}%` }} />
                    </div>
                  )}
                </div>
              ) : (
                <span className="w-2 h-2 rounded-full bg-red-400"></span>
              )}
            </div>

          </div>

          {/* Graceful Permission Notices */}
          {hasCameraPermission === false && (
            <div className="w-full mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
              <span>Camera preview was blocked by browser or is in use. You can still join with microphone and chat.</span>
            </div>
          )}

          {hasMicPermission === false && (
            <div className="w-full mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
              <span>Microphone access was not granted. You can still join as a listener and chat in real-time.</span>
            </div>
          )}

          {/* Media Controls Bar */}
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={toggleMic}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md cursor-pointer ${
                isMicOn ? 'bg-[#252d47] hover:bg-[#323c61] text-white' : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
              title={isMicOn ? 'Mute Mic' : 'Unmute Mic'}
            >
              {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5 text-white" />}
            </button>

            <button
              onClick={toggleCam}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md cursor-pointer ${
                isCamOn ? 'bg-[#252d47] hover:bg-[#323c61] text-white' : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
              title={isCamOn ? 'Turn Camera Off' : 'Turn Camera On'}
            >
              {isCamOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5 text-white" />}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsMirrored((prev) => !prev);
                onShowToast(!isMirrored ? 'Camera preview mirrored' : 'Camera preview natural orientation');
              }}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md cursor-pointer ${
                isMirrored ? 'bg-[var(--primary)] text-white' : 'bg-[#252d47] hover:bg-[#323c61] text-white'
              }`}
              title="Toggle Mirror Camera (Default: Natural)"
            >
              <FlipHorizontal className="w-5 h-5" />
            </button>
          </div>

          {/* Status text */}
          <p className="text-xs text-slate-400 mt-3 font-medium">
            Mic {isMicOn ? 'on' : 'off'} · Camera {isCamOn ? 'on' : 'off'}
            {isMirrored && ' · Mirrored'}
          </p>
        </div>

        {/* Right: Join Form & Server Verification Info */}
        <div className="lg:col-span-5 space-y-5 text-left bg-[#151b30] p-7 md:p-8 rounded-2xl border border-[#252d47] shadow-xl">
          
          {isCheckingMeeting ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-400">Verifying meeting room...</span>
            </div>
          ) : verificationError && !meetingDetails ? (
            <div className="space-y-4 py-4 text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white font-['Bricolage_Grotesque']">
                Meeting Not Found
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                {verificationError}
              </p>
              <button
                onClick={onCancel}
                className="w-full py-2.5 rounded-xl font-semibold bg-[#252d47] text-white text-xs hover:bg-[#323c61] transition-colors cursor-pointer"
              >
                Return to Dashboard
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-extrabold text-white font-['Bricolage_Grotesque'] truncate">
                    {meetingDetails?.title || 'Meeting Lobby'}
                  </h2>
                  {meetingDetails?.hasPassword && (
                    <span title="Password Protected" className="p-1 rounded bg-amber-500/20 text-amber-400">
                      <Lock className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  Room: <code className="font-mono text-indigo-300">{initialMeetingId}</code>
                  {isUserHost && <span className="ml-2 font-bold text-amber-400">• You are the Host</span>}
                </p>
              </div>

              {verificationError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{verificationError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Your display name <span className="text-red-400">*</span></span>
                  <span className="text-[11px] text-slate-400 font-normal">Visible on your video box</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setVerificationError(null);
                  }}
                  placeholder="Enter the name to display to others"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#252d47] bg-[#0b1020] text-white focus:border-[var(--primary)] focus:outline-none transition-colors text-sm"
                />
                <p className="text-[11px] text-slate-400">
                  This name will appear on your video box and will be seen by everyone in the room.
                </p>
              </div>

              {/* Password Input if meeting requires password and user is not host */}
              {meetingDetails?.hasPassword && !isUserHost && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Meeting password required</span>
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setVerificationError(null);
                    }}
                    placeholder="Enter room password"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#252d47] bg-[#0b1020] text-white focus:border-[var(--primary)] focus:outline-none transition-colors text-sm font-mono"
                  />
                </div>
              )}

              <button
                onClick={handleJoin}
                disabled={isJoining}
                className="w-full py-3.5 rounded-xl font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-d)] transition-all shadow-lg shadow-indigo-500/25 text-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isJoining ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Joining meeting...</span>
                  </>
                ) : (
                  <span>Join now</span>
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  onClick={onCancel}
                  className="text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </>
          )}

        </div>

      </div>
    </div>
  );
};
