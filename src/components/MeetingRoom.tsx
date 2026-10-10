import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Lock, Monitor, Shield, Users, MessageSquare, Copy, Check, 
  Sparkles, Radio, PhoneOff, Volume2, AlertCircle, FlipHorizontal, X
} from 'lucide-react';
import { 
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  LocalParticipant,
  VideoPresets,
} from 'livekit-client';
import { LiveKitRoom, RoomAudioRenderer, useParticipants, useLocalParticipant } from '@livekit/components-react';
import { Participant, ChatMessage } from '../types';
import { VideoTile } from './VideoTile';
import { MeetingControls } from './MeetingControls';
import { ParticipantList } from './ParticipantList';
import { ChatPanel } from './ChatPanel';
import { useAuth } from '../context/AuthContext';
import { normalizeRoomId } from '../lib/supabase';

export interface MeetingRoomProps {
  meetingTitle?: string;
  meetingId?: string;
  meetingDbId?: string;
  meetingPassword?: string;
  userName: string;
  initialMicOn: boolean;
  initialCamOn: boolean;
  isHost?: boolean;
  initialIsLocked?: boolean;
  onLeaveMeeting: () => void;
  onShowToast: (msg: string) => void;
}

interface Reaction {
  id: number;
  emoji: string;
  x: number;
}

