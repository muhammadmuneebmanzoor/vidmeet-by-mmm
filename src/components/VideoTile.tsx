import React, { useRef, useEffect, useState } from 'react';
import { Mic, MicOff, Pin, VolumeX, UserMinus, Shield } from 'lucide-react';
import { Participant } from '../types';

export interface VideoTileProps {
  participant: Participant;
  mediaStream?: MediaStream | null;
  videoTrack?: any; // LiveKit Track or VideoTrack
  isLocal?: boolean;
  isPinned?: boolean;
  isMirrored?: boolean;
  isHostUser?: boolean;
  onTogglePin?: () => void;
  onMuteParticipant?: () => void;
  onAllowParticipant?: () => void;
  onRemoveParticipant?: () => void;
  className?: string;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  participant,
  mediaStream,
  videoTrack,
  isLocal = false,
  isPinned = false,
  isMirrored = false,
  isHostUser = false,
  onTogglePin,
  onMuteParticipant,
  onAllowParticipant,
  onRemoveParticipant,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Default behavior: Local preview is natural/unmirrored unless isMirrored is explicitly true.
  // Remote participants are NEVER mirrored.
  const shouldMirror = isLocal ? Boolean(isMirrored) : false;

  const pName = participant?.name || (isLocal ? 'You' : 'Participant');
  const initialLetter = pName.trim().charAt(0).toUpperCase() || (isLocal ? 'Y' : 'P');
  const avatarBg = participant?.avatarColor || '#4f46e5';
  const isMicActive = Boolean(participant?.isMicOn);
  const isCamActive = Boolean(participant?.isCamOn);
  const isCurrentlySpeaking = Boolean(participant?.isSpeaking);

  const [streamTrackVersion, setStreamTrackVersion] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Check if an active video track exists from LiveKit or MediaStream
  const isVideoTrackAvailable = Boolean(
    (videoTrack && (typeof videoTrack.isMuted === 'boolean' ? !videoTrack.isMuted : true)) ||
    (mediaStream && mediaStream.getVideoTracks().some((t) => t.readyState !== 'ended'))
  );

  // Camera feed is active if participant camera is on AND a video track or mediaStream is present
  const showVideo = Boolean(
    isCamActive && (isVideoTrackAvailable || (mediaStream && mediaStream.getVideoTracks().length > 0))
  );

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    // Ensure mobile browsers allow inline playback and autoplay without audio
    (videoEl as any).playsInline = true;
    (videoEl as any).webkitPlaysInline = true;
    videoEl.muted = true;
    (videoEl as any).defaultMuted = true;
    videoEl.setAttribute('playsinline', 'true');
    videoEl.setAttribute('webkit-playsinline', 'true');

    // 1. If LiveKit VideoTrack is provided, attach using LiveKit attach() API
    if (videoTrack && typeof videoTrack.attach === 'function') {
      try {
        videoTrack.attach(videoEl);
        const p = videoEl.play();
        if (p !== undefined) {
          p.catch(() => {});
        }
      } catch (err) {
        console.warn('[LiveKit] Video track attach note:', err);
      }
      return () => {
        try {
          if (typeof videoTrack.detach === 'function') {
            videoTrack.detach(videoEl);
          }
        } catch {}
      };
    }

    // 2. If native MediaStream is provided (e.g. WebRTC remote stream or local preview stream)
    if (mediaStream) {
      if (videoEl.srcObject !== mediaStream) {
        videoEl.srcObject = mediaStream;
      }
      const playPromise = videoEl.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }

      const handleTrackChange = () => {
        setStreamTrackVersion((v: number) => v + 1);
        if (videoEl.srcObject !== mediaStream) {
          videoEl.srcObject = mediaStream;
        }
        videoEl.play().catch(() => {});
      };

      mediaStream.getVideoTracks().forEach((vt) => {
        vt.onunmute = () => {
          setStreamTrackVersion((v: number) => v + 1);
          videoEl.play().catch(() => {});
        };
      });

      mediaStream.addEventListener('addtrack', handleTrackChange);
      mediaStream.addEventListener('removetrack', handleTrackChange);