const AVATAR_COLORS = ['#4f46e5', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0891b2'];

export const MeetingRoom: React.FC<MeetingRoomProps> = ({
  meetingTitle = 'Team Meeting',
  meetingId = '123-456-789',
  meetingDbId,
  meetingPassword,
  userName,
  initialMicOn,
  initialCamOn,
  isHost: initialIsHost = false,
  initialIsLocked = false,
  onLeaveMeeting,
  onShowToast,
}) => {
  const { session } = useAuth();
  const normalizedMeetingId = normalizeRoomId(meetingId) || meetingId;

  // Host state: strictly true ONLY if the server indicates this user is the host
  const [isHost] = useState<boolean>(() => {
    return initialIsHost;
  });

  useEffect(() => {
    try {
      localStorage.removeItem(`vidmeet_host_${normalizedMeetingId}`);
    } catch {}
  }, [normalizedMeetingId]);

  // Media Controls State
  const [isMicOn, setIsMicOn] = useState(initialMicOn);
  const [isCamOn, setIsCamOn] = useState(initialCamOn);
  const [isSharing, setIsSharing] = useState(false);
  const [isSpeakingLocal, setIsSpeakingLocal] = useState(false);
  const [isLocalMirrored, setIsLocalMirrored] = useState(true); // Default: mirrored
  const [activePanel, setActivePanel] = useState<'chat' | 'participants' | null>(null);
  const [pinnedParticipantId, setPinnedParticipantId] = useState<string | null>(null);

  // LiveKit Connection & Audio Status
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'disconnected'>('connecting');
  const [liveKitConfigured, setLiveKitConfigured] = useState<boolean | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [livekitAuth, setLivekitAuth] = useState<{ serverUrl: string; token: string } | null>(null);

  // Real Participants (No mock data!)
  const [remoteParticipants, setRemoteParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);

  // Screen share & media refs
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteScreenTrack, setRemoteScreenTrack] = useState<any>(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);
  const [screenSharerName, setScreenSharerName] = useState<string>('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isMicLockedByHost, setIsMicLockedByHost] = useState(false);
  const isMicLockedByHostRef = useRef(false);
  isMicLockedByHostRef.current = isMicLockedByHost;
  const [isLocalScreenSharing, setIsLocalScreenSharing] = useState(false);
  const screenSharerIdRef = useRef<string | null>(null);
  const remoteScreenTrackIdRef = useRef<string | null>(null);

  // Internal references
  const livekitRoomRef = useRef<Room | null>(null);
  const livekitScreenTrackPubRef = useRef<any>(null);
  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const localScreenStreamRef = useRef<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const activeScreenStreamIdRef = useRef<string | null>(null);
  const audioAnalyzersRef = useRef<Map<string, { ctx: AudioContext; intervalId: any }>>(new Map());
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const setupCrossDeviceWebRTCRef = useRef<(() => void) | null>(null);
  const isWebRTCSetupRef = useRef(false);
  const connectLiveKitRoomRef = useRef<((url: string, token: string) => Promise<void>) | null>(null);
  const joinedNotificationShownRef = useRef<Set<string>>(new Set());
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const windowAudioContextRef = useRef<AudioContext | null>(null);
  const highestSignalingSeqRef = useRef<number>(0);
  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  const localParticipantId = useRef<string>(`user-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`);
  const isCamOnRef = useRef(isCamOn);
  isCamOnRef.current = isCamOn;
  const isMicOnRef = useRef(isMicOn);
  isMicOnRef.current = isMicOn;
  const onShowToastRef = useRef(onShowToast);
  onShowToastRef.current = onShowToast;

  // Diagnostic logger conforming to specification
  const logDiagnosticState = useCallback((room: Room | null, remotes: Participant[]) => {
    if (!room) return;
    const localCamPub = room.localParticipant?.getTrackPublication(Track.Source.Camera);
    const localMicPub = room.localParticipant?.getTrackPublication(Track.Source.Microphone);
    const attachedAudioCount = audioContainerRef.current ? audioContainerRef.current.children.length : 0;
    const remoteTracksSummary = remotes
      .map((r) => `${r.name} (cam:${r.isCamOn}, mic:${r.isMicOn})`)
      .join(', ');

    console.log(
      `[LiveKit]\n` +
      `room: ${room.name || meetingId}\n` +
      `local participant: ${room.localParticipant?.identity || userName}\n` +
      `connection state: ${room.state}\n` +
      `remote participants: ${remotes.length} [${remoteTracksSummary || 'none'}]\n` +
      `local camera published: ${Boolean(localCamPub?.track && !localCamPub.isMuted)}\n` +
      `local microphone published: ${Boolean(localMicPub?.track && !localMicPub.isMuted)}\n` +
      `remote tracks: ${remotes.filter((r) => r.videoTrack).length} video track(s)\n` +
      `audio attached: ${attachedAudioCount} audio element(s)`
    );
  }, [meetingId, userName]);

  // Load chat history from PostgreSQL/API
  useEffect(() => {
    let isMounted = true;
    async function loadChatHistory() {
      try {
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        if (meetingPassword) {
          headers['x-meeting-password'] = meetingPassword;
        }
        const res = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/messages`, { headers });
        if (res.ok) {
          const history = await res.json();
          if (isMounted && Array.isArray(history)) {
            setMessages(history);
          }
        }
      } catch (err) {
        console.warn('Could not load chat history:', err);
      }
    }
    loadChatHistory();
    return () => {
      isMounted = false;
    };
  }, [meetingId, session?.access_token, meetingPassword]);

  // Meeting duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setDurationSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // 1. Initialize Local Media Tracks for smooth immediate preview
  useEffect(() => {
    let active = true;

    async function setupLocalMedia() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          let stream: MediaStream | null = null;

          // Resilient media acquisition: Mobile front-camera preference with automatic split-track fallback
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
              audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            });
          } catch (firstErr: any) {
            // If previous lobby preview stream was just stopped, allow mobile hardware 200ms to reset
            if (firstErr?.name === 'NotReadableError' || firstErr?.name === 'TrackStartError') {
              await new Promise((r) => setTimeout(r, 250));
            }
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
              });
            } catch {
              // Split acquisition fallback for mobile browsers that reject combined constraints
              const tracks: MediaStreamTrack[] = [];
              try {
                const v = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                tracks.push(...v.getVideoTracks());
              } catch {
                try {
                  const v = await navigator.mediaDevices.getUserMedia({ video: true });
                  tracks.push(...v.getVideoTracks());
                } catch {}
              }
              try {
                const a = await navigator.mediaDevices.getUserMedia({ audio: true });
                tracks.push(...a.getAudioTracks());
              } catch {}

              if (tracks.length > 0) {
                stream = new MediaStream(tracks);
              }
            }
          }

          if (!stream) {
            throw new Error('No camera or microphone stream could be captured');
          }

          if (!active) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }

          // Apply initial enabled states
          stream.getVideoTracks().forEach((t) => (t.enabled = initialCamOn));
          stream.getAudioTracks().forEach((t) => (t.enabled = initialMicOn));
          localStreamRef.current = stream;
          setLocalStream(stream);

          // If peer connections already exist, attach tracks directly to existing transceivers/senders
          peerConnectionsRef.current.forEach((pc) => {
            const transceivers = pc.getTransceivers();
            const senders = pc.getSenders();
            stream.getTracks().forEach((track) => {
              const transceiver = transceivers.find(
                (t) => t.receiver.track.kind === track.kind || t.sender.track?.kind === track.kind
              );
              if (transceiver && transceiver.sender) {
                transceiver.sender.replaceTrack(track).catch(() => {});
                transceiver.direction = 'sendrecv';
              } else {
                const existing = senders.find((s) => s.track?.kind === track.kind);
                if (existing) {
                  existing.replaceTrack(track).catch(() => {});
                } else {
                  try {
                    pc.addTrack(track, stream);
                  } catch {}
                }
              }
            });
          });

          // Inform remote peers of our initial camera/mic states
          sendSignalingMessage({
            type: 'state_change',
            participantId: localParticipantId.current,
            isMicOn: initialMicOn,
            isCamOn: initialCamOn,
          });

          // Audio speaking activity detector
          setupAudioSpeakingDetector(stream);
        }
      } catch (err: any) {
        console.warn('Could not acquire local camera/mic stream:', err);
        if (err.name === 'NotAllowedError') {
          onShowToast('Permission denied. Please allow access to your camera and microphone.');
        } else if (err.name === 'NotFoundError') {
          onShowToast('No camera or microphone found.');
        } else {
          onShowToast('Could not access camera or microphone.');
        }
      }
    }

    setupLocalMedia();

    // Auto-unlock audio autoplay restriction on user interaction
    const unlockAudio = () => {
      if (audioContainerRef.current) {
        audioContainerRef.current.querySelectorAll('audio').forEach((el) => {
          el.muted = false;
          el.play().catch(() => {});
        });
      }
    };
    window.addEventListener('click', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });

    return () => {
      active = false;
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      if (localAudioCleanupRef.current) {
        localAudioCleanupRef.current();
        localAudioCleanupRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Audio level analyser for local speaking indicator (throttled to avoid CPU/memory lag)
  const localAudioCleanupRef = useRef<(() => void) | null>(null);

  const setupAudioSpeakingDetector = (stream: MediaStream) => {
    if (localAudioCleanupRef.current) {
      localAudioCleanupRef.current();
      localAudioCleanupRef.current = null;
    }

    try {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      let wasSpeakingLocal = false;

      const intervalId = setInterval(() => {
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length;
        const isNowSpeaking = avg > 25;
        if (isNowSpeaking !== wasSpeakingLocal) {
          wasSpeakingLocal = isNowSpeaking;
          setIsSpeakingLocal(isNowSpeaking);
        }
      }, 150);

      const cleanup = () => {
        clearInterval(intervalId);
        audioCtx.close().catch(() => {});
      };
      localAudioCleanupRef.current = cleanup;
      return cleanup;
    } catch {
      // AudioContext restricted
    }
  };

  // Sync mic/cam track enabled states when toggled
  useEffect(() => {
    // If participant is locked by host, unconditionally enforce mic off
    const isLocked = !isHost && (isMicLockedByHost || isMicLockedByHostRef.current);
    if (isLocked && isMicOn) {
      setIsMicOn(false);
    }

    const effectiveMic = isLocked ? false : isMicOn;

    const stream = localStreamRef.current || localStream;
    if (stream) {
      stream.getVideoTracks().forEach((t) => (t.enabled = isCamOn));
      stream.getAudioTracks().forEach((t) => (t.enabled = effectiveMic));
    }

    // Sync to LiveKit
    if (livekitRoomRef.current && livekitRoomRef.current.localParticipant) {
      livekitRoomRef.current.localParticipant.setCameraEnabled(isCamOn).catch((e) => {
        console.warn('[LiveKit] setCameraEnabled note:', e);
      });
      livekitRoomRef.current.localParticipant.setMicrophoneEnabled(effectiveMic).catch((e) => {
        console.warn('[LiveKit] setMicrophoneEnabled note:', e);
      });
    }

    // Sync to BroadcastChannel & Cross-Device SSE fallback
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          type: 'state_change',
          participantId: localParticipantId.current,
          isMicOn,
          isCamOn,
        });
      } catch {}
    }

    // Send state change over server signaling relay to other devices
    fetch('/api/signaling/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: meetingId,
        message: {
          type: 'state_change',
          participantId: localParticipantId.current,
          isMicOn,
          isCamOn,
        },
      }),
    }).catch(() => {});
  }, [isCamOn, isMicOn, localStream, meetingId]);

  // Synchronize LiveKit room participants with React state (Robust LiveKit API usage)
  const syncLiveKitParticipants = useCallback((room: Room) => {
    if (!room) return;
    const list: Participant[] = [];
    console.log(`[LiveKit Debug] syncLiveKitParticipants called. Room remoteParticipants size: ${room.remoteParticipants.size}`);
    
    room.remoteParticipants.forEach((p, identity) => {
      console.log(`[LiveKit Debug] Found remote participant: ${identity || p.identity}`);
      const safeId = identity || p.identity || `user-${list.length}`;
      // Robustly retrieve camera and microphone track publications
      const cameraPub = p.getTrackPublication(Track.Source.Camera) || 
        Array.from(p.videoTrackPublications.values()).find((pub) => pub.source !== Track.Source.ScreenShare);
      const micPub = p.getTrackPublication(Track.Source.Microphone) || 
        Array.from(p.audioTrackPublications.values())[0];

      const videoTrack = cameraPub?.track ?? null;
      // Camera and mic are on if publication exists and is unmuted or track is present
      const isRemoteCamOn = Boolean(cameraPub && (!cameraPub.isMuted || cameraPub.track));
      const isRemoteMicOn = Boolean(micPub && (!micPub.isMuted || micPub.track));

      const charCode = safeId.charCodeAt(0) || 65;
      list.push({
        id: safeId,
        name: p.name || 'Participant',
        avatarColor: AVATAR_COLORS[Math.abs(charCode) % AVATAR_COLORS.length],
        isHost: false,
        isMicOn: isRemoteMicOn,
        isCamOn: isRemoteCamOn,
        isSpeaking: Boolean(p.isSpeaking),
        isLocal: false,
        videoTrack,
      });
    });

    setRemoteParticipants(list);
    logDiagnosticState(room, list);
  }, [logDiagnosticState]);

  // Attach remote audio track safely to ensure silent automatic playback
  const attachRemoteAudioTrack = useCallback((track: RemoteTrack, participantIdentity: string) => {
    if (!track || !participantIdentity) return;
    const container = audioContainerRef.current || document.body;
    const elId = `lk-audio-${participantIdentity}-${track.sid || 'audio'}`;
    
    // Check if already attached
    let audioEl = document.getElementById(elId) as HTMLAudioElement | null;
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.id = elId;
      audioEl.autoplay = true;
      (audioEl as any).playsInline = true;
      audioEl.setAttribute('playsinline', '');
      audioEl.setAttribute('webkit-playsinline', '');
      container.appendChild(audioEl);
    }
    audioEl.volume = 1.0;
    audioEl.muted = false;
    track.attach(audioEl);

    console.log(`[LiveKit] Audio element attached for participant: ${participantIdentity}, track: ${track.sid}`);

    // Attempt automatic playback immediately
    audioEl.play().catch(() => {
      // Quietly wait for next user touch/tap to start
    });
  }, []);

  // Detach remote audio track and clean up DOM node
  const detachRemoteAudioTrack = useCallback((track: RemoteTrack, participantIdentity: string) => {
    try {
      if (!track) return;
      const elId = `lk-audio-${participantIdentity || 'user'}-${track.sid || 'audio'}`;
      const existing = document.getElementById(elId) as HTMLAudioElement | null;
      if (existing) {
        track.detach(existing);
        existing.remove();
      } else {
        track.detach();
      }
      console.log(`[LiveKit] Audio element detached / track unsubscribed: ${track.sid} for ${participantIdentity}`);
    } catch (e) {
      console.warn('[LiveKit] Audio detach note:', e);
    }
  }, []);

  // Global user interaction listener to automatically and silently unblock Web Audio / media autoplay on mobile and desktop
  useEffect(() => {
    const unlockAudio = () => {
      if (windowAudioContextRef.current && windowAudioContextRef.current.state === 'suspended') {
        windowAudioContextRef.current.resume().catch(() => {});
      }
      if (livekitRoomRef.current) {
        livekitRoomRef.current.startAudio().catch(() => {});
      }
      if (audioContainerRef.current) {
        audioContainerRef.current.querySelectorAll('audio').forEach((el) => {
          el.play().catch(() => {});
        });
      }
    };

    // Attempt immediate silent unlock on mount
    unlockAudio();

    window.addEventListener('click', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('touchend', unlockAudio, { passive: true });
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('touchend', unlockAudio);
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  // Connect to LiveKit Room using livekit-client SDK
  const connectLiveKitRoom = useCallback(async (serverUrl: string, token: string) => {
    try {
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: {
          videoCodec: 'vp8',
          backupCodec: true,
          simulcast: true,
          videoEncoding: {
            maxBitrate: 1_500_000,
            maxFramerate: 30,
          },
          screenShareEncoding: {
            maxBitrate: 3_000_000,
            maxFramerate: 15,
          },
        },
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      livekitRoomRef.current = room;
      setRoom(room);

      // Event: Connected
      room.on(RoomEvent.Connected, async () => {
        setConnectionStatus('connected');
        if (room.localParticipant?.identity) {
          localParticipantId.current = room.localParticipant.identity;
        }
        console.log(`[LiveKit] Room connected: ${room.name || meetingId}`);
        console.log(`[LiveKit] Local participant identity: ${room.localParticipant?.identity || userName}`);
        console.log(`[LiveKit] Connection state: ${room.state}`);
        onShowToast(`Connected to LiveKit Room: ${meetingId}`);

        // Automatically start audio
        room.startAudio().catch(() => {});

        // Publish local camera and mic based on current desired states
        try {
          if (isCamOnRef.current) {
            await room.localParticipant.setCameraEnabled(true);
            console.log('[LiveKit] Local camera published: true');
          }
          if (isMicOnRef.current) {
            await room.localParticipant.setMicrophoneEnabled(true);
            console.log('[LiveKit] Local microphone published: true');
          }
        } catch (e) {
          console.warn('[LiveKit] Error publishing initial local tracks:', e);
        }

        // Attach audio tracks and ensure explicit subscription for all participants already present
        room.remoteParticipants.forEach((p) => {
          console.log(`[LiveKit] Existing remote participant detected on connect: ${p.identity} (${p.name || 'Participant'})`);
          p.getTrackPublications().forEach((pub) => {
            if (!pub.isSubscribed && typeof (pub as any).setSubscribed === 'function') {
              (pub as any).setSubscribed(true);
            }
            if (pub.track && pub.track.kind === Track.Kind.Audio) {
              console.log(`[LiveKit] Remote microphone publication found for: ${p.identity}`);
              attachRemoteAudioTrack(pub.track as RemoteTrack, p.identity);
            }
          });
        });

        // Sync existing remote participants immediately
        syncLiveKitParticipants(room);
      });

      // Event: Connection State Changed
      room.on(RoomEvent.ConnectionStateChanged, (state: any) => {
        console.log(`[LiveKit] Connection state changed to: ${state}`);
      });

      // Event: Disconnected
      room.on(RoomEvent.Disconnected, (reason?: any) => {
        setConnectionStatus('disconnected');
        console.warn(`[LiveKit] Room disconnected. Reason: ${reason}`);
        onShowToast(`Disconnected from meeting: ${reason || 'Unknown reason'}`);
      });

      // Event: Reconnecting
      room.on(RoomEvent.Reconnecting, () => {
        setConnectionStatus('reconnecting');
        console.log('[LiveKit] Room reconnecting...');
      });

      // Event: Reconnected
      room.on(RoomEvent.Reconnected, () => {
        setConnectionStatus('connected');
        console.log('[LiveKit] Room reconnected.');
        onShowToast('Reconnected to meeting');
      });

      // Event: Participant Connected
      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        console.log(`[LiveKit] Remote participant connected: ${participant.identity} (${participant.name || 'Participant'})`);
        participant.getTrackPublications().forEach((pub) => {
          if (!pub.isSubscribed && typeof (pub as any).setSubscribed === 'function') {
            (pub as any).setSubscribed(true);
          }
        });
        syncLiveKitParticipants(room);
        onShowToast(`${participant.name || 'Participant'} joined the room`);
      });

      // Event: Participant Disconnected
      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        console.log(`[LiveKit] Remote participant disconnected: ${participant.identity}`);
        // Clean up any remaining audio elements from this participant
        participant.getTrackPublications().forEach((pub) => {
          if (pub.track && pub.track.kind === Track.Kind.Audio) {
            detachRemoteAudioTrack(pub.track as RemoteTrack, participant.identity);
          }
        });

        syncLiveKitParticipants(room);
        onShowToast(`${participant.name || 'Participant'} left the room`);
      });

      // Event: Track Published
      room.on(RoomEvent.TrackPublished, (publication, participant) => {
        const participantId = participant?.identity || 'remote';
        console.log(`[LiveKit] Track published: ${publication?.kind} (${publication?.source}) by ${participantId}`);
        // Ensure explicit subscription regardless of client platform
        if (!publication.isSubscribed && typeof (publication as any).setSubscribed === 'function') {
          (publication as any).setSubscribed(true);
        }
        syncLiveKitParticipants(room);
      });

      // Event: Track Unpublished
      room.on(RoomEvent.TrackUnpublished, (publication, participant) => {
        const participantId = participant?.identity || 'remote';
        console.log(`[LiveKit] Track unpublished: ${publication?.kind} (${publication?.source}) by ${participantId}`);
        // CRITICAL: Do NOT remove participant from React state! Keep their container and placeholder avatar intact
        syncLiveKitParticipants(room);
      });

      // Event: Local Track Published
      room.on(RoomEvent.LocalTrackPublished, (publication) => {
        console.log(`[LiveKit] Local track published: ${publication?.kind} (${publication?.source})`);
      });

      // Event: Local Track Unpublished
      room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
        console.log(`[LiveKit] Local track unpublished: ${publication?.kind} (${publication?.source})`);
        // CRITICAL: Do NOT disconnect room or leave room or trigger participant unmounting!
      });

      // Event: Track Subscribed (Video / Audio / Screen)
      room.on(
        RoomEvent.TrackSubscribed,
        (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          const participantId = participant?.identity || 'remote';
          console.log(`[LiveKit] Track subscribed: ${track?.kind} (${track?.source}) from participant: ${participantId}`);
          if (track && track.kind === Track.Kind.Audio) {
            console.log(`[LiveKit] Remote microphone publication subscribed for: ${participantId}`);
            attachRemoteAudioTrack(track, participantId);
          } else if (track && track.kind === Track.Kind.Video) {
            if (track.source === Track.Source.ScreenShare) {
              setRemoteScreenTrack(track);
              setScreenSharerName(participant?.name || 'Participant');
              setIsSharing(true);
              if (screenVideoRef.current) {
                track.attach(screenVideoRef.current);
              }
            }
          }
          syncLiveKitParticipants(room);
        }
      );

      // Event: Track Unsubscribed
      room.on(
        RoomEvent.TrackUnsubscribed,
        (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          const participantId = participant?.identity || 'remote';
          console.log(`[LiveKit] Track unsubscribed: ${track?.kind} (${track?.source}) from participant: ${participantId}`);
          if (track && track.kind === Track.Kind.Audio) {
            detachRemoteAudioTrack(track, participantId);
          } else if (track && track.kind === Track.Kind.Video) {
            track.detach();
            if (track.source === Track.Source.ScreenShare) {
              setRemoteScreenTrack(null);
              setIsSharing(false);
            }
          }
          syncLiveKitParticipants(room);
        }
      );

      // Event: Track Muted / Unmuted
      room.on(RoomEvent.TrackMuted, () => syncLiveKitParticipants(room));
      room.on(RoomEvent.TrackUnmuted, () => syncLiveKitParticipants(room));

      // Event: Active Speakers Changed
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const speakerIds = new Set(speakers.map((s) => s.identity));
        if (room.localParticipant) {
          setIsSpeakingLocal(speakerIds.has(room.localParticipant.identity));
        }
        setRemoteParticipants((prev) =>
          prev.map((p) => ({
            ...p,
            isSpeaking: speakerIds.has(p.id),
          }))
        );
      });

      // Event: Audio Playback Status Changed (Autoplay unlock)
      room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        if (!room.canPlaybackAudio) {
          room.startAudio().catch(() => {});
        }
      });

      // Event: Data Received (Realtime Chat, Reactions, Host Controls)
      room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
        try {
          const str = new TextDecoder().decode(payload);
          const data = JSON.parse(str);

          if (data.type === 'chat') {
            if (data.message) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === data.message.id)) return prev;
                return [...prev, data.message];
              });
              if (activePanel !== 'chat') {
                setUnreadChatCount((prev) => prev + 1);
              }
            }
          } else if (data.type === 'reaction') {
            triggerReaction(data.emoji, data.x);
          } else if (data.type === 'host_mute') {
            if (!data.targetIdentity || data.targetIdentity === localParticipantId.current) {
              setIsMicOn(false);
              if (!isHost) {
                setIsMicLockedByHost(true);
              }
              if (localStreamRef.current) {
                localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = false));
              }
              if (livekitRoomRef.current?.localParticipant) {
                livekitRoomRef.current.localParticipant.setMicrophoneEnabled(false).catch(() => {});
              }
              onShowToast('You were muted by the host. Your microphone is locked.');
            }
          } else if (data.type === 'host_mute_all') {
            if (!isHost) {
              setIsMicOn(false);
              setIsMicLockedByHost(true);
              if (localStreamRef.current) {
                localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = false));
              }
              if (livekitRoomRef.current?.localParticipant) {
                livekitRoomRef.current.localParticipant.setMicrophoneEnabled(false).catch(() => {});
              }
              onShowToast('All participants were muted by the host. Microphones are locked.');
            }
          } else if (data.type === 'host_allow_mic') {
            if (!data.targetIdentity || data.targetIdentity === localParticipantId.current) {
              setIsMicLockedByHost(false);
              onShowToast('The host has unlocked your microphone. You can now unmute to speak.');
            }
          } else if (data.type === 'host_allow_all_mic') {
            if (!isHost) {
              setIsMicLockedByHost(false);
              onShowToast('The host has unlocked all microphones. You can now unmute.');
            }
          } else if (data.type === 'host_remove') {
            if (data.targetIdentity === localParticipantId.current) {
              onShowToast('You were removed from the meeting by the host');
              handleLeave();
            }
          } else if (data.type === 'meeting_ended') {
            onShowToast('The meeting was ended by the host');
            handleLeave();
          }
        } catch (e) {
          console.warn('Error parsing incoming data packet:', e);
        }
      });

      // Event: Reconnecting / Reconnected / Disconnected
      room.on(RoomEvent.Reconnecting, () => {
        console.log('[LiveKit] Connection state: reconnecting');
        setConnectionStatus('reconnecting');
      });
      room.on(RoomEvent.Reconnected, () => {
        console.log('[LiveKit] Connection state: connected (reconnected)');
        setConnectionStatus('connected');
        syncLiveKitParticipants(room);
      });
      room.on(RoomEvent.Disconnected, () => {
        console.log('[LiveKit] Connection state: disconnected');
        setConnectionStatus('disconnected');
      });

      await room.connect(serverUrl, token, { autoSubscribe: true });
    } catch (err: any) {
      console.warn('LiveKit room connection notice:', err);
      setLiveKitConfigured(false);
      if (livekitRoomRef.current) {
        try {
          livekitRoomRef.current.disconnect();
        } catch {}
        livekitRoomRef.current = null;
        setRoom(null);
      }
      setupCrossDeviceWebRTC();
      setConnectionStatus('connected');
    }
  }, [meetingId, isHost, userName, attachRemoteAudioTrack, detachRemoteAudioTrack, syncLiveKitParticipants, onShowToast]);

  useEffect(() => {
    connectLiveKitRoomRef.current = connectLiveKitRoom;
  }, [connectLiveKitRoom]);

  // 2. Connect to LiveKit SFU with seamless fallback (stable one-time run on room mount)
  useEffect(() => {
    let isCancelled = false;

    async function connectToMeeting() {
      setConnectionStatus('connecting');

      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const res = await fetch('/api/livekit/token', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            roomName: meetingId,
            participantName: userName,
            password: meetingPassword,
          }),
        });

        if (!res.ok) {
          throw new Error('Failed to retrieve LiveKit token from server');
        }

        const tokenData = await res.json();
        if (isCancelled) return;

        // If LiveKit server credentials are fully configured in environment
        if (tokenData.configured && tokenData.serverUrl && tokenData.token) {
          setLiveKitConfigured(true);
          setLivekitAuth({ serverUrl: tokenData.serverUrl, token: tokenData.token });
          await connectLiveKitRoomRef.current?.(tokenData.serverUrl, tokenData.token);
        } else {
          setLiveKitConfigured(false);
          setLivekitAuth(null);
          setupCrossDeviceWebRTC();
          setConnectionStatus('connected');
        }
      } catch (err: any) {
        console.warn('LiveKit connection initialization notice:', err);
        setLiveKitConfigured(false);
        if (!isCancelled) {
          setupCrossDeviceWebRTC();
          setConnectionStatus('connected');
        }
      }
    }

    connectToMeeting();

    return () => {
      isCancelled = true;
      if (livekitRoomRef.current) {
        livekitRoomRef.current.disconnect();
        livekitRoomRef.current = null;
        setRoom(null);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({
            type: 'leave',
            participantId: localParticipantId.current,
          });
          broadcastChannelRef.current.close();
        } catch {}
        broadcastChannelRef.current = null;
      }
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      audioAnalyzersRef.current.forEach((a) => {
        clearInterval(a.intervalId);
        a.ctx.close().catch(() => {});
      });
      audioAnalyzersRef.current.clear();
      isWebRTCSetupRef.current = false;
    };
  }, [meetingId, userName, meetingPassword, session?.access_token]);

  // Unblock audio playback helper
  const handleEnableAudio = async () => {
    try {
      if (windowAudioContextRef.current && windowAudioContextRef.current.state === 'suspended') {
        await windowAudioContextRef.current.resume();
      }
      if (livekitRoomRef.current) {
        await livekitRoomRef.current.startAudio();
      }
      // Also unblock all existing attached audio elements
      if (audioContainerRef.current) {
        Array.from(audioContainerRef.current.querySelectorAll('audio')).forEach((el) => {
          el.play().catch(() => {});
        });
      }
    } catch (err) {
      console.warn('Could not unblock audio:', err);
    }
  };

  // Safe helper to broadcast signaling messages across local tabs and remote devices
  const sendSignalingMessage = useCallback((message: any) => {
    const msgId = message.msgId || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const fullMsg = { ...message, msgId };

    // 1. Broadcast locally across same-origin tabs
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage(fullMsg);
      } catch {}
    }

    // 2. Relay across all devices (Mobile, Laptop, Desktop) via Server SSE endpoint
    fetch('/api/signaling/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: normalizedMeetingId,
        message: fullMsg,
      }),
    }).catch(() => {});
  }, [normalizedMeetingId]);

  // 3. Multi-Device Real WebRTC Peer Connection (Cross-device SSE + WebRTC Mesh)
  const setupCrossDeviceWebRTC = useCallback(() => {
    if (isWebRTCSetupRef.current) return;
    isWebRTCSetupRef.current = true;

    // 1. Initialize BroadcastChannel if available (canonical room ID matching)
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const channelName = `videomeet_realtime_${normalizedMeetingId}`;
        const channel = new BroadcastChannel(channelName);
        broadcastChannelRef.current = channel;
        channel.onmessage = (event) => {
          handleIncomingSignalingData(event.data);
        };
      } catch {}
    }

    // 2. Initialize Cross-Device SSE Stream with auto-recovery
    try {
      const sseUrl = `/api/signaling/events/${encodeURIComponent(normalizedMeetingId)}?participantId=${encodeURIComponent(localParticipantId.current)}`;
      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        sendSignalingMessage({
          type: 'join',
          participantId: localParticipantId.current,
          name: userName || 'User',
          isHost,
          isMicOn: isMicOnRef.current,
          isCamOn: isCamOnRef.current,
        });
      };

      es.onmessage = (event) => {
        try {
          if (!event.data || event.data.startsWith(':')) return;
          const parsed = JSON.parse(event.data);
          if (typeof parsed.latestSeq === 'number') {
            highestSignalingSeqRef.current = Math.max(highestSignalingSeqRef.current, parsed.latestSeq);
          }
          if (typeof parsed.__seq === 'number') {
            highestSignalingSeqRef.current = Math.max(highestSignalingSeqRef.current, parsed.__seq);
          }
          handleIncomingSignalingData(parsed);
        } catch {}
      };

      es.onerror = () => {
        // EventSource will automatically retry in background
      };
    } catch (e) {
      console.warn('SSE connection notice:', e);
    }

    // 3. Resilient background polling to guarantee 100% signaling delivery on mobile networks
    const pollInterval = setInterval(async () => {
      try {
        const pollUrl = `/api/signaling/poll/${encodeURIComponent(normalizedMeetingId)}?participantId=${encodeURIComponent(
          localParticipantId.current
        )}&since=${highestSignalingSeqRef.current}`;
        const res = await fetch(pollUrl);
        if (res.ok) {
          const data = await res.json();
          if (typeof data.latestSeq === 'number') {
            highestSignalingSeqRef.current = Math.max(highestSignalingSeqRef.current, data.latestSeq);
          }
          if (Array.isArray(data.messages)) {
            for (const msg of data.messages) {
              if (typeof msg.__seq === 'number') {
                highestSignalingSeqRef.current = Math.max(highestSignalingSeqRef.current, msg.__seq);
              }
              handleIncomingSignalingData(msg);
            }
          }
        }
      } catch {}
    }, 1500);

    // 4. Heartbeat broadcast every 3.5s to ensure reliable presence discovery across late joins & mobile wakeups
    const heartbeatInterval = setInterval(() => {
      sendSignalingMessage({
        type: 'heartbeat',
        participantId: localParticipantId.current,
        name: userName || 'User',
        isHost,
        isMicOn: isMicOnRef.current,
        isCamOn: isCamOnRef.current,
      });
    }, 3500);

    // Announce join to all peers in the room
    sendSignalingMessage({
      type: 'join',
      participantId: localParticipantId.current,
      name: userName || 'User',
      isHost,
      isMicOn: isMicOnRef.current,
      isCamOn: isCamOnRef.current,
    });

    return () => {
      clearInterval(pollInterval);
      clearInterval(heartbeatInterval);
    };
  }, [normalizedMeetingId, userName, isHost, sendSignalingMessage]);

  useEffect(() => {
    const cleanup = setupCrossDeviceWebRTC();
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [setupCrossDeviceWebRTC]);

  // Helper to drain pending ICE candidates once remoteDescription is set
  const drainPendingIceCandidates = async (remoteId: string, pc: RTCPeerConnection) => {
    const list = pendingIceCandidatesRef.current.get(remoteId) || [];
    if (list.length > 0) {
      pendingIceCandidatesRef.current.set(remoteId, []);
      for (const candidate of list) {
        try {
          if (candidate && (candidate.candidate || candidate.sdpMid !== undefined)) {
            await pc.addIceCandidate(candidate);
          }
        } catch (e) {
          console.warn('[WebRTC] ICE candidate drain error:', e);
        }
      }
    }
  };

  // Safe playback and speaking detection for remote audio streams
  const playRemoteAudio = (remoteId: string, audioStream: MediaStream) => {
    if (!audioContainerRef.current) return;
    const elId = `peer-audio-${remoteId}`;
    let audioEl = document.getElementById(elId) as HTMLAudioElement | null;
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.id = elId;
      audioEl.autoplay = true;
      (audioEl as any).playsInline = true;
      audioEl.setAttribute('playsinline', 'true');
      audioEl.setAttribute('webkit-playsinline', 'true');
      audioContainerRef.current.appendChild(audioEl);
    }
    audioEl.srcObject = audioStream;
    audioEl.volume = 1.0;
    audioEl.muted = false;

    // Listen to track unmuting on mobile browsers to trigger immediate playback
    audioStream.getAudioTracks().forEach((track) => {
      track.onunmute = () => {
        audioEl?.play().catch(() => {});
      };
    });

    audioEl.play().catch(() => {});

    // Clean up any existing analyzer for this remote peer
    const existing = audioAnalyzersRef.current.get(remoteId);
    if (existing) {
      clearInterval(existing.intervalId);
      existing.ctx.close().catch(() => {});
      audioAnalyzersRef.current.delete(remoteId);
    }

    // Detect remote speaking activity on a throttled 150ms interval to prevent UI freezing
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(audioStream);
      source.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      let wasSpeaking = false;

      const intervalId = setInterval(() => {
        analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length;
        const speaking = avg > 20;
        if (speaking !== wasSpeaking) {
          wasSpeaking = speaking;
          setRemoteParticipants((prev) =>
            prev.map((p) => (p.id === remoteId && p.isSpeaking !== speaking ? { ...p, isSpeaking: speaking } : p))
          );
        }
      }, 150);

      audioAnalyzersRef.current.set(remoteId, { ctx: audioCtx, intervalId });
    } catch {}
  };

  // Cleanly remove a remote participant, their video tile, tracks, audio, and analyzers
  const removeRemoteParticipant = useCallback((remoteId: string, name?: string) => {
    joinedNotificationShownRef.current.delete(remoteId);
    setRemoteParticipants((prev) => prev.filter((p) => p.id !== remoteId));

    const pc = peerConnectionsRef.current.get(remoteId);
    if (pc) {
      try {
        pc.close();
      } catch {}
      peerConnectionsRef.current.delete(remoteId);
    }

    remoteStreamsRef.current.delete(remoteId);
    pendingIceCandidatesRef.current.delete(remoteId);

    // Clean up audio analyzer
    const analyzer = audioAnalyzersRef.current.get(remoteId);
    if (analyzer) {
      clearInterval(analyzer.intervalId);
      analyzer.ctx.close().catch(() => {});
      audioAnalyzersRef.current.delete(remoteId);
    }

    const audioEl = document.getElementById(`peer-audio-${remoteId}`);
    if (audioEl) {
      audioEl.remove();
    }

    if (screenSharerIdRef.current === remoteId) {
      screenSharerIdRef.current = null;
      remoteScreenTrackIdRef.current = null;
      setRemoteScreenStream(null);
      setRemoteScreenTrack(null);
      setIsSharing(false);
    }

    if (name) {
      onShowToastRef.current(`${name} left`);
    }
  }, []);

  const getOrCreatePeerConnection = (remoteId: string) => {
    let pc = peerConnectionsRef.current.get(remoteId);
    if (pc && pc.signalingState === 'closed') {
      peerConnectionsRef.current.delete(remoteId);
      pc = undefined;
    }
    if (!pc) {
      pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
          { urls: 'stun:global.stun.twilio.com:3478' },
          {
            urls: [
              'turn:openrelay.metered.ca:80',
              'turn:openrelay.metered.ca:443',
              'turn:openrelay.metered.ca:443?transport=tcp',
              'turns:openrelay.metered.ca:443?transport=tcp',
            ],
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
        ],
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
      });

      // Add local audio and video tracks to peer connection
      const curStream = localStreamRef.current || localStream;
      if (curStream && curStream.getTracks().length > 0) {
        curStream.getTracks().forEach((track) => {
          try {
            pc!.addTrack(track, curStream);
          } catch {}
        });
      } else {
        // If local media stream is not ready yet, add transceivers so incoming remote tracks can be received
        try {
          pc.addTransceiver('audio', { direction: 'sendrecv' });
          pc.addTransceiver('video', { direction: 'sendrecv' });
        } catch {}
      }

      // If local screen share is active, also attach screen track
      if (localScreenStreamRef.current) {
        const screenTrack = localScreenStreamRef.current.getVideoTracks()[0];
        if (screenTrack) {
          try {
            pc.addTrack(screenTrack, localScreenStreamRef.current);
          } catch {}
        }
      }

      pc.ontrack = (event) => {
        let stream = event.streams && event.streams[0];
        const track = event.track;

        // Detect if this incoming track is a screen share stream:
        // Only classify as screen share if this remote peer was explicitly announced as screen sharer
        const isFromScreenSharer = Boolean(
          screenSharerIdRef.current && screenSharerIdRef.current === remoteId
        );
        const matchesScreenTrack = Boolean(
          remoteScreenTrackIdRef.current && track.id === remoteScreenTrackIdRef.current
        );
        const isScreen =
          track.kind === 'video' &&
          isFromScreenSharer &&
          (matchesScreenTrack || Boolean(remoteStreamsRef.current.get(remoteId)?.getVideoTracks().length));

        if (isScreen) {
          const screenStream = stream || new MediaStream([track]);
          setRemoteScreenStream(screenStream);
          setIsSharing(true);
          return;
        }

        let remoteStream = remoteStreamsRef.current.get(remoteId);
        if (!remoteStream) {
          remoteStream = new MediaStream();
          remoteStreamsRef.current.set(remoteId, remoteStream);
        }

        if (stream) {
          stream.getTracks().forEach((t) => {
            if (!remoteStream!.getTracks().some((existing) => existing.id === t.id)) {
              remoteStream!.addTrack(t);
            }
          });
        } else if (track) {
          if (!remoteStream.getTracks().some((existing) => existing.id === track.id)) {
            remoteStream.addTrack(track);
          }
        }

        // Trigger React state update with updated stream
        const updatedStream = new MediaStream(remoteStream.getTracks());
        setRemoteParticipants((prev) => {
          const found = prev.find((p) => p.id === remoteId);
          if (found) {
            return prev.map((p) =>
              p.id === remoteId
                ? {
                    ...p,
                    isCamOn: track.kind === 'video' ? true : p.isCamOn,
                    isMicOn: track.kind === 'audio' ? true : p.isMicOn,
                    mediaStream: updatedStream,
                  }
                : p
            );
          }
          return [
            ...prev,
            {
              id: remoteId,
              name: 'Participant',
              avatarColor: AVATAR_COLORS[Math.abs(remoteId.charCodeAt(0)) % AVATAR_COLORS.length],
              isHost: false,
              isMicOn: true,
              isCamOn: true,
              isSpeaking: false,
              isLocal: false,
              mediaStream: updatedStream,
            },
          ];
        });

        // Trigger video play upon first unmuting on mobile Safari
        if (track.kind === 'video') {
          track.onunmute = () => {
            setRemoteParticipants((prev) =>
              prev.map((p) =>
                p.id === remoteId
                  ? { ...p, isCamOn: true, mediaStream: new MediaStream(remoteStream!.getTracks()) }
                  : p
              )
            );
          };
        }

        // If audio track, attach to HTMLAudioElement for playback
        if (track.kind === 'audio') {
          const audioStream = new MediaStream([track]);
          playRemoteAudio(remoteId, audioStream);
          track.onunmute = () => {
            playRemoteAudio(remoteId, audioStream);
          };
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignalingMessage({
            type: 'webrtc_ice',
            participantId: localParticipantId.current,
            targetId: remoteId,
            candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
          });
        }
      };

      let failTimer: any = null;
      const handleConnectionDrop = () => {
        const state = pc?.connectionState;
        const iceState = pc?.iceConnectionState;

        if (state === 'closed' || iceState === 'closed') {
          if (failTimer) clearTimeout(failTimer);
          removeRemoteParticipant(remoteId);
        } else if (state === 'failed' || iceState === 'failed') {
          // If connection genuinely failed (not just temporary 'disconnected' during ICE re-check),
          // wait 20 seconds before removal to allow ICE renegotiation/recovery
          if (!failTimer) {
            failTimer = setTimeout(() => {
              if (pc?.connectionState === 'failed' || pc?.iceConnectionState === 'failed') {
                removeRemoteParticipant(remoteId);
              }
            }, 20000);
          }
        } else if (state === 'connected' && iceState === 'connected') {
          if (failTimer) {
            clearTimeout(failTimer);
            failTimer = null;
          }
        }
      };

      pc.onconnectionstatechange = handleConnectionDrop;
      pc.oniceconnectionstatechange = handleConnectionDrop;

      peerConnectionsRef.current.set(remoteId, pc);
    }
    return pc;
  };

  const initiateWebRTCPeer = async (remoteId: string, isInitiator: boolean) => {
    if (!isInitiator) return;
    try {
      const pc = getOrCreatePeerConnection(remoteId);
      if (pc.signalingState !== 'stable') return;

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      if (pc.signalingState !== 'stable') return;
      await pc.setLocalDescription(offer);

      sendSignalingMessage({
        type: 'webrtc_offer',
        participantId: localParticipantId.current,
        targetId: remoteId,
        offer: { type: offer.type, sdp: offer.sdp },
        senderName: userName,
        isHost,
        isMicOn: isMicOnRef.current,
        isCamOn: isCamOnRef.current,
      });
    } catch (e) {
      console.warn('[WebRTC] offer error:', e);
    }
  };

  const handleIncomingSignalingData = async (data: any) => {
    if (!data || data.participantId === localParticipantId.current) return;

    // Deduplicate incoming messages across BroadcastChannel, SSE, and Polling streams
    const msgKey = data.msgId || (data.__seq ? `seq_${data.__seq}` : null);
    if (msgKey) {
      if (processedMessageIdsRef.current.has(msgKey)) return;
      processedMessageIdsRef.current.add(msgKey);
      if (processedMessageIdsRef.current.size > 800) {
        const arr = Array.from(processedMessageIdsRef.current);
        processedMessageIdsRef.current = new Set(arr.slice(arr.length - 400));
      }
    }

    const remoteId = data.participantId;

    switch (data.type) {
      case 'join': {
        setRemoteParticipants((prev) => {
          if (prev.some((p) => p.id === remoteId)) return prev;
          return [
            ...prev,
            {
              id: remoteId,
              name: data.name || 'Guest',
              avatarColor: AVATAR_COLORS[Math.abs(remoteId.charCodeAt(0)) % AVATAR_COLORS.length],
              isHost: data.isHost || false,
              isMicOn: typeof data.isMicOn === 'boolean' ? data.isMicOn : true,
              isCamOn: typeof data.isCamOn === 'boolean' ? data.isCamOn : true,
              isSpeaking: false,
              isLocal: false,
              mediaStream: remoteStreamsRef.current.get(remoteId) || null,
            },
          ];
        });

        // Deduplicate notification so popup never fires back to back
        if (!joinedNotificationShownRef.current.has(remoteId)) {
          joinedNotificationShownRef.current.add(remoteId);
          onShowToastRef.current(`${data.name || 'Participant'} joined`);
        }

        // Reply presence to let newly joined user know about us
        sendSignalingMessage({
          type: 'presence',
          participantId: localParticipantId.current,
          targetId: remoteId,
          name: userName,
          isHost,
          isMicOn: isMicOnRef.current,
          isCamOn: isCamOnRef.current,
        });

        // Deterministic initiator: only initiate if localParticipantId.current < remoteId
        if (localParticipantId.current < remoteId) {
          initiateWebRTCPeer(remoteId, true);
        }
        break;
      }

      case 'presence': {
        if (data.targetId !== localParticipantId.current) return;

        setRemoteParticipants((prev) => {
          if (prev.some((p) => p.id === remoteId)) return prev;
          return [
            ...prev,
            {
              id: remoteId,
              name: data.name || 'Guest',
              avatarColor: AVATAR_COLORS[Math.abs(remoteId.charCodeAt(0)) % AVATAR_COLORS.length],
              isHost: data.isHost || false,
              isMicOn: typeof data.isMicOn === 'boolean' ? data.isMicOn : true,
              isCamOn: typeof data.isCamOn === 'boolean' ? data.isCamOn : true,
              isSpeaking: false,
              isLocal: false,
              mediaStream: remoteStreamsRef.current.get(remoteId) || null,
            },
          ];
        });

        getOrCreatePeerConnection(remoteId);
        // Deterministic initiator: if local ID is smaller, initiate WebRTC peer
        if (localParticipantId.current < remoteId) {
          initiateWebRTCPeer(remoteId, true);
        }
        break;
      }

      case 'heartbeat': {
        // Continuous discovery: add or update remote peer state
        setRemoteParticipants((prev) => {
          if (prev.some((p) => p.id === remoteId)) {
            return prev.map((p) =>
              p.id === remoteId
                ? {
                    ...p,
                    name: data.name || p.name,
                    isHost: typeof data.isHost === 'boolean' ? data.isHost : p.isHost,
                    isMicOn: typeof data.isMicOn === 'boolean' ? data.isMicOn : p.isMicOn,
                    isCamOn: typeof data.isCamOn === 'boolean' ? data.isCamOn : p.isCamOn,
                  }
                : p
            );
          }
          return [
            ...prev,
            {
              id: remoteId,
              name: data.name || 'Participant',
              avatarColor: AVATAR_COLORS[Math.abs(remoteId.charCodeAt(0)) % AVATAR_COLORS.length],
              isHost: Boolean(data.isHost),
              isMicOn: typeof data.isMicOn === 'boolean' ? data.isMicOn : true,
              isCamOn: typeof data.isCamOn === 'boolean' ? data.isCamOn : true,
              isSpeaking: false,
              isLocal: false,
              mediaStream: remoteStreamsRef.current.get(remoteId) || null,
            },
          ];
        });

        // Ensure peer connection exists and is connected
        const existingPc = peerConnectionsRef.current.get(remoteId);
        if (!existingPc || existingPc.connectionState === 'failed' || existingPc.connectionState === 'closed') {
          getOrCreatePeerConnection(remoteId);
          if (localParticipantId.current < remoteId) {
            initiateWebRTCPeer(remoteId, true);
          }
        }
        break;
      }

      case 'webrtc_offer': {
        if (data.targetId !== localParticipantId.current) return;
        setRemoteParticipants((prev) => {
          if (prev.some((p) => p.id === remoteId)) return prev;
          return [
            ...prev,
            {
              id: remoteId,
              name: data.senderName || 'Participant',
              avatarColor: AVATAR_COLORS[Math.abs(remoteId.charCodeAt(0)) % AVATAR_COLORS.length],
              isHost: Boolean(data.isHost),
              isMicOn: typeof data.isMicOn === 'boolean' ? data.isMicOn : true,
              isCamOn: typeof data.isCamOn === 'boolean' ? data.isCamOn : true,
              isSpeaking: false,
              isLocal: false,
              mediaStream: remoteStreamsRef.current.get(remoteId) || null,
            },
          ];
        });

        try {
          const pc = getOrCreatePeerConnection(remoteId);
          // Handle glare collision: polite peer rolls back local offer to accept incoming offer
          const isPolite = localParticipantId.current < remoteId;
          const offerCollision = pc.signalingState !== 'stable';
          if (offerCollision) {
            if (!isPolite) {
              return;
            }
            try {
              await pc.setLocalDescription({ type: 'rollback' });
            } catch {}
          }
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          await drainPendingIceCandidates(remoteId, pc);

          // Attach local tracks to transceivers before creating answer
          const curStream = localStreamRef.current || localStream;
          if (curStream) {
            const transceivers = pc.getTransceivers();
            curStream.getTracks().forEach((track) => {
              const transceiver = transceivers.find(
                (t) => t.receiver.track.kind === track.kind || t.sender.track?.kind === track.kind
              );
              if (transceiver && transceiver.sender) {
                transceiver.sender.replaceTrack(track).catch(() => {});
                transceiver.direction = 'sendrecv';
              }
            });
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          sendSignalingMessage({
            type: 'webrtc_answer',
            participantId: localParticipantId.current,
            targetId: remoteId,
            answer: { type: answer.type, sdp: answer.sdp },
            senderName: userName,
            isHost,
            isMicOn: isMicOnRef.current,
            isCamOn: isCamOnRef.current,
          });
        } catch (e) {
          console.warn('[WebRTC] offer handle error:', e);
        }
        break;
      }

      case 'webrtc_answer': {
        if (data.targetId !== localParticipantId.current) return;
        setRemoteParticipants((prev) => {
          if (prev.some((p) => p.id === remoteId)) return prev;
          return [
            ...prev,
            {
              id: remoteId,
              name: data.senderName || 'Participant',
              avatarColor: AVATAR_COLORS[Math.abs(remoteId.charCodeAt(0)) % AVATAR_COLORS.length],
              isHost: Boolean(data.isHost),
              isMicOn: typeof data.isMicOn === 'boolean' ? data.isMicOn : true,
              isCamOn: typeof data.isCamOn === 'boolean' ? data.isCamOn : true,
              isSpeaking: false,
              isLocal: false,
              mediaStream: remoteStreamsRef.current.get(remoteId) || null,
            },
          ];
        });

        try {
          const pc = peerConnectionsRef.current.get(remoteId);
          if (pc && pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            await drainPendingIceCandidates(remoteId, pc);
          }
        } catch (e) {
          console.warn('[WebRTC] answer handle error:', e);
        }
        break;
      }

      case 'webrtc_ice': {
        if (data.targetId !== localParticipantId.current) return;
        if (!data.candidate) return;
        const pc = peerConnectionsRef.current.get(remoteId);
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(data.candidate);
          } catch (e) {
            console.warn('[WebRTC] ICE candidate add error:', e);
          }
        } else {
          // Queue candidate until setRemoteDescription completes
          const list = pendingIceCandidatesRef.current.get(remoteId) || [];
          list.push(data.candidate);
          pendingIceCandidatesRef.current.set(remoteId, list);
        }
        break;
      }

      case 'state_change': {
        setRemoteParticipants((prev) =>
          prev.map((p) =>
            p.id === remoteId
              ? {
                  ...p,
                  isMicOn: typeof data.isMicOn === 'boolean' ? data.isMicOn : p.isMicOn,
                  isCamOn: typeof data.isCamOn === 'boolean' ? data.isCamOn : p.isCamOn,
                }
              : p
          )
        );
        break;
      }

      case 'screen_share': {
        if (data.enabled) {
          screenSharerIdRef.current = remoteId;
          remoteScreenTrackIdRef.current = data.trackId || null;
          setScreenSharerName(data.sharerName || 'Participant');
          setIsSharing(true);

          const pc = peerConnectionsRef.current.get(remoteId);
          if (pc) {
            const receivers = pc.getReceivers();
            const matchingReceiver = receivers.find(
              (r) =>
                r.track &&
                r.track.kind === 'video' &&
                (data.trackId ? r.track.id === data.trackId : true)
            );
            if (matchingReceiver?.track) {
              setRemoteScreenStream(new MediaStream([matchingReceiver.track]));
            }
          }
        } else {
          if (screenSharerIdRef.current === remoteId || !screenSharerIdRef.current) {
            screenSharerIdRef.current = null;
            remoteScreenTrackIdRef.current = null;
            setRemoteScreenStream(null);
            setRemoteScreenTrack(null);
            setIsSharing(false);
          }
        }
        break;
      }

      case 'chat': {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message?.id)) return prev;
          return [...prev, data.message];
        });
        if (activePanel !== 'chat') {
          setUnreadChatCount((prev) => prev + 1);
        }
        break;
      }

      case 'reaction': {
        triggerReaction(data.emoji, data.x);
        break;
      }

      case 'host_mute': {
        if (!data.targetIdentity || data.targetIdentity === localParticipantId.current) {
          setIsMicOn(false);
          if (!isHost) {
            setIsMicLockedByHost(true);
          }
          if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = false));
          }
          if (livekitRoomRef.current?.localParticipant) {
            livekitRoomRef.current.localParticipant.setMicrophoneEnabled(false).catch(() => {});
          }
          onShowToast('You were muted by the host. Your microphone is locked.');
        } else if (data.targetIdentity) {
          setRemoteParticipants((prev) =>
            prev.map((p) => (p.id === data.targetIdentity ? { ...p, isMicOn: false } : p))
          );
        }
        break;
      }

      case 'host_mute_all': {
        if (!isHost) {
          setIsMicOn(false);
          setIsMicLockedByHost(true);
          if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = false));
          }
          if (livekitRoomRef.current?.localParticipant) {
            livekitRoomRef.current.localParticipant.setMicrophoneEnabled(false).catch(() => {});
          }
          onShowToast('All participants were muted by the host. Microphones are locked.');
        }
        setRemoteParticipants((prev) => prev.map((p) => ({ ...p, isMicOn: false })));
        break;
      }

      case 'host_allow_mic': {
        if (!data.targetIdentity || data.targetIdentity === localParticipantId.current) {
          setIsMicLockedByHost(false);
          onShowToast('The host has unlocked your microphone. You can now unmute to speak.');
        }
        break;
      }

      case 'host_allow_all_mic': {
        if (!isHost) {
          setIsMicLockedByHost(false);
          onShowToast('The host has unlocked all microphones. You can now unmute.');
        }
        break;
      }

      case 'host_remove': {
        if (data.targetIdentity === localParticipantId.current) {
          onShowToast('You were removed from the meeting by the host');
          handleLeave();
        } else if (data.targetIdentity) {
          removeRemoteParticipant(data.targetIdentity);
        }
        break;
      }

      case 'meeting_ended': {
        onShowToast('The meeting was ended by the host');
        handleLeave();
        break;
      }

      case 'leave': {
        removeRemoteParticipant(remoteId, data.name || 'Participant');
        break;
      }
    }
  };

  // Toggle Microphone
  const toggleMic = useCallback(async () => {
    if (!isHost && isMicLockedByHost) {
      onShowToast('Your microphone is locked by the host. You cannot unmute until the host allows you.');
      return;
    }
    const next = !isMicOn;
    setIsMicOn(next);
    onShowToast(next ? 'Microphone on' : 'Microphone muted');

    const stream = localStreamRef.current || localStream;
    if (next) {
      // Turning mic ON
      const existingAudio = stream?.getAudioTracks().find((t) => t.readyState !== 'ended');
      if (existingAudio) {
        existingAudio.enabled = true;
      } else {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          }).catch(() => navigator.mediaDevices.getUserMedia({ audio: true }));
          const newTrack = micStream.getAudioTracks()[0];
          if (newTrack) {
            newTrack.enabled = true;
            if (stream) {
              stream.addTrack(newTrack);
              setLocalStream(new MediaStream(stream.getTracks()));
              setupAudioSpeakingDetector(stream);
            } else {
              const newStream = new MediaStream([newTrack]);
              localStreamRef.current = newStream;
              setLocalStream(newStream);
              setupAudioSpeakingDetector(newStream);
            }

            peerConnectionsRef.current.forEach((pc) => {
              const transceivers = pc.getTransceivers();
              const aTransceiver = transceivers.find((t) => t.receiver.track.kind === 'audio' || t.sender.track?.kind === 'audio');
              if (aTransceiver && aTransceiver.sender) {
                aTransceiver.sender.replaceTrack(newTrack).catch(() => {});
                aTransceiver.direction = 'sendrecv';
              } else {
                const aSender = pc.getSenders().find((s) => s.track?.kind === 'audio');
                if (aSender) {
                  aSender.replaceTrack(newTrack).catch(() => {});
                } else {
                  try {
                    pc.addTrack(newTrack, stream || localStreamRef.current!);
                  } catch {}
                }
              }
            });
          }
        } catch (err: any) {
          console.warn('Could not turn on microphone:', err);
          onShowToast('Could not access microphone device.');
        }
      }
    } else {
      // Turning mic OFF
      if (stream) {
        stream.getAudioTracks().forEach((t) => (t.enabled = false));
      }
      setIsSpeakingLocal(false);
    }

    if (livekitRoomRef.current?.localParticipant) {
      try {
        await livekitRoomRef.current.localParticipant.setMicrophoneEnabled(next);
        console.log(`[LiveKit] Local microphone setMicrophoneEnabled: ${next}`);
      } catch (err) {
        console.warn('[LiveKit] setMicrophoneEnabled error:', err);
      }
    }

    sendSignalingMessage({
      type: 'state_change',
      participantId: localParticipantId.current,
      isMicOn: next,
      isCamOn: isCamOnRef.current,
    });
  }, [isCamOn, isHost, isMicLockedByHost, isMicOn, localStream, onShowToast, sendSignalingMessage]);

  // Toggle Camera (Ensures no room disconnect or participant unmounting)
  const toggleCam = useCallback(async () => {
    const next = !isCamOn;
    setIsCamOn(next);
    onShowToast(next ? 'Camera on' : 'Camera turned off');

    const stream = localStreamRef.current || localStream;
    if (next) {
      // Turning camera ON
      const existingVideo = stream?.getVideoTracks().find((t) => t.readyState !== 'ended');
      if (existingVideo) {
        existingVideo.enabled = true;
      } else {
        try {
          let camStream: MediaStream | null = null;
          try {
            camStream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 1280 }, height: { ideal: 720 } },
            });
          } catch {
            camStream = await navigator.mediaDevices.getUserMedia({ video: true });
          }
          const newTrack = camStream?.getVideoTracks()[0];
          if (newTrack) {
            newTrack.enabled = true;
            if (stream) {
              stream.addTrack(newTrack);
              setLocalStream(new MediaStream(stream.getTracks()));
            } else {
              const newStream = new MediaStream([newTrack]);
              localStreamRef.current = newStream;
              setLocalStream(newStream);
            }

            peerConnectionsRef.current.forEach((pc) => {
              const transceivers = pc.getTransceivers();
              const vTransceiver = transceivers.find((t) => t.receiver.track.kind === 'video' || t.sender.track?.kind === 'video');
              if (vTransceiver && vTransceiver.sender) {
                vTransceiver.sender.replaceTrack(newTrack).catch(() => {});
                vTransceiver.direction = 'sendrecv';
              } else {
                const vSender = pc.getSenders().find((s) => s.track?.kind === 'video');
                if (vSender) {
                  vSender.replaceTrack(newTrack).catch(() => {});
                } else {
                  try {
                    pc.addTrack(newTrack, stream || localStreamRef.current!);
                  } catch {}
                }
              }
            });
          }
        } catch (err: any) {
          console.warn('Could not turn on camera:', err);
          onShowToast('Could not access camera. Please check camera permissions.');
        }
      }
    } else {
      // Turning camera OFF
      if (stream) {
        stream.getVideoTracks().forEach((t) => (t.enabled = false));
      }
    }

    if (livekitRoomRef.current?.localParticipant) {
      try {
        await livekitRoomRef.current.localParticipant.setCameraEnabled(next);
        console.log(`[LiveKit] Local camera setCameraEnabled: ${next}`);
      } catch (err) {
        console.warn('[LiveKit] setCameraEnabled error:', err);
      }
    }

    sendSignalingMessage({
      type: 'state_change',
      participantId: localParticipantId.current,
      isMicOn: isMicOnRef.current,
      isCamOn: next,
    });
  }, [isCamOn, localStream, onShowToast, sendSignalingMessage]);

  // Stop Screen Sharing cleanly
  const stopScreenSharing = useCallback(() => {
    if (localScreenStreamRef.current) {
      const screenTrack = localScreenStreamRef.current.getVideoTracks()[0];
      if (screenTrack) {
        peerConnectionsRef.current.forEach((pc, remoteId) => {
          try {
            const sender = pc.getSenders().find((s) => s.track === screenTrack || s.track?.id === screenTrack.id);
            if (sender) {
              pc.removeTrack(sender);
              if (pc.signalingState === 'stable') {
                initiateWebRTCPeer(remoteId, true);
              }
            }
          } catch {}
        });
        screenTrack.stop();
      }

      localScreenStreamRef.current.getTracks().forEach((t) => t.stop());
      localScreenStreamRef.current = null;
    }

    setIsLocalScreenSharing(false);
    setIsSharing(false);
    setRemoteScreenTrack(null);
    setRemoteScreenStream(null);
    screenSharerIdRef.current = null;
    remoteScreenTrackIdRef.current = null;
    activeScreenStreamIdRef.current = null;

    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }

    if (livekitRoomRef.current?.localParticipant) {
      try {
        if (livekitScreenTrackPubRef.current?.track) {
          livekitRoomRef.current.localParticipant.unpublishTrack(livekitScreenTrackPubRef.current.track).catch(() => {});
        }
      } catch {}
      livekitScreenTrackPubRef.current = null;
      livekitRoomRef.current.localParticipant.setScreenShareEnabled(false).catch(() => {});
    }

    sendSignalingMessage({
      type: 'screen_share',
      participantId: localParticipantId.current,
      enabled: false,
    });

    onShowToast('Screen sharing ended');
  }, [sendSignalingMessage, onShowToast]);

  // Toggle Screen Sharing with multi-device WebRTC peer connection support (including mobile browser support)
  const toggleScreenShare = async () => {
    if (isLocalScreenSharing || localScreenStreamRef.current) {
      stopScreenSharing();
      return;
    }

    try {
      const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      let stream: MediaStream | null = null;

      // Check if native getDisplayMedia is supported on this browser/environment
      const hasDisplayMedia = Boolean(
        navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function'
      );

      if (!hasDisplayMedia) {
        onShowToast("Screen sharing is not supported on this mobile device's browser (iOS/Android system restriction). Please join from a desktop or laptop to share your screen.");
        return;
      }

      // Native screen capture (shares device screen, never cameras)
      try {
        if (isMobile) {
          // Mobile Chrome (Android) requires video-only capture.
          // Specifying audio: true causes mobile operating systems to reject the request immediately.
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: false,
            });
          } catch (mobileVideoOnlyErr: any) {
            if (
              mobileVideoOnlyErr.name === 'NotAllowedError' ||
              mobileVideoOnlyErr.name === 'PermissionDeniedError' ||
              mobileVideoOnlyErr.name === 'AbortError'
            ) {
              throw mobileVideoOnlyErr;
            }
            // Minimal fallback for browsers that reject audio: false
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
            });
          }
        } else {
          try {
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
              audio: true,
            });
          } catch {
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
            });
          }
        }
      } catch (displayErr: any) {
        if (displayErr.name === 'NotAllowedError' || displayErr.name === 'PermissionDeniedError') {
          onShowToast('Screen sharing permission denied.');
          return;
        }
        if (displayErr.name === 'AbortError') {
          return;
        }
        console.warn('[ScreenShare] getDisplayMedia error on device:', displayErr);
        onShowToast('Could not start screen sharing on this device.');
        return;
      }

      if (!stream) {
        onShowToast('Could not access phone screen stream');
        return;
      }

      localScreenStreamRef.current = stream;
      setIsLocalScreenSharing(true);
      setIsSharing(true);
      setScreenSharerName('You');

      const screenTrack = stream.getVideoTracks()[0];
      if (!screenTrack) {
        onShowToast('No screen video track received');
        return;
      }
      activeScreenStreamIdRef.current = stream.id;

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        screenVideoRef.current.play().catch(() => {});
      }

      // Add screen track to all active peer connections so other participants see it
      peerConnectionsRef.current.forEach((pc, remoteId) => {
        try {
          pc.addTrack(screenTrack, stream);
          if (pc.signalingState === 'stable') {
            initiateWebRTCPeer(remoteId, true);
          }
        } catch (e) {
          console.warn('Error adding screen track to peer connection:', e);
        }
      });

      // Publish the actual captured screen track to LiveKit directly without re-prompting
      if (livekitRoomRef.current?.localParticipant) {
        try {
          const pub = await livekitRoomRef.current.localParticipant.publishTrack(screenTrack, {
            source: Track.Source.ScreenShare,
            name: 'screen_share',
          });
          livekitScreenTrackPubRef.current = pub;
        } catch (lkErr) {
          console.warn('[LiveKit] publishTrack screenShare error:', lkErr);
        }
      }

      sendSignalingMessage({
        type: 'screen_share',
        participantId: localParticipantId.current,
        enabled: true,
        sharerName: userName || 'You',
        trackId: screenTrack.id,
        streamId: stream.id,
      });

      screenTrack.onended = () => {
        stopScreenSharing();
      };

      onShowToast('Screen sharing started');
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        onShowToast('Could not share screen');
      }
    }
  };

  // Safe binding effect to attach screen stream to screen video element upon rendering
  useEffect(() => {
    if (!isSharing) return;
    const videoEl = screenVideoRef.current;
    if (!videoEl) return;

    const stream = localScreenStreamRef.current || remoteScreenStream;
    if (stream) {
      videoEl.srcObject = stream;
      videoEl.play().catch(() => {});
    } else if (remoteScreenTrack) {
      try {
        remoteScreenTrack.attach(videoEl);
      } catch {}
    }
  }, [isSharing, remoteScreenStream, remoteScreenTrack]);

  // Real Chat message delivery with PostgreSQL persistence & LiveKit broadcast
  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isSendingMessage) return;

    setIsSendingMessage(true);
    const tempId = `msg-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const newMsg: ChatMessage = {
      id: tempId,
      sender: userName || 'You',
      avatarColor: '#4f46e5',
      text: content.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSelf: true,
    };

    // Optimistic UI update
    setMessages((prev) => [...prev, newMsg]);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      if (meetingPassword) {
        headers['x-meeting-password'] = meetingPassword;
      }

      const res = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          senderName: userName || 'You',
          content: content.trim(),
        }),
      });

      if (res.ok) {
        const savedMsg = await res.json();
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...savedMsg, isSelf: true } : m)));

        // Broadcast through LiveKit Data channel if connected
        if (livekitRoomRef.current && livekitRoomRef.current.localParticipant) {
          const payload = new TextEncoder().encode(
            JSON.stringify({
              type: 'chat',
              message: { ...savedMsg, isSelf: false },
            })
          );
          livekitRoomRef.current.localParticipant.publishData(payload, { reliable: true }).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Error syncing chat message to server:', err);
    } finally {
      setIsSendingMessage(false);
    }

    // Broadcast message to other tabs & devices
    sendSignalingMessage({
      type: 'chat',
      participantId: localParticipantId.current,
      message: { ...newMsg, isSelf: false },
    });
  };

  // Reactions
  const triggerReaction = (emoji: string, x: number) => {
    const reactionId = Date.now() + Math.random();
    setReactions((prev) => [...prev, { id: reactionId, emoji, x }]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== reactionId));
    }, 2200);
  };

  const sendReaction = (emoji: string) => {
    const x = Math.floor(Math.random() * 60) + 20;
    triggerReaction(emoji, x);

    if (livekitRoomRef.current && livekitRoomRef.current.localParticipant) {
      const payload = new TextEncoder().encode(
        JSON.stringify({
          type: 'reaction',
          emoji,
          x,
        })
      );
      livekitRoomRef.current.localParticipant.publishData(payload, { reliable: false }).catch(() => {});
    }

    sendSignalingMessage({
      type: 'reaction',
      participantId: localParticipantId.current,
      emoji,
      x,
    });
  };

  // Host Actions (Immediate real-time execution + server synchronization)
  const handleHostAction = async (action: string) => {
    if (!isHost) return;

    try {
      const headers: Record<string, string> = { 
        'Content-Type': 'application/json',
        'x-is-host': 'true',
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
      };

      if (action === 'mute_all' || action === 'mute-all') {
        // 1. Broadcast mute-all over real-time signaling relay to all devices
        sendSignalingMessage({
          type: 'host_mute_all',
          participantId: localParticipantId.current,
        });

        // 2. Broadcast over LiveKit if connected
        if (livekitRoomRef.current?.localParticipant) {
          const payload = new TextEncoder().encode(JSON.stringify({ type: 'host_mute_all' }));
          livekitRoomRef.current.localParticipant.publishData(payload, { reliable: true }).catch(() => {});
        }

        // 3. Immediately reflect in local state
        setRemoteParticipants((prev) => prev.map((p) => ({ ...p, isMicOn: false })));
        onShowToast('Muted all participants & locked microphones');

        // 4. Synchronize with server endpoint
        fetch(`/api/meetings/${encodeURIComponent(meetingId)}/host/mute-all`, {
          method: 'POST',
          headers,
        }).catch(() => {});
      } else if (action === 'allow-all-mic' || action === 'allow_all_mic') {
        // 1. Broadcast allow-all over real-time signaling relay
        sendSignalingMessage({
          type: 'host_allow_all_mic',
          participantId: localParticipantId.current,
        });

        // 2. Broadcast over LiveKit if connected
        if (livekitRoomRef.current?.localParticipant) {
          const payload = new TextEncoder().encode(JSON.stringify({ type: 'host_allow_all_mic' }));
          livekitRoomRef.current.localParticipant.publishData(payload, { reliable: true }).catch(() => {});
        }

        onShowToast('Allowed all participants to unmute');

        fetch(`/api/meetings/${encodeURIComponent(meetingId)}/host/allow-all-mic`, {
          method: 'POST',
          headers,
        }).catch(() => {});
      } else if (action === 'end_meeting' || action === 'end-meeting-all') {
        sendSignalingMessage({
          type: 'meeting_ended',
          participantId: localParticipantId.current,
        });

        if (livekitRoomRef.current?.localParticipant) {
          const payload = new TextEncoder().encode(JSON.stringify({ type: 'meeting_ended' }));
          livekitRoomRef.current.localParticipant.publishData(payload, { reliable: true }).catch(() => {});
        }

        onShowToast('Meeting ended for all');

        fetch(`/api/meetings/${encodeURIComponent(meetingId)}/host/end`, {
          method: 'POST',
          headers,
        }).catch(() => {});

        handleLeave();
      }
    } catch {
      onShowToast('Host action failed');
    }
  };

  // Mute individual participant
  const handleMuteSingleParticipant = async (participantId: string, participantName: string) => {
    if (!isHost) return;

    try {
      // 1. Broadcast mute signal over signaling relay immediately
      sendSignalingMessage({
        type: 'host_mute',
        participantId: localParticipantId.current,
        targetIdentity: participantId,
      });

      // 2. Broadcast via LiveKit Data channel if active
      if (livekitRoomRef.current?.localParticipant) {
        const payload = new TextEncoder().encode(
          JSON.stringify({
            type: 'host_mute',
            targetIdentity: participantId,
          })
        );
        livekitRoomRef.current.localParticipant.publishData(payload, { reliable: true }).catch(() => {});
      }

      // 3. Update local UI state immediately
      setRemoteParticipants((prev) =>
        prev.map((p) => (p.id === participantId ? { ...p, isMicOn: false } : p))
      );
      onShowToast(`Muted ${participantName}`);

      // 4. Synchronize with server endpoint
      const headers: Record<string, string> = { 
        'Content-Type': 'application/json',
        'x-is-host': 'true',
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
      };

      fetch(`/api/meetings/${encodeURIComponent(meetingId)}/host/mute`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ participantIdentity: participantId }),
      }).catch(() => {});
    } catch {
      onShowToast('Failed to mute participant');
    }
  };

  // Allow individual participant to unmute & speak
  const handleAllowSingleParticipant = async (participantId: string, participantName: string) => {
    if (!isHost) return;

    try {
      // 1. Broadcast allow signal over signaling relay immediately
      sendSignalingMessage({
        type: 'host_allow_mic',
        participantId: localParticipantId.current,
        targetIdentity: participantId,
      });

      // 2. Broadcast via LiveKit Data channel if active
      if (livekitRoomRef.current?.localParticipant) {
        const payload = new TextEncoder().encode(
          JSON.stringify({
            type: 'host_allow_mic',
            targetIdentity: participantId,
          })
        );
        livekitRoomRef.current.localParticipant.publishData(payload, { reliable: true }).catch(() => {});
      }

      onShowToast(`Allowed ${participantName} to speak`);

      // 3. Synchronize with server endpoint
      const headers: Record<string, string> = { 
        'Content-Type': 'application/json',
        'x-is-host': 'true',
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
      };

      fetch(`/api/meetings/${encodeURIComponent(meetingId)}/host/allow-mic`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ participantIdentity: participantId }),
      }).catch(() => {});
    } catch {
      onShowToast('Failed to allow participant');
    }
  };

  // Remove individual participant
  const handleRemoveSingleParticipant = async (participantId: string, participantName: string) => {
    if (!isHost) return;

    try {
      // 1. Broadcast remove command to all devices immediately
      sendSignalingMessage({
        type: 'host_remove',
        participantId: localParticipantId.current,
        targetIdentity: participantId,
      });

      // 2. Broadcast via LiveKit Data channel if active
      if (livekitRoomRef.current?.localParticipant) {
        const payload = new TextEncoder().encode(
          JSON.stringify({
            type: 'host_remove',
            targetIdentity: participantId,
          })
        );
        livekitRoomRef.current.localParticipant.publishData(payload, { reliable: true }).catch(() => {});
      }

      // 3. Immediately clean up their peer connection and tile locally
      removeRemoteParticipant(participantId);
      onShowToast(`Removed ${participantName} from meeting`);

      // 4. Synchronize with server endpoint
      const headers: Record<string, string> = { 
        'Content-Type': 'application/json',
        'x-is-host': 'true',
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
      };

      fetch(`/api/meetings/${encodeURIComponent(meetingId)}/host/remove`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ participantIdentity: participantId }),
      }).catch(() => {});
    } catch {
      onShowToast('Failed to remove participant');
    }
  };

  // Notify peers and clean up if user closes the tab or window
  useEffect(() => {
    const handleUnload = () => {
      // 1. BroadcastChannel for local tabs
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({
            type: 'leave',
            participantId: localParticipantId.current,
            name: userName,
          });
        } catch {}
      }

      // 2. HTTP POST leave beacon to server signaling relay for remote devices
      try {
        const payload = JSON.stringify({
          roomId: meetingId,
          message: {
            type: 'leave',
            participantId: localParticipantId.current,
            name: userName,
          },
        });
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/signaling/message', new Blob([payload], { type: 'application/json' }));
        } else {
          fetch('/api/signaling/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {}
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [meetingId, userName]);

  // Leave Call
  const handleLeave = () => {
    // 1. Broadcast leave to server relay so remote participants immediately remove the video box
    sendSignalingMessage({
      type: 'leave',
      participantId: localParticipantId.current,
      name: userName,
    });

    // 2. Disconnect LiveKit if active
    if (livekitRoomRef.current) {
      try {
        livekitRoomRef.current.disconnect();
      } catch {}
      livekitRoomRef.current = null;
      setRoom(null);
    }

    // 3. Broadcast to local tabs via BroadcastChannel
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          type: 'leave',
          participantId: localParticipantId.current,
          name: userName,
        });
      } catch {}
    }

    // 4. Close all peer connections
    peerConnectionsRef.current.forEach((pc) => {
      try {
        pc.close();
      } catch {}
    });
    peerConnectionsRef.current.clear();

    audioAnalyzersRef.current.forEach((a) => {
      clearInterval(a.intervalId);
      a.ctx.close().catch(() => {});
    });
    audioAnalyzersRef.current.clear();

    // 5. Stop local media and screen streams
    if (localScreenStreamRef.current) {
      localScreenStreamRef.current.getTracks().forEach((t) => t.stop());
      localScreenStreamRef.current = null;
    }
    setIsLocalScreenSharing(false);
    setIsSharing(false);
    setIsMicLockedByHost(false);
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }

    onLeaveMeeting();
  };

  const copyMeetingLink = () => {
    const url = `${window.location.origin}/meeting/${encodeURIComponent(meetingId)}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    onShowToast(`Meeting URL copied to clipboard!`);
    setTimeout(() => setCopiedLink(false), 2500);
  };

// ... inside MeetingRoom component

  // Local Participant Representation
  const localParticipant: Participant = {
    id: localParticipantId.current,
    name: userName,
    avatarColor: AVATAR_COLORS[Math.abs(localParticipantId.current.charCodeAt(0)) % AVATAR_COLORS.length],
    isHost: isHost,
    isMicOn: isMicOn,
    isCamOn: isCamOn,
    isSpeaking: isSpeakingLocal,
    isLocal: true,
    videoTrack: room?.localParticipant?.getTrackPublication(Track.Source.Camera)?.track || null,
    mediaStream: localStream || localStreamRef.current || undefined,
  };

  const allParticipants: Participant[] = [localParticipant, ...remoteParticipants];

  // LiveKit Video Stage Component utilizing useParticipants and useLocalParticipant hooks
  const LiveKitVideoStage: React.FC<{
    isSharing: boolean;
    screenSharerName: string | null;
    isLocalScreenSharing: boolean;
    stopScreenSharing: () => void;
    screenVideoRef: React.RefObject<HTMLVideoElement | null>;
    isLocalMirrored: boolean;
    isHost: boolean;
    pinnedParticipantId: string | null;
    setPinnedParticipantId: (id: string | null) => void;
    handleMuteSingleParticipant: (id: string, name: string) => void;
    handleAllowSingleParticipant: (id: string, name: string) => void;
    handleRemoveSingleParticipant: (id: string, name: string) => void;
    onShowToast: (msg: string) => void;
    setIsSharing: (s: boolean) => void;
    setRemoteScreenStream: (s: MediaStream | null) => void;
    setRemoteScreenTrack: (t: any) => void;
    localStream: MediaStream | null;
    localStreamRef: React.RefObject<MediaStream | null>;
    userName: string;
    isMicOn: boolean;
    isCamOn: boolean;
    isSpeakingLocal: boolean;
    localParticipantId: React.MutableRefObject<string>;
    fallbackRemoteParticipants: Participant[];
  }> = ({
    isSharing,
    screenSharerName,
    isLocalScreenSharing,
    stopScreenSharing,
    screenVideoRef,
    isLocalMirrored,
    isHost,
    pinnedParticipantId,
    setPinnedParticipantId,
    handleMuteSingleParticipant,
    handleAllowSingleParticipant,
    handleRemoveSingleParticipant,
    onShowToast,
    setIsSharing,
    setRemoteScreenStream,
    setRemoteScreenTrack,
    localStream,
    localStreamRef,
    userName,
    isMicOn,
    isCamOn,
    isSpeakingLocal,
    localParticipantId,
    fallbackRemoteParticipants,
  }) => {
    const lkParticipants = useParticipants();
    const { localParticipant: lkLocal } = useLocalParticipant();

    // Construct local participant object
    const localParticipantObj: Participant = {
      id: lkLocal?.identity || localParticipantId.current,
      name: lkLocal?.name || userName,
      avatarColor: AVATAR_COLORS[Math.abs((lkLocal?.identity || localParticipantId.current).charCodeAt(0)) % AVATAR_COLORS.length],
      isHost: isHost,
      isMicOn: lkLocal ? lkLocal.isMicrophoneEnabled : isMicOn,
      isCamOn: lkLocal ? lkLocal.isCameraEnabled : isCamOn,
      isSpeaking: lkLocal ? lkLocal.isSpeaking : isSpeakingLocal,
      isLocal: true,
      videoTrack: lkLocal?.getTrackPublication(Track.Source.Camera)?.track || null,
      mediaStream: localStream || localStreamRef.current || undefined,
    };

    // Map LiveKit remote participants + fallback remote participants
    const remoteObjs: Participant[] = lkParticipants && lkParticipants.length > 0
      ? lkParticipants.map((p) => {
          const camPub = p.getTrackPublication(Track.Source.Camera);
          const micPub = p.getTrackPublication(Track.Source.Microphone);
          const videoTrack = camPub?.track || null;
          const isCamActive = Boolean(camPub && !camPub.isMuted && videoTrack);
          const isMicActive = Boolean(micPub && !micPub.isMuted);

          return {
            id: p.identity,
            name: p.name || p.identity,
            avatarColor: AVATAR_COLORS[Math.abs(p.identity.charCodeAt(0)) % AVATAR_COLORS.length],
            isHost: p.permissions?.canPublish === true,
            isMicOn: isMicActive,
            isCamOn: isCamActive,
            isSpeaking: p.isSpeaking,
            isLocal: false,
            videoTrack: videoTrack,
            mediaStream: undefined,
          };
        })
      : fallbackRemoteParticipants;

    const allParticipants: Participant[] = [localParticipantObj, ...remoteObjs];

    return (
      <section className="flex-1 flex flex-col min-h-0 gap-3" aria-label="Main Video Area">
        {/* Active Screen Sharing Presentation */}
        {isSharing && (
          <div className="flex-1 rounded-2xl bg-black text-[#0f172a] relative overflow-hidden flex flex-col shadow-2xl border border-slate-700 min-h-[220px]">
            <div className="absolute top-4 left-4 bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-md z-10">
              <Monitor className="w-3.5 h-3.5" />
              <span>{screenSharerName || 'Screen Share'} is sharing screen</span>
            </div>
            {(isLocalScreenSharing || localScreenStreamRef.current) ? (
              <button
                onClick={stopScreenSharing}
                className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md z-10 transition-colors cursor-pointer"
                title="Stop your screen share"
              >
                <X className="w-3.5 h-3.5" />
                <span>Stop Sharing</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsSharing(false);
                  setRemoteScreenStream(null);
                  setRemoteScreenTrack(null);
                  onShowToast('Closed screen presentation view');
                }}
                className="absolute top-4 right-4 bg-[#1e293b]/90 hover:bg-[#334155] text-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md z-10 transition-colors cursor-pointer border border-slate-600"
                title="Dismiss screen presentation view"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close View</span>
              </button>
            )}
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          </div>
        )}

        {/* Real Participants Video Grid mapping over all participants and rendering VideoTile (fallback to avatar/initials if media tracks not available) */}
        <div
          className={`grid gap-3 flex-1 min-h-0 ${
            isSharing
              ? 'grid-cols-2 sm:grid-cols-4 max-h-[160px]'
              : allParticipants.length === 1
              ? 'grid-cols-1 max-w-3xl mx-auto w-full'
              : allParticipants.length === 2
              ? 'grid-cols-1 sm:grid-cols-2'
              : allParticipants.length <= 4
              ? 'grid-cols-2'
              : 'grid-cols-2 sm:grid-cols-3'
          }`}
        >
          {allParticipants.map((p) => (
            <VideoTile
              key={p.id}
              participant={p}
              mediaStream={p.mediaStream}
              videoTrack={p.videoTrack}
              isLocal={p.isLocal}
              isMirrored={p.isLocal ? isLocalMirrored : false}
              isHostUser={isHost}
              isPinned={pinnedParticipantId === p.id}
              onTogglePin={() =>
                setPinnedParticipantId(pinnedParticipantId === p.id ? null : p.id)
              }
              onMuteParticipant={!p.isLocal ? () => handleMuteSingleParticipant(p.id, p.name) : undefined}
              onAllowParticipant={!p.isLocal ? () => handleAllowSingleParticipant(p.id, p.name) : undefined}
              onRemoveParticipant={!p.isLocal ? () => handleRemoveSingleParticipant(p.id, p.name) : undefined}
            />
          ))}
        </div>
      </section>
    );
  };


  return (
    <div className="h-screen flex flex-col bg-[#0b1020] text-[#e8ecf8] overflow-hidden select-none relative font-sans">
      
      {/* Container for remote audio elements (kept active in DOM without visual intrusion) */}
      <div
        ref={audioContainerRef}
        className="fixed -top-96 -left-96 w-10 h-10 pointer-events-none z-0"
        aria-hidden="true"
      />

      {/* Floating Reactions Layer */}
      <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
        {reactions.map((r) => (
          <div
            key={r.id}
            className="absolute bottom-24 text-3xl floating-reaction pointer-events-none"
            style={{ left: `${r.x}%` }}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* Top Header Bar: Meeting Info & Live Status */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b border-[#252d47] bg-[#0b1020]/95 backdrop-blur-md z-20">
        
        {/* Brand Logo & Meeting Information */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 font-bold font-['Bricolage_Grotesque'] text-base">
            <img
              src="/logo.png"
              alt="VidMeet MMM Logo"
              className="w-7 h-7 object-contain rounded-md shadow-xs bg-white p-0.5"
              referrerPolicy="no-referrer"
            />
            <span>VidMeet</span>
          </div>

          <div className="h-4 w-px bg-[#252d47] hidden sm:block" />

          <div className="flex items-center gap-2 font-medium text-sm">
            <span className="text-white font-semibold truncate max-w-[140px] sm:max-w-none">
              {meetingTitle}
            </span>

            {isHost && (
              <span className="text-xs text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 hidden sm:inline">
                Host
              </span>
            )}

            <button
              onClick={copyMeetingLink}
              className="text-slate-400 hover:text-white font-mono text-xs hidden md:flex items-center gap-1 bg-[#151b30] px-2 py-1 rounded-md border border-[#252d47] transition-colors cursor-pointer"
              title="Click to copy room ID"
            >
              <span>{meetingId}</span>
              {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Live Status and Duration */}
        <div className="flex items-center gap-3">
          {/* Mirror Camera Toggle for Local Preview */}
          <button
            onClick={() => {
              setIsLocalMirrored((prev) => !prev);
              onShowToast(!isLocalMirrored ? 'Camera preview mirrored' : 'Camera preview natural orientation');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border ${
              isLocalMirrored
                ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                : 'bg-[#151b30] text-slate-300 hover:text-white border-[#252d47]'
            }`}
            title="Toggle Mirror Camera for your preview (Default: Natural)"
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isLocalMirrored ? 'Mirrored' : 'Natural'}</span>
          </button>

          {/* Connection Status Indicator */}
          <div className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
            connectionStatus === 'connected'
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : connectionStatus === 'connecting' || connectionStatus === 'reconnecting'
              ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
              : 'text-red-400 bg-red-500/10 border-red-500/20'
          }`}>
            <Radio className={`w-3 h-3 ${connectionStatus === 'connected' ? 'animate-pulse' : 'animate-spin'}`} />
            <span>
              {connectionStatus === 'connected' && 'Connected'}
              {connectionStatus === 'connecting' && 'Connecting'}
              {connectionStatus === 'reconnecting' && 'Reconnecting'}
              {connectionStatus === 'disconnected' && 'Disconnected'}
            </span>
          </div>

          {/* Call Timer */}
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 bg-slate-500/10 border border-slate-500/20 px-2.5 py-1 rounded-full font-mono tabular-nums">
            <span>{formatDuration(durationSeconds)}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex min-h-0 p-3 sm:p-4 gap-3 sm:gap-4 overflow-hidden relative">
        {room ? (
          <LiveKitRoom
            room={room}
            serverUrl={livekitAuth?.serverUrl || 'wss://demo.livekit.cloud'}
            token={livekitAuth?.token || 'dummy-token'}
          >
            <RoomAudioRenderer />
            <LiveKitVideoStage
              isSharing={isSharing}
              screenSharerName={screenSharerName}
              isLocalScreenSharing={isLocalScreenSharing}
              stopScreenSharing={stopScreenSharing}
              screenVideoRef={screenVideoRef}
              isLocalMirrored={isLocalMirrored}
              isHost={isHost}
              pinnedParticipantId={pinnedParticipantId}
              setPinnedParticipantId={setPinnedParticipantId}
              handleMuteSingleParticipant={handleMuteSingleParticipant}
              handleAllowSingleParticipant={handleAllowSingleParticipant}
              handleRemoveSingleParticipant={handleRemoveSingleParticipant}
              onShowToast={onShowToast}
              setIsSharing={setIsSharing}
              setRemoteScreenStream={setRemoteScreenStream}
              setRemoteScreenTrack={setRemoteScreenTrack}
              localStream={localStream}
              localStreamRef={localStreamRef}
              userName={userName}
              isMicOn={isMicOn}
              isCamOn={isCamOn}
              isSpeakingLocal={isSpeakingLocal}
              localParticipantId={localParticipantId}
              fallbackRemoteParticipants={remoteParticipants}
            />
          </LiveKitRoom>
        ) : (
          <section className="flex-1 flex flex-col min-h-0 gap-3" aria-label="Main Video Area">
            {/* Active Screen Sharing Presentation */}
            {isSharing && (
              <div className="flex-1 rounded-2xl bg-black text-[#0f172a] relative overflow-hidden flex flex-col shadow-2xl border border-slate-700 min-h-[220px]">
                <div className="absolute top-4 left-4 bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-md z-10">
                  <Monitor className="w-3.5 h-3.5" />
                  <span>{screenSharerName || 'Screen Share'} is sharing screen</span>
                </div>
                {(isLocalScreenSharing || localScreenStreamRef.current) ? (
                  <button
                    onClick={stopScreenSharing}
                    className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md z-10 transition-colors cursor-pointer"
                    title="Stop your screen share"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Stop Sharing</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setIsSharing(false);
                      setRemoteScreenStream(null);
                      setRemoteScreenTrack(null);
                      onShowToast('Closed screen presentation view');
                    }}
                    className="absolute top-4 right-4 bg-[#1e293b]/90 hover:bg-[#334155] text-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md z-10 transition-colors cursor-pointer border border-slate-600"
                    title="Dismiss screen presentation view"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Close View</span>
                  </button>
                )}
                <video
                  ref={screenVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            {/* Real Participants Video Grid mapping over all participants and rendering VideoTile */}
            <div
              className={`grid gap-3 flex-1 min-h-0 ${
                isSharing
                  ? 'grid-cols-2 sm:grid-cols-4 max-h-[160px]'
                  : allParticipants.length === 1
                  ? 'grid-cols-1 max-w-3xl mx-auto w-full'
                  : allParticipants.length === 2
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : allParticipants.length <= 4
                  ? 'grid-cols-2'
                  : 'grid-cols-2 sm:grid-cols-3'
              }`}
            >
              {allParticipants.map((p) => (
                <VideoTile
                  key={p.id}
                  participant={p}
                  mediaStream={p.mediaStream}
                  videoTrack={p.videoTrack}
                  isLocal={p.isLocal}
                  isMirrored={p.isLocal ? isLocalMirrored : false}
                  isHostUser={isHost}
                  isPinned={pinnedParticipantId === p.id}
                  onTogglePin={() =>
                    setPinnedParticipantId(pinnedParticipantId === p.id ? null : p.id)
                  }
                  onMuteParticipant={!p.isLocal ? () => handleMuteSingleParticipant(p.id, p.name) : undefined}
                  onAllowParticipant={!p.isLocal ? () => handleAllowSingleParticipant(p.id, p.name) : undefined}
                  onRemoveParticipant={!p.isLocal ? () => handleRemoveSingleParticipant(p.id, p.name) : undefined}
                />
              ))}
            </div>
          </section>
        )}
        
        {/* ... (chat, participants) */}

        {/* Reusable Realtime Chat Panel */}
        {activePanel === 'chat' && (
          <aside className="w-80 md:w-96 flex-shrink-0" aria-label="Meeting Chat">
            <ChatPanel
              messages={messages}
              onSendMessage={handleSendMessage}
              onClose={() => setActivePanel(null)}
              isSending={isSendingMessage}
            />
          </aside>
        )}

        {/* Reusable Realtime Participants Panel */}
        {activePanel === 'participants' && (
          <aside className="w-80 md:w-96 flex-shrink-0" aria-label="Participant List">
            <ParticipantList
              participants={allParticipants}
              isHost={isHost}
              onClose={() => setActivePanel(null)}
              onMuteParticipant={(id, name) => handleMuteSingleParticipant(id, name)}
              onAllowParticipant={(id, name) => handleAllowSingleParticipant(id, name)}
              onRemoveParticipant={(id, name) => handleRemoveSingleParticipant(id, name)}
              onMuteAll={() => handleHostAction('mute-all')}
              onAllowAll={() => handleHostAction('allow-all-mic')}
            />
          </aside>
        )}
      </main>

      {/* Reusable Conference Controls Bar */}
      <footer aria-label="Meeting Controls">
        <MeetingControls
          isMicOn={isMicOn}
          isCamOn={isCamOn}
          isSharing={isLocalScreenSharing || Boolean(localScreenStreamRef.current)}
          isMicLockedByHost={!isHost && isMicLockedByHost}
          activePanel={activePanel}
          unreadChatCount={unreadChatCount}
          participantsCount={allParticipants.length}
          isHost={isHost}
          onToggleMic={toggleMic}
          onToggleCam={toggleCam}
          onToggleShare={toggleScreenShare}
          onTogglePanel={(panel) => {
            setActivePanel(activePanel === panel ? null : panel);
            if (panel === 'chat') setUnreadChatCount(0);
          }}
          onLeave={handleLeave}
          onSendReaction={sendReaction}
          onHostAction={handleHostAction}
        />
      </footer>
    </div>
  );
};