      return () => {
        mediaStream.removeEventListener('addtrack', handleTrackChange);
        mediaStream.removeEventListener('removetrack', handleTrackChange);
      };
    } else {
      if (videoEl.srcObject) {
        videoEl.srcObject = null;
      }
    }
  }, [mediaStream, videoTrack, isCamActive, streamTrackVersion]);

  return (
    <div
      className={`relative rounded-2xl overflow-hidden flex items-center justify-center border transition-all duration-200 select-none shadow-lg ${
        isCurrentlySpeaking
          ? 'border-emerald-400 ring-2 ring-emerald-400/80 shadow-emerald-500/20'
          : 'border-[#252d47]'
      } ${className}`}
      style={{
        background: `linear-gradient(135deg, ${avatarBg}33 0%, #0b1020 90%)`,
      }}
    >
      {/* Video Element: Always muted so browser autoplay policies never block video display */}
      <video
        ref={(el) => {
          videoRef.current = el;
          if (el && mediaStream && el.srcObject !== mediaStream) {
            el.srcObject = mediaStream;
            el.play().catch(() => {});
          }
        }}
        autoPlay
        playsInline
        muted
        onPlay={() => setIsPlaying(true)}
        onPlaying={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onLoadedMetadata={(e) => {
          e.currentTarget.play().catch(() => {});
        }}
        onCanPlay={(e) => {
          e.currentTarget.play().catch(() => {});
        }}
        className={`w-full h-full object-cover transition-opacity duration-200 ${
          showVideo ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          transform: shouldMirror ? 'scaleX(-1)' : 'none',
        }}
      />

      {/* Avatar Placeholder: Shown when camera is turned off */}
      {!showVideo && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center font-bold text-white text-2xl shadow-xl border-2 border-white/20 select-none"
            style={{ backgroundColor: avatarBg }}
          >
            {initialLetter}
          </div>
        </div>
      )}

      {/* Name and Microphone Status Badge */}
      <div className="absolute left-3 bottom-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 border border-white/10 z-10">
        {isMicActive ? (
          <Mic className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
        ) : (
          <MicOff className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
        )}
        <span className="truncate max-w-[120px] sm:max-w-[160px]">
          {pName} {isLocal && '(You)'}
        </span>
      </div>

      {/* Top badges: Host controls (for host on remote participants) + Speaking indicator and Pin */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
        {/* Host controls for managing this remote participant */}
        {isHostUser && !isLocal && (
          <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md p-1 rounded-xl border border-white/10 shadow-md">
            {isMicActive ? (
              onMuteParticipant && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMuteParticipant();
                  }}
                  className="p-1 rounded-lg bg-red-600/80 hover:bg-red-600 text-white transition-colors cursor-pointer"
                  title={`Mute ${pName}`}
                  aria-label={`Mute ${pName}`}
                >
                  <VolumeX className="w-3.5 h-3.5" />
                </button>
              )
            ) : (
              onAllowParticipant && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAllowParticipant();
                  }}
                  className="p-1 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white transition-colors cursor-pointer"
                  title={`Allow ${pName} to speak`}
                  aria-label={`Allow ${pName} to speak`}
                >
                  <Mic className="w-3.5 h-3.5" />
                </button>
              )
            )}

            {onRemoveParticipant && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveParticipant();
                }}
                className="p-1 rounded-lg bg-red-500/20 hover:bg-red-600 text-red-300 hover:text-white transition-colors cursor-pointer"
                title={`Remove ${pName} from meeting`}
                aria-label={`Remove ${pName} from meeting`}
              >
                <UserMinus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {isCurrentlySpeaking && (
          <span className="bg-emerald-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow animate-pulse">
            Speaking
          </span>
        )}

        {onTogglePin && (
          <button
            onClick={onTogglePin}
            className={`p-1.5 rounded-lg bg-black/50 text-white/80 hover:text-white backdrop-blur-md transition-colors cursor-pointer ${
              isPinned ? 'text-amber-400 bg-black/80' : ''
            }`}
            title={isPinned ? 'Unpin participant' : 'Pin participant'}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
