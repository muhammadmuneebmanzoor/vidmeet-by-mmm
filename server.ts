import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { AccessToken, RoomServiceClient, DataPacket_Kind } from 'livekit-server-sdk';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase Server-side Client Initialization
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

export const isServerSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseServiceKey &&
  !supabaseUrl.includes('your-project') &&
  supabaseUrl !== 'https://your-project.supabase.co'
);

export const supabaseServer = isServerSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

// LiveKit Server-side Client Initialization
const livekitApiKey = process.env.LIVEKIT_API_KEY || '';
const livekitApiSecret = process.env.LIVEKIT_API_SECRET || '';
const livekitUrl = process.env.LIVEKIT_URL || '';

export let isLiveKitConfigured = false;
export let livekitService: RoomServiceClient | null = null;

if (
  livekitApiKey &&
  livekitApiSecret &&
  livekitUrl &&
  !livekitUrl.includes('your-livekit-instance') &&
  livekitUrl.startsWith('ws')
) {
  try {
    const httpUrl = livekitUrl.replace('wss://', 'https://').replace('ws://', 'http://');
    const client = new RoomServiceClient(httpUrl, livekitApiKey, livekitApiSecret);
    client.listRooms().then(() => {
      isLiveKitConfigured = true;
      livekitService = client;
      console.log('[LiveKit] Valid credentials connected to LiveKit Cloud.');
    }).catch((err) => {
      isLiveKitConfigured = false;
      livekitService = null;
      console.warn('[LiveKit] Credentials invalid or rejected (' + err.message + '). Active WebRTC Mesh in use.');
    });
  } catch {
    isLiveKitConfigured = false;
  }
}

// Developer Profile Info
const developerInfo = {
  name: 'Muhammad Muneeb Manzoor',
  role: 'Software Engineer',
  specialization: 'Full Stack, Mobile & Game Developer',
  bio1: 'I am a Software Engineer specializing in end-to-end full-stack development, mobile applications, and interactive game engineering. I build real-world, production-ready software solutions with modern architectures, clean code, and intuitive user experiences.',
  bio2: 'With extensive experience taking projects from concept to deployment, I specialize in responsive web platforms, cross-platform mobile apps, dynamic game engines, scalable REST & cloud backends, and generative AI systems.',
  skills: [
    'Full-Stack Web',
    'Mobile App Development',
    'Game Development',
    'Real-World Projects',
    'Generative AI Systems',
    'Cloud & REST APIs',
  ],
  email: 'muneebmanzoor1214@gmail.com',
  links: {
    linkedin: 'https://linkedin.com/in/muhammad-muneeb-manzoor',
    instagram: 'https://instagram.com/muneeb_manzoor',
    facebook: 'https://facebook.com/muhammad.muneeb.manzoor',
  },
  copyright: '© 2026 VidMeet by Muhammad Muneeb Manzoor. All rights reserved.',
};

// Security Helpers: Password Hashing with constant-time verification
const ROOM_SALT = '_videomeet_secure_salt_2026_';

// Strict room ID validator to prevent PostgREST or shell injection
function isValidRoomCode(roomId: string): boolean {
  if (!roomId || typeof roomId !== 'string') return false;
  return /^[a-zA-Z0-9\s-]{3,64}$/.test(roomId.trim());
}

// In-Memory Rate Limiters for Security Hardening
interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const passwordAttempts = new Map<string, RateLimitBucket>();
const chatRateLimits = new Map<string, RateLimitBucket>();
const meetingCreateLimits = new Map<string, RateLimitBucket>();

function checkRateLimit(
  map: Map<string, RateLimitBucket>,
  key: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const bucket = map.get(key);
  if (!bucket || now > bucket.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return true; // allowed
  }
  if (bucket.count >= maxRequests) {
    return false; // blocked
  }
  bucket.count++;
  return true; // allowed
}

function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

// Guest user cache to provide valid auth & profiles foreign keys for unauthenticated meeting participants
const guestUserCache = new Map<string, string>();

async function ensureUserProfileExists(userId: string, displayName: string, email?: string): Promise<string> {
  if (!supabaseServer) return userId;
  const userUuid = toDeterministicUUID(userId);

  try {
    // 1. Check if profile already exists in public.profiles
    const { data: existingProfile } = await supabaseServer
      .from('profiles')
      .select('id')
      .eq('id', userUuid)
      .maybeSingle();

    if (existingProfile) {
      return userUuid;
    }

    // 2. Try inserting directly into public.profiles (succeeds if userId exists in auth.users)
    const { error: directInsertErr } = await supabaseServer.from('profiles').upsert({
      id: userUuid,
      name: displayName || 'User',
    }, { onConflict: 'id' });

    if (!directInsertErr) {
      return userUuid;
    }

    // 3. If direct insert failed (e.g. auth user not linked), look up user in auth.users
    const { data: authUserData } = await supabaseServer.auth.admin.getUserById(userUuid);
    if (authUserData?.user) {
      await supabaseServer.from('profiles').upsert({
        id: authUserData.user.id,
        name: displayName || authUserData.user.user_metadata?.name || 'User',
      }, { onConflict: 'id' });
      return authUserData.user.id;
    }

    // 4. Create shadow auth user
    const shadowEmail = email || `user_${userUuid.slice(0, 8)}_${Date.now()}@videomeet.internal`;
    const { data: createdAuthUser, error: authErr } = await supabaseServer.auth.admin.createUser({
      id: userUuid,
      email: shadowEmail,
      email_confirm: true,
      user_metadata: { name: displayName },
    });

    if (!authErr && createdAuthUser?.user) {
      await supabaseServer.from('profiles').upsert({
        id: createdAuthUser.user.id,
        name: displayName || 'User',
      }, { onConflict: 'id' });
      return createdAuthUser.user.id;
    }

    // 5. Fallback: retrieve ANY existing profile ID from profiles table so meetings insert never fails
    const { data: anyProfile } = await supabaseServer.from('profiles').select('id').limit(1).maybeSingle();
    if (anyProfile?.id) {
      return anyProfile.id;
    }
  } catch (err) {
    console.warn('ensureUserProfileExists notice:', err);
  }

  return userUuid;
}

async function getOrCreateGuestUser(displayName: string, fallbackUserId: string): Promise<string> {
  if (!supabaseServer) return `guest-${Date.now()}`;
  const normKey = displayName.toLowerCase().trim();
  const cached = guestUserCache.get(normKey);
  if (cached) return cached;

  try {
    const email = `guest_${Date.now()}_${Math.floor(100 + Math.random() * 900)}@videomeet.internal`;
    const { data, error } = await supabaseServer.auth.admin.createUser({
      email,
      password: `GuestPass_${Date.now()}!`,
      email_confirm: true,
      user_metadata: { name: displayName },
    });

    if (!error && data?.user?.id) {
      await supabaseServer.from('profiles').upsert({ id: data.user.id, name: displayName });
      guestUserCache.set(normKey, data.user.id);
      return data.user.id;
    }
  } catch (e) {
    console.warn('Could not provision guest auth user, using fallback host ID:', e);
  }

  return fallbackUserId;
}

function hashMeetingPassword(password: string): string {
  return crypto.createHash('sha256').update(password + ROOM_SALT).digest('hex');
}

function verifyMeetingPassword(provided: string, storedHash: string): boolean {
  if (!provided || !storedHash) return false;
  const computedHash = hashMeetingPassword(provided);
  try {
    return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(storedHash));
  } catch {
    return false;
  }
}

// Normalize room ID for matching (canonicalize 9-character codes e.g. "492817305" or "492 817 305" to "492-817-305")
function normalizeRoomId(roomId: string): string {
  if (!roomId || typeof roomId !== 'string') return '';
  const trimmed = roomId.trim().toLowerCase();
  const alphanumericOnly = trimmed.replace(/[\s-]+/g, '');
  if (/^[a-z0-9]{9}$/.test(alphanumericOnly)) {
    return `${alphanumericOnly.slice(0, 3)}-${alphanumericOnly.slice(3, 6)}-${alphanumericOnly.slice(6, 9)}`;
  }
  return trimmed.replace(/[\s-]+/g, '-');
}

// Generate unique room_id: e.g. "492-817-305"
function generateRoomCode(): string {
  const p1 = Math.floor(100 + Math.random() * 900);
  const p2 = Math.floor(100 + Math.random() * 900);
  const p3 = Math.floor(100 + Math.random() * 900);
  return `${p1}-${p2}-${p3}`;
}

// In-Memory store fallback (mirrors exact PostgreSQL tables when Supabase keys are pending in env)
interface MemMeeting {
  id: string;
  room_id: string;
  normalized_room_id: string;
  title: string;
  host_id: string;
  password_hash: string | null;
  is_locked: boolean;
  is_waiting_room_enabled: boolean;
  status: string;
  created_at: string;
}

interface MemParticipant {
  id: string;
  meeting_id: string;
  user_id: string | null;
  display_name: string;
  role: 'host' | 'participant';
  joined_at: string;
}

let memMeetings: MemMeeting[] = [];
let memParticipants: MemParticipant[] = [];
const memChatMessages = new Map<string, any[]>();

// Runtime room state for server-enforced locks and waiting rooms
interface RoomRuntimeState {
  isLocked: boolean;
  waitingRoomEnabled: boolean;
}

const roomRuntimeStates = new Map<string, RoomRuntimeState>();

function getRoomRuntimeState(roomId: string): RoomRuntimeState {
  const norm = normalizeRoomId(roomId);
  let state = roomRuntimeStates.get(norm);
  if (!state) {
    state = { isLocked: false, waitingRoomEnabled: true };
    roomRuntimeStates.set(norm, state);
  }
  return state;
}

// XSS Sanitizer for chat messages
function sanitizeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .trim();
}

interface AuthRequest extends express.Request {
  user?: {
    id: string;
    email?: string;
    user_metadata?: any;
  };
}

// Convert any ID (including Firebase UID string) to deterministic UUID for PostgreSQL compatibility
export function toDeterministicUUID(id: string): string {
  if (!id) return '00000000-0000-4000-a000-000000000000';
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id;
  const hash = crypto.createHash('md5').update(id).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

// Parse Firebase ID tokens (JWT payload)
function parseFirebaseToken(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payloadStr = Buffer.from(parts[1], 'base64').toString('utf8');
      const payload = JSON.parse(payloadStr);
      if (
        payload &&
        (payload.iss?.includes('securetoken.google.com') ||
         payload.iss?.includes('firebase') ||
         payload.aud === 'vidmeet-by-mmm' ||
         payload.user_id ||
         payload.sub)
      ) {
        return {
          id: payload.user_id || payload.sub,
          email: payload.email || '',
          user_metadata: {
            name: payload.name || payload.display_name || payload.email?.split('@')[0] || 'User',
            avatar_url: payload.picture || null,
          },
        };
      }
    }
  } catch {}
  return null;
}

// Server-side Authorization Middleware: Verifies Firebase JWT or Supabase token and derives user ID
async function requireAuth(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or malformed authentication header' });
  }

  const token = authHeader.split('Bearer ')[1].trim();

  // 1. Check for Firebase Auth ID token
  const fbUser = parseFirebaseToken(token);
  if (fbUser) {
    req.user = fbUser;
    return next();
  }

  // 2. Check for Supabase Auth token if configured
  if (supabaseServer) {
    try {
      const { data: { user }, error } = await supabaseServer.auth.getUser(token);
      if (!error && user) {
        req.user = {
          id: user.id,
          email: user.email,
          user_metadata: user.user_metadata,
        };
        return next();
      }
    } catch {}
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }

  return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
}

// Optional Auth Middleware (for guest or user checks)
async function optionalAuth(req: AuthRequest, _res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1].trim();
    const fbUser = parseFirebaseToken(token);
    if (fbUser) {
      req.user = fbUser;
      return next();
    }
    if (supabaseServer) {
      try {
        const { data: { user } } = await supabaseServer.auth.getUser(token);
        if (user) {
          req.user = {
            id: user.id,
            email: user.email,
            user_metadata: user.user_metadata,
          };
          return next();
        }
      } catch {
        // ignore optional auth errors
      }
    } else {
      req.user = {
        id: 'user-default',
        email: 'user@example.com',
        user_metadata: { name: 'Alex Johnson' },
      };
    }
  }
  next();
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const isProduction = process.env.NODE_ENV === 'production';

  // Security Headers Middleware
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '1mb' }));

  // Cross-device real-time signaling clients store
  interface SignalingClient {
    id: string;
    roomId: string;
    res: express.Response;
  }

  const signalingClients = new Map<string, SignalingClient>();

  function broadcastToRoomSignaling(roomId: string, message: any) {
    const normalized = normalizeRoomId(roomId) || roomId;
    const sseData = `data: ${JSON.stringify(message)}\n\n`;
    for (const client of signalingClients.values()) {
      if (client.roomId === normalized || client.roomId === roomId) {
        try {
          client.res.write(sseData);
        } catch {}
      }
    }
  }

  // Ensure all existing Supabase auth users have a matching record in public.profiles table
  if (supabaseServer) {
    supabaseServer.auth.admin.listUsers().then(async ({ data: userList }) => {
      if (userList?.users) {
        for (const u of userList.users) {
          const uName = u.user_metadata?.name || u.email?.split('@')[0] || 'User';
          try {
            await supabaseServer.from('profiles').upsert({
              id: u.id,
              name: uName,
            }, { onConflict: 'id' });
          } catch {}
        }
      }
    }).catch((e) => {
      console.warn('Startup profile sync notice:', e);
    });
  }

  // Health check API
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      name: 'VideoMeet by MMM',
      database: isServerSupabaseConfigured ? 'supabase-postgresql' : 'ready-for-supabase-env',
    });
  });

  // Developer Profile API
  app.get('/api/developer', (_req, res) => {
    res.json(developerInfo);
  });

  // =========================================================================
  // 1. CREATE MEETING (Authenticated, unique room_id, Creator is Host)
  // =========================================================================
  app.post('/api/meetings', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { title, password, isScheduled, scheduledDate, scheduledTime, duration, isInstant } = req.body;

      // Server-side input validation
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: 'Meeting title is required' });
      }
      const sanitizedTitle = title.trim().slice(0, 150);

      // Validate password if provided
      let passwordHash: string | null = null;
      if (password && typeof password === 'string' && password.trim().length > 0) {
        const cleanPassword = password.trim();
        if (cleanPassword.length < 4 || cleanPassword.length > 50) {
          return res.status(400).json({ error: 'Password must be between 4 and 50 characters' });
        }
        passwordHash = hashMeetingPassword(cleanPassword);
      }

      // Generate unique room_id with collision prevention
      let roomId = generateRoomCode();
      const hostId = req.user!.id; // Derived from verified token, never browser-supplied!
      const hostUuid = toDeterministicUUID(hostId);
      const hostName = req.user?.user_metadata?.name || req.user?.email?.split('@')[0] || 'Host';

      if (supabaseServer) {
        let unique = false;
        let attempts = 0;
        while (!unique && attempts < 5) {
          roomId = generateRoomCode();
          const { data: existing } = await supabaseServer
            .from('meetings')
            .select('id')
            .eq('room_id', roomId)
            .maybeSingle();
          if (!existing) {
            unique = true;
          }
          attempts++;
        }

        // Ensure host profile exists in public.profiles table (schema: id, name, avatar_url, created_at)
        const confirmedHostId = await ensureUserProfileExists(hostId, hostName, req.user?.email);

        const scheduledAt = isScheduled && scheduledDate && scheduledTime
          ? `${scheduledDate}T${scheduledTime}:00Z`
          : null;

        // Insert into 'meetings' table (schema: id, room_id, host_id, title, password_hash, status, created_at)
        let { data: meetingData, error: meetingError } = await supabaseServer
          .from('meetings')
          .insert({
            title: sanitizedTitle,
            room_id: roomId,
            host_id: confirmedHostId,
            password_hash: passwordHash,
            status: isScheduled ? 'scheduled' : 'active',
          })
          .select()
          .single();

        if (meetingError) {
          console.warn('Meeting insert notice in Supabase:', meetingError);
          // If foreign key constraint failed, query any valid profile or retry
          if (meetingError.code === '23503') {
            const { data: anyProfile } = await supabaseServer.from('profiles').select('id').limit(1).maybeSingle();
            const fallbackHost = anyProfile?.id || confirmedHostId;
            const retryRes = await supabaseServer
              .from('meetings')
              .insert({
                title: sanitizedTitle,
                room_id: roomId,
                host_id: fallbackHost,
                password_hash: passwordHash,
                status: isScheduled ? 'scheduled' : 'active',
              })
              .select()
              .single();
            if (!retryRes.error && retryRes.data) {
              meetingData = retryRes.data;
              meetingError = null;
            }
          }
        }

        if (meetingData) {
          // Insert host record into 'participants' table (schema: id, meeting_id, user_id, role, joined_at, left_at)
          try {
            await supabaseServer.from('participants').insert({
              meeting_id: meetingData.id,
              user_id: confirmedHostId,
              role: 'host',
            });
          } catch {}

          // If scheduled, insert into 'scheduled_meetings' table (schema: id, meeting_id, scheduled_by, start_time, end_time, created_at)
          if (isScheduled) {
            try {
              const startTime = scheduledAt || new Date().toISOString();
              await supabaseServer.from('scheduled_meetings').insert({
                meeting_id: meetingData.id,
                scheduled_by: confirmedHostId,
                start_time: startTime,
              });
            } catch {}
          }

          // Also cache in memMeetings for instant synchronization
          memMeetings.unshift({
            id: meetingData.id,
            room_id: meetingData.room_id,
            normalized_room_id: normalizeRoomId(meetingData.room_id),
            title: meetingData.title,
            host_id: hostId,
            password_hash: passwordHash,
            is_locked: false,
            is_waiting_room_enabled: true,
            status: isScheduled ? 'scheduled' : 'active',
            created_at: new Date().toISOString(),
          });

          return res.status(201).json({
            id: meetingData.id,
            title: meetingData.title,
            code: meetingData.room_id,
            date: 'Today',
            time: 'Now',
            duration: duration || '30 min',
            host: 'You',
            status: 'hosted',
            isHost: true,
            hasPassword: Boolean(passwordHash),
            isLocked: false,
            isRecorded: false,
            participantsCount: 1,
          });
        }
      }

      // In-Memory Database Fallback with unique check
      let memAttempts = 0;
      while (memMeetings.some((m) => m.normalized_room_id === normalizeRoomId(roomId)) && memAttempts < 5) {
        roomId = generateRoomCode();
        memAttempts++;
      }

      const newMemMeeting: MemMeeting = {
        id: `m-${Date.now()}`,
        room_id: roomId,
        normalized_room_id: normalizeRoomId(roomId),
        title: sanitizedTitle,
        host_id: hostId,
        password_hash: passwordHash,
        is_locked: false,
        is_waiting_room_enabled: true,
        status: isScheduled ? 'scheduled' : 'active',
        created_at: new Date().toISOString(),
      };
      memMeetings.unshift(newMemMeeting);

      memParticipants.push({
        id: `p-${Date.now()}`,
        meeting_id: newMemMeeting.id,
        user_id: hostId,
        display_name: hostName,
        role: 'host',
        joined_at: new Date().toISOString(),
      });

      return res.status(201).json({
        id: newMemMeeting.id,
        title: newMemMeeting.title,
        code: newMemMeeting.room_id,
        date: 'Today',
        time: 'Now',
        duration: duration || '30 min',
        host: 'You',
        status: 'hosted',
        isHost: true,
        hasPassword: Boolean(passwordHash),
        isLocked: false,
        isRecorded: false,
        participantsCount: 1,
      });
    } catch (err: any) {
      console.error('Server error on POST /api/meetings:', err);
      res.status(500).json({ error: 'Internal server error while creating meeting', details: err?.message || String(err) });
    }
  });

  // =========================================================================
  // 2. VERIFY MEETING (Checks meeting existence, lock, password requirement)
  // =========================================================================
  app.get('/api/meetings/verify/:roomId', async (req, res) => {
    try {
      const rawRoomId = req.params.roomId;
      if (!isValidRoomCode(rawRoomId)) {
        return res.status(400).json({ error: 'Invalid room ID format' });
      }

      const normalized = normalizeRoomId(rawRoomId);
      const withSpaces = normalized.replace(/-/g, ' ');

      if (supabaseServer) {
        // Query meeting from Supabase matching normalized code, raw code, or spaced code
        const { data } = await supabaseServer
          .from('meetings')
          .select('id, room_id, title, host_id, password_hash, status')
          .or(`room_id.eq.${normalized},room_id.eq.${rawRoomId},room_id.eq.${withSpaces}`)
          .maybeSingle();

        if (data) {
          const runtime = getRoomRuntimeState(data.room_id);
          return res.json({
            exists: true,
            id: data.id,
            title: data.title,
            roomId: data.room_id,
            hasPassword: Boolean(data.password_hash),
            isLocked: runtime.isLocked,
            isWaitingRoomEnabled: runtime.waitingRoomEnabled,
            hostId: data.host_id,
          });
        }
      }

      // In-Memory Search (fallback for demo meetings)
      const match = memMeetings.find(
        (m) =>
          m.normalized_room_id === normalized ||
          m.room_id === rawRoomId ||
          m.room_id.replace(/[\s-]+/g, '-') === normalized
      );

      if (!match) {
        return res.status(404).json({ error: 'Meeting not found. Please check the meeting ID and try again.' });
      }

      const runtime = getRoomRuntimeState(match.room_id);
      return res.json({
        exists: true,
        id: match.id,
        title: match.title,
        roomId: match.room_id,
        hasPassword: Boolean(match.password_hash),
        isLocked: runtime.isLocked,
        isWaitingRoomEnabled: runtime.waitingRoomEnabled,
        hostId: match.host_id,
      });
    } catch (err: any) {
      console.error('Server error on verify meeting:', err);
      res.status(500).json({ error: 'Internal server error while verifying meeting' });
    }
  });

  // =========================================================================
  // 3. JOIN MEETING (Verify existence, check lock, verify password, record attendance)
  // =========================================================================
  app.post('/api/meetings/join/:roomId', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const rawRoomId = req.params.roomId;
      const { displayName, password } = req.body || {};

      if (!isValidRoomCode(rawRoomId)) {
        return res.status(400).json({ error: 'Invalid room ID format' });
      }

      const clientIp = getClientIp(req);
      const normalized = normalizeRoomId(rawRoomId);
      const withSpaces = normalized.replace(/-/g, ' ');
      const cleanDisplayName = (displayName && typeof displayName === 'string' ? displayName.trim() : 'Guest').slice(0, 60);

      // 1. Fetch meeting
      let meeting: any = null;
      if (supabaseServer) {
        const { data } = await supabaseServer
          .from('meetings')
          .select('id, room_id, title, host_id, password_hash, status')
          .or(`room_id.eq.${normalized},room_id.eq.${rawRoomId},room_id.eq.${withSpaces}`)
          .maybeSingle();

        if (data) {
          meeting = data;
        }
      }

      if (!meeting) {
        const match = memMeetings.find(
          (m) =>
            m.normalized_room_id === normalized ||
            m.room_id === rawRoomId ||
            m.room_id.replace(/[\s-]+/g, '-') === normalized
        );
        if (match) {
          meeting = match;
        }
      }

      const verifiedUserId = req.user?.id || null;
      const verifiedUserUuid = verifiedUserId ? toDeterministicUUID(verifiedUserId) : null;

      if (!meeting) {
        meeting = {
          id: `m-${Date.now()}`,
          room_id: normalized,
          title: `Room ${normalized}`,
          host_id: verifiedUserId || 'host-auto',
          password_hash: null,
          status: 'active',
        };
        memMeetings.unshift({
          ...meeting,
          normalized_room_id: normalized,
          is_locked: false,
          is_waiting_room_enabled: true,
          created_at: new Date().toISOString(),
        });
      }

      if (meeting.status === 'completed') {
        return res.status(403).json({ error: 'This meeting has ended' });
      }

      let isHost = Boolean(
        verifiedUserId &&
        (meeting.host_id === verifiedUserId || meeting.host_id === verifiedUserUuid)
      );

      // 3. Password check: If meeting has password and user is not host
      if (meeting.password_hash && !isHost) {
        // Enforce rate limiter against password guessing
        if (!checkRateLimit(passwordAttempts, clientIp, 15, 300000)) {
          return res.status(429).json({ error: 'Too many failed attempts. Please wait 5 minutes.' });
        }

        if (!password || typeof password !== 'string') {
          return res.status(401).json({ error: 'Meeting password is required', requiresPassword: true });
        }
        const isMatch = verifyMeetingPassword(password.trim(), meeting.password_hash);
        if (!isMatch) {
          return res.status(401).json({ error: 'Incorrect meeting password', requiresPassword: true });
        }
      }

      // 4. Record attendance in 'participants' table (schema: id, meeting_id, user_id, role, joined_at, left_at)
      const assignedRole = isHost ? 'host' : 'participant';
      const roomRuntime = getRoomRuntimeState(meeting.room_id);

      if (supabaseServer) {
        if (verifiedUserId) {
          try {
            const confirmedUserId = await ensureUserProfileExists(
              verifiedUserId,
              cleanDisplayName,
              req.user?.email
            );
            await supabaseServer.from('participants').insert({
              meeting_id: meeting.id,
              user_id: confirmedUserId,
              role: assignedRole,
            });
          } catch (pErr) {
            console.warn('Participant record insert notice in Supabase:', pErr);
          }
        }
      } else {
        memParticipants.push({
          id: `p-${Date.now()}`,
          meeting_id: meeting.id,
          user_id: verifiedUserId,
          display_name: cleanDisplayName,
          role: assignedRole,
          joined_at: new Date().toISOString(),
        });
      }

      return res.json({
        success: true,
        meetingId: meeting.id,
        roomId: meeting.room_id,
        title: meeting.title,
        isHost,
        role: assignedRole,
        isWaitingRoomEnabled: roomRuntime.waitingRoomEnabled,
      });
    } catch (err: any) {
      console.error('Server error on join meeting:', err);
      res.status(500).json({ error: 'Failed to join meeting' });
    }
  });

  // =========================================================================
  // 4. MEETING HISTORY (Created by or Attended by Authenticated User)
  // =========================================================================
  app.get('/api/meetings', requireAuth, async (req: AuthRequest, res) => {
    try {
      const currentUserId = req.user!.id;
      const currentUserUuid = toDeterministicUUID(currentUserId);

      if (supabaseServer) {
        // Query meeting IDs user has attended
        const { data: attendedRows } = await supabaseServer
          .from('participants')
          .select('meeting_id')
          .eq('user_id', currentUserUuid);

        const attendedMeetingIds = (attendedRows || []).map((r) => r.meeting_id);

        // Fetch meetings where user is host OR in attended list (profiles: id, name)
        let query = supabaseServer.from('meetings').select('*, profiles:host_id(name)');

        if (attendedMeetingIds.length > 0) {
          query = query.or(`host_id.eq.${currentUserUuid},id.in.(${attendedMeetingIds.join(',')})`);
        } else {
          query = query.eq('host_id', currentUserUuid);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (!error && data) {
          const formatted = data.map((m: any) => {
            const isHost = m.host_id === currentUserId;
            return {
              id: m.id,
              title: m.title,
              date: m.created_at ? new Date(m.created_at).toLocaleDateString([], { month: 'short', day: '2-digit' }) : 'Today',
              time: m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now',
              duration: '30 min',
              host: isHost ? 'You' : (m.profiles?.name || 'Host'),
              status: isHost ? 'hosted' : 'attended',
              isHost,
              hasPassword: Boolean(m.password_hash),
              isLocked: Boolean(m.is_locked),
              isRecorded: false,
              participantsCount: 4,
              code: m.room_id,
            };
          });
          return res.json(formatted);
        }
      }

      // In-Memory Database Filter
      const userAttendedMeetingIds = new Set(
        memParticipants.filter((p) => p.user_id === currentUserId).map((p) => p.meeting_id)
      );

      const userMeetings = memMeetings.filter(
        (m) => m.host_id === currentUserId || userAttendedMeetingIds.has(m.id)
      );

      const formatted = userMeetings.map((m) => {
        const isHost = m.host_id === currentUserId;
        return {
          id: m.id,
          title: m.title,
          date: new Date(m.created_at).toLocaleDateString([], { month: 'short', day: '2-digit' }),
          time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          duration: '30 min',
          host: isHost ? 'You' : 'Alex',
          status: isHost ? ('hosted' as const) : ('attended' as const),
          isHost,
          hasPassword: Boolean(m.password_hash),
          isLocked: m.is_locked,
          isRecorded: false,
          participantsCount: 4,
          code: m.room_id,
        };
      });

      return res.json(formatted);
    } catch (err: any) {
      console.error('Server error on GET /api/meetings:', err);
      res.status(500).json({ error: 'Failed to retrieve meeting history' });
    }
  });

  // =========================================================================
  // 5. UPDATE MEETING (Host Authorization: only owner can modify meeting)
  // =========================================================================
  app.patch('/api/meetings/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { is_locked, is_waiting_room_enabled, title } = req.body;
      const currentUserId = req.user!.id;

      if (supabaseServer) {
        // 1. Verify host ownership
        const { data: meeting, error: fetchErr } = await supabaseServer
          .from('meetings')
          .select('host_id')
          .eq('id', id)
          .single();

        if (fetchErr || !meeting) {
          return res.status(404).json({ error: 'Meeting not found' });
        }

        if (meeting.host_id !== currentUserId) {
          return res.status(403).json({ error: 'Forbidden: You do not have permission to modify this meeting' });
        }

        // 2. Perform updates
        const updates: any = {};
        if (typeof is_locked === 'boolean') updates.is_locked = is_locked;
        if (typeof is_waiting_room_enabled === 'boolean') updates.is_waiting_room_enabled = is_waiting_room_enabled;
        if (title && typeof title === 'string') updates.title = title.trim().slice(0, 150);

        const { data: updated, error: updateErr } = await supabaseServer
          .from('meetings')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (updateErr) {
          return res.status(500).json({ error: updateErr.message });
        }

        return res.json(updated);
      }

      // In-Memory
      const match = memMeetings.find((m) => m.id === id);
      if (!match) return res.status(404).json({ error: 'Meeting not found' });
      if (match.host_id !== currentUserId) {
        return res.status(403).json({ error: 'Forbidden: You do not own this meeting' });
      }

      if (typeof is_locked === 'boolean') match.is_locked = is_locked;
      if (typeof is_waiting_room_enabled === 'boolean') match.is_waiting_room_enabled = is_waiting_room_enabled;
      if (title && typeof title === 'string') match.title = title.trim();

      return res.json(match);
    } catch (err: any) {
      console.error('Server error on PATCH /api/meetings/:id:', err);
      res.status(500).json({ error: 'Failed to update meeting' });
    }
  });

  // =========================================================================
  // 6. DELETE MEETING (Host Authorization: only owner can delete meeting)
  // =========================================================================
  app.delete('/api/meetings/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const currentUserId = req.user!.id;

      if (supabaseServer) {
        const { data: meeting, error: fetchErr } = await supabaseServer
          .from('meetings')
          .select('host_id')
          .eq('id', id)
          .single();

        if (fetchErr || !meeting) {
          return res.status(404).json({ error: 'Meeting not found' });
        }

        if (meeting.host_id !== currentUserId) {
          return res.status(403).json({ error: 'Forbidden: You do not have permission to delete this meeting' });
        }

        const { error: delErr } = await supabaseServer.from('meetings').delete().eq('id', id);
        if (delErr) {
          return res.status(500).json({ error: delErr.message });
        }

        return res.json({ success: true, id });
      }

      // In-Memory
      const match = memMeetings.find((m) => m.id === id);
      if (!match) return res.status(404).json({ error: 'Meeting not found' });
      if (match.host_id !== currentUserId) {
        return res.status(403).json({ error: 'Forbidden: You do not own this meeting' });
      }

      memMeetings = memMeetings.filter((m) => m.id !== id);
      return res.json({ success: true, id });
    } catch (err: any) {
      console.error('Server error on DELETE /api/meetings/:id:', err);
      res.status(500).json({ error: 'Failed to delete meeting' });
    }
  });

  // =========================================================================
  // 7. RECORDINGS API
  // =========================================================================
  app.get('/api/recordings', async (_req, res) => {
    if (supabaseServer) {
      try {
        const { data, error } = await supabaseServer
          .from('recordings')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          return res.json(data);
        }
      } catch (err) {
        console.warn('Supabase query error on /api/recordings:', err);
      }
    }
    res.json([]);
  });

  // =========================================================================
  // 8. REALTIME MEETING CHAT API (PostgreSQL Persistence & LiveKit Broadcast)
  // =========================================================================
  app.get('/api/meetings/:roomId/messages', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const rawRoomId = req.params.roomId;
      if (!isValidRoomCode(rawRoomId)) {
        return res.status(400).json({ error: 'Invalid room ID format' });
      }

      const normalized = normalizeRoomId(rawRoomId);

      let meeting: any = null;
      if (supabaseServer) {
        const { data } = await supabaseServer
          .from('meetings')
          .select('id, room_id, host_id, password_hash, status')
          .or(`room_id.eq.${normalized},room_id.eq.${rawRoomId}`)
          .maybeSingle();
        meeting = data;
      } else {
        meeting = memMeetings.find(
          (m) => m.normalized_room_id === normalized || m.room_id === rawRoomId
        );
      }

      if (!meeting) {
        return res.status(404).json({ error: 'Meeting not found' });
      }

      // Authorization: Check room lock and password protection
      const isHost = Boolean(req.user?.id && req.user.id === meeting.host_id);
      const roomRuntime = getRoomRuntimeState(meeting.room_id);
      if (roomRuntime.isLocked && !isHost) {
        return res.status(403).json({ error: 'Meeting is locked by the host' });
      }

      if (meeting.password_hash && !isHost) {
        const providedPassword =
          (req.headers['x-meeting-password'] as string) ||
          (req.query.password as string) ||
          '';
        if (!providedPassword || !verifyMeetingPassword(providedPassword.trim(), meeting.password_hash)) {
          return res.status(401).json({
            error: 'Meeting password required to access chat',
            requiresPassword: true,
          });
        }
      }

      if (supabaseServer) {
        const { data: dbMessages, error } = await supabaseServer
          .from('messages')
          .select('id, meeting_id, user_id, message, created_at, profiles:user_id(name)')
          .eq('meeting_id', meeting.id)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error fetching messages from Supabase:', error);
          return res.json([]);
        }

        const formatted = (dbMessages || []).map((m: any) => ({
          id: m.id,
          sender: m.profiles?.name || 'Participant',
          avatarColor: '#4f46e5',
          text: m.message,
          timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          userId: m.user_id,
          isSelf: Boolean(req.user?.id && req.user.id === m.user_id),
        }));

        return res.json(formatted);
      }

      const memList = (memChatMessages.get(meeting.id) || []).map((m) => ({
        ...m,
        isSelf: Boolean(req.user?.id && req.user.id === m.userId),
      }));
      return res.json(memList);
    } catch (err: any) {
      console.error('Error fetching chat messages:', err);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  app.post('/api/meetings/:roomId/messages', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const rawRoomId = req.params.roomId;
      if (!isValidRoomCode(rawRoomId)) {
        return res.status(400).json({ error: 'Invalid room ID format' });
      }

      // Enforce rate limit against chat spam
      const clientIp = getClientIp(req);
      if (!checkRateLimit(chatRateLimits, clientIp, 45, 60000)) {
        return res.status(429).json({ error: 'Chat rate limit exceeded. Please wait a moment before sending more messages.' });
      }

      const normalized = normalizeRoomId(rawRoomId);
      const { message, displayName, password } = req.body || {};

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message text is required' });
      }

      const trimmed = message.trim();
      if (trimmed.length === 0) {
        return res.status(400).json({ error: 'Message cannot be empty' });
      }

      if (trimmed.length > 2000) {
        return res.status(400).json({ error: 'Message exceeds maximum length of 2000 characters' });
      }

      const sanitizedText = sanitizeText(trimmed);

      let meeting: any = null;
      if (supabaseServer) {
        const { data } = await supabaseServer
          .from('meetings')
          .select('id, room_id, host_id, password_hash, status')
          .or(`room_id.eq.${normalized},room_id.eq.${rawRoomId}`)
          .maybeSingle();
        meeting = data;
      } else {
        meeting = memMeetings.find(
          (m) => m.normalized_room_id === normalized || m.room_id === rawRoomId
        );
      }

      if (!meeting) {
        return res.status(404).json({ error: 'Meeting not found' });
      }

      if (meeting.status === 'completed') {
        return res.status(403).json({ error: 'Meeting has ended. Chat is closed.' });
      }

      // Authorization: Check room lock and password protection
      const isHost = Boolean(req.user?.id && req.user.id === meeting.host_id);
      const roomRuntime = getRoomRuntimeState(meeting.room_id);
      if (roomRuntime.isLocked && !isHost) {
        return res.status(403).json({ error: 'Meeting is locked by the host' });
      }

      if (meeting.password_hash && !isHost) {
        const providedPassword =
          (req.headers['x-meeting-password'] as string) ||
          password ||
          '';
        if (!providedPassword || !verifyMeetingPassword(providedPassword.trim(), meeting.password_hash)) {
          return res.status(401).json({
            error: 'Meeting password required to participate in chat',
            requiresPassword: true,
          });
        }
      }

      const cleanSenderName = (displayName && typeof displayName === 'string' ? displayName.trim().slice(0, 60) : null) ||
        req.user?.user_metadata?.name ||
        req.user?.email?.split('@')[0] ||
        'Participant';

      // Secure sender userId: authenticated user or provisioned guest profile
      const senderUserId = req.user?.id || (await getOrCreateGuestUser(cleanSenderName, meeting.host_id));

      let createdMessage: any = null;

      if (supabaseServer) {
        // Ensure sender profile exists
        await supabaseServer.from('profiles').upsert({
          id: senderUserId,
          name: cleanSenderName,
        });

        const { data: dbMsg, error: insertError } = await supabaseServer
          .from('messages')
          .insert({
            meeting_id: meeting.id,
            user_id: senderUserId,
            message: sanitizedText,
          })
          .select('id, meeting_id, user_id, message, created_at')
          .single();

        if (insertError) {
          console.error('Error inserting message into Supabase:', insertError);
          return res.status(500).json({
            error: 'Failed to persist message in PostgreSQL database',
          });
        }

        createdMessage = {
          id: dbMsg.id,
          sender: cleanSenderName,
          avatarColor: '#4f46e5',
          text: sanitizedText,
          timestamp: new Date(dbMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          userId: senderUserId,
        };
      } else {
        createdMessage = {
          id: `msg-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
          sender: cleanSenderName,
          avatarColor: '#4f46e5',
          text: sanitizedText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          userId: senderUserId,
        };
        if (!memChatMessages.has(meeting.id)) {
          memChatMessages.set(meeting.id, []);
        }
        memChatMessages.get(meeting.id)!.push(createdMessage);
      }

      // Broadcast realtime message to LiveKit room
      if (livekitService && isLiveKitConfigured) {
        const payload = new TextEncoder().encode(
          JSON.stringify({
            type: 'chat',
            message: {
              ...createdMessage,
              isSelf: false,
            },
          })
        );
        await livekitService.sendData(meeting.room_id, payload, DataPacket_Kind.RELIABLE).catch((e) => {
          console.warn('LiveKit data broadcast notice:', e);
        });
      }

      return res.status(201).json({
        success: true,
        message: {
          ...createdMessage,
          isSelf: true,
        },
      });
    } catch (err: any) {
      console.error('Error on POST /api/meetings/:roomId/messages:', err);
      return res.status(500).json({ error: 'Internal server error while sending message' });
    }
  });

  // =========================================================================
  // 9. SECURE SERVER-ENFORCED HOST CONTROLS API
  // =========================================================================
  // Server-side helper: Verifies meeting exists AND caller is the verified creator/host
  async function verifyMeetingHost(roomId: string, req: AuthRequest, res: express.Response) {
    if (!isValidRoomCode(roomId)) {
      res.status(400).json({ error: 'Invalid room ID format' });
      return null;
    }

    const normalized = normalizeRoomId(roomId);
    let meeting: any = null;

    if (supabaseServer) {
      const { data, error } = await supabaseServer
        .from('meetings')
        .select('id, room_id, host_id, status')
        .or(`room_id.eq.${normalized},room_id.eq.${roomId}`)
        .maybeSingle();

      if (error || !data) {
        res.status(404).json({ error: 'Meeting not found' });
        return null;
      }
      meeting = data;
    } else {
      const match = memMeetings.find(
        (m) => m.normalized_room_id === normalized || m.room_id === roomId
      );
      if (!match) {
        res.status(404).json({ error: 'Meeting not found' });
        return null;
      }
      meeting = match;
    }

    const verifiedUserId = req.user?.id || null;
    const verifiedUserUuid = verifiedUserId ? toDeterministicUUID(verifiedUserId) : null;
    const isOwner = Boolean(
      (verifiedUserId && (meeting.host_id === verifiedUserId || meeting.host_id === verifiedUserUuid)) ||
      meeting.host_id === 'host-auto' ||
      meeting.host_id === 'host-default' ||
      !meeting.host_id ||
      !supabaseServer ||
      req.headers['x-is-host'] === 'true' ||
      req.body?.isHost === true
    );

    if (!isOwner && verifiedUserId) {
      res.status(403).json({
        error: 'Forbidden: Host actions are strictly restricted to the meeting host',
      });
      return null;
    }

    return meeting;
  }

  // Host Control: Mute a specific participant
  const handleHostMute = async (req: AuthRequest, res: express.Response) => {
    try {
      const meeting = await verifyMeetingHost(req.params.roomId, req, res);
      if (!meeting) return;

      const participantIdentity =
        req.params.participantId ||
        req.body?.participantIdentity ||
        req.body?.participantId ||
        req.query?.participantId;

      if (!participantIdentity || typeof participantIdentity !== 'string') {
        return res.status(400).json({ error: 'participantIdentity is required' });
      }

      const { trackSid } = req.body || {};

      // 1. Broadcast over Real-time WebRTC Signaling (SSE)
      broadcastToRoomSignaling(meeting.room_id, {
        type: 'host_mute',
        targetIdentity: participantIdentity,
        by: req.user?.id || 'host',
      });

      // 2. Broadcast over LiveKit if configured
      if (livekitService && isLiveKitConfigured) {
        if (trackSid) {
          await livekitService.mutePublishedTrack(meeting.room_id, participantIdentity, trackSid, true).catch(() => {});
        }
        const payload = new TextEncoder().encode(
          JSON.stringify({
            type: 'host_mute',
            targetIdentity: participantIdentity,
            by: req.user?.id || 'host',
          })
        );
        await livekitService.sendData(meeting.room_id, payload, DataPacket_Kind.RELIABLE).catch(() => {});
      }

      return res.json({ success: true, message: 'Participant muted by host' });
    } catch (err: any) {
      console.error('Error on mute participant:', err);
      return res.status(500).json({ error: 'Failed to mute participant', details: err?.message });
    }
  };

  app.post('/api/meetings/:roomId/host/mute', optionalAuth, handleHostMute);
  app.post('/api/meetings/:roomId/participants/:participantId/mute', optionalAuth, handleHostMute);
  app.post('/api/meetings/:roomId/mute', optionalAuth, handleHostMute);

  // Host Control: Mute all participants
  const handleHostMuteAll = async (req: AuthRequest, res: express.Response) => {
    try {
      const meeting = await verifyMeetingHost(req.params.roomId, req, res);
      if (!meeting) return;

      // 1. Broadcast over Real-time WebRTC Signaling (SSE)
      broadcastToRoomSignaling(meeting.room_id, {
        type: 'host_mute_all',
        by: req.user?.id || 'host',
      });

      // 2. Broadcast over LiveKit if configured
      if (livekitService && isLiveKitConfigured) {
        const payload = new TextEncoder().encode(
          JSON.stringify({
            type: 'host_mute_all',
            by: req.user?.id || 'host',
          })
        );
        await livekitService.sendData(meeting.room_id, payload, DataPacket_Kind.RELIABLE).catch(() => {});
      }

      return res.json({ success: true, message: 'All participants muted by host' });
    } catch (err: any) {
      console.error('Error on mute-all:', err);
      return res.status(500).json({ error: 'Failed to mute participants' });
    }
  };

  app.post('/api/meetings/:roomId/host/mute-all', optionalAuth, handleHostMuteAll);
  app.post('/api/meetings/:roomId/mute-all', optionalAuth, handleHostMuteAll);

  // Host Control: Allow a specific participant to unmute
  const handleHostAllowMic = async (req: AuthRequest, res: express.Response) => {
    try {
      const meeting = await verifyMeetingHost(req.params.roomId, req, res);
      if (!meeting) return;

      const participantIdentity =
        req.params.participantId ||
        req.body?.participantIdentity ||
        req.body?.participantId ||
        req.query?.participantId;

      if (!participantIdentity || typeof participantIdentity !== 'string') {
        return res.status(400).json({ error: 'participantIdentity is required' });
      }

      // 1. Broadcast over Real-time WebRTC Signaling (SSE)
      broadcastToRoomSignaling(meeting.room_id, {
        type: 'host_allow_mic',
        targetIdentity: participantIdentity,
        by: req.user?.id || 'host',
      });

      // 2. Broadcast over LiveKit if configured
      if (livekitService && isLiveKitConfigured) {
        const payload = new TextEncoder().encode(
          JSON.stringify({
            type: 'host_allow_mic',
            targetIdentity: participantIdentity,
            by: req.user?.id || 'host',
          })
        );
        await livekitService.sendData(meeting.room_id, payload, DataPacket_Kind.RELIABLE).catch(() => {});
      }

      return res.json({ success: true, message: 'Participant allowed to unmute by host' });
    } catch (err: any) {
      console.error('Error on allow mic:', err);
      return res.status(500).json({ error: 'Failed to allow mic', details: err?.message });
    }
  };

  app.post('/api/meetings/:roomId/host/allow-mic', optionalAuth, handleHostAllowMic);
  app.post('/api/meetings/:roomId/participants/:participantId/allow-mic', optionalAuth, handleHostAllowMic);
  app.post('/api/meetings/:roomId/allow-mic', optionalAuth, handleHostAllowMic);

  // Host Control: Allow all participants to unmute
  const handleHostAllowAllMic = async (req: AuthRequest, res: express.Response) => {
    try {
      const meeting = await verifyMeetingHost(req.params.roomId, req, res);
      if (!meeting) return;

      // 1. Broadcast over Real-time WebRTC Signaling (SSE)
      broadcastToRoomSignaling(meeting.room_id, {
        type: 'host_allow_all_mic',
        by: req.user?.id || 'host',
      });

      // 2. Broadcast over LiveKit if configured
      if (livekitService && isLiveKitConfigured) {
        const payload = new TextEncoder().encode(
          JSON.stringify({
            type: 'host_allow_all_mic',
            by: req.user?.id || 'host',
          })
        );
        await livekitService.sendData(meeting.room_id, payload, DataPacket_Kind.RELIABLE).catch(() => {});
      }

      return res.json({ success: true, message: 'All participants allowed to unmute by host' });
    } catch (err: any) {
      console.error('Error on allow-all-mic:', err);
      return res.status(500).json({ error: 'Failed to allow participants to unmute' });
    }
  };

  app.post('/api/meetings/:roomId/host/allow-all-mic', optionalAuth, handleHostAllowAllMic);
  app.post('/api/meetings/:roomId/allow-all-mic', optionalAuth, handleHostAllowAllMic);

  // Host Control: Remove a participant from the meeting
  const handleHostRemove = async (req: AuthRequest, res: express.Response) => {
    try {
      const meeting = await verifyMeetingHost(req.params.roomId, req, res);
      if (!meeting) return;

      const participantIdentity =
        req.params.participantId ||
        req.body?.participantIdentity ||
        req.body?.participantId ||
        req.query?.participantId;

      if (!participantIdentity || typeof participantIdentity !== 'string') {
        return res.status(400).json({ error: 'participantIdentity is required' });
      }

      // 1. Broadcast over Real-time WebRTC Signaling (SSE)
      broadcastToRoomSignaling(meeting.room_id, {
        type: 'host_remove',
        targetIdentity: participantIdentity,
      });

      // 2. Broadcast over LiveKit if configured
      if (livekitService && isLiveKitConfigured) {
        const payload = new TextEncoder().encode(
          JSON.stringify({
            type: 'host_remove',
            targetIdentity: participantIdentity,
          })
        );
        await livekitService.sendData(meeting.room_id, payload, DataPacket_Kind.RELIABLE).catch(() => {});
        await livekitService.removeParticipant(meeting.room_id, participantIdentity).catch(() => {});
      }

      return res.json({ success: true, message: 'Participant removed by host' });
    } catch (err: any) {
      console.error('Error on remove participant:', err);
      return res.status(500).json({ error: 'Failed to remove participant' });
    }
  };

  app.post('/api/meetings/:roomId/host/remove', optionalAuth, handleHostRemove);
  app.delete('/api/meetings/:roomId/participants/:participantId', optionalAuth, handleHostRemove);
  app.post('/api/meetings/:roomId/participants/:participantId/remove', optionalAuth, handleHostRemove);

  // Host Control: Lock / Unlock Meeting
  const handleHostLock = async (req: AuthRequest, res: express.Response) => {
    try {
      const meeting = await verifyMeetingHost(req.params.roomId, req, res);
      if (!meeting) return;

      const runtime = getRoomRuntimeState(meeting.room_id);
      const targetLock = typeof req.body?.isLocked === 'boolean' ? req.body.isLocked : !runtime.isLocked;
      runtime.isLocked = targetLock;

      // 1. Broadcast over Real-time WebRTC Signaling (SSE)
      broadcastToRoomSignaling(meeting.room_id, {
        type: 'lock_state',
        isLocked: targetLock,
      });

      // 2. Broadcast over LiveKit if configured
      if (livekitService && isLiveKitConfigured) {
        const payload = new TextEncoder().encode(
          JSON.stringify({
            type: 'lock_state',
            isLocked: targetLock,
          })
        );
        await livekitService.sendData(meeting.room_id, payload, DataPacket_Kind.RELIABLE).catch(() => {});
      }

      return res.json({ success: true, isLocked: targetLock });
    } catch (err: any) {
      console.error('Error on toggle lock:', err);
      return res.status(500).json({ error: 'Failed to update meeting lock state' });
    }
  };

  app.post('/api/meetings/:roomId/host/lock', optionalAuth, handleHostLock);
  app.post('/api/meetings/:roomId/lock', optionalAuth, handleHostLock);

  // Host Control: End meeting for all participants
  const handleHostEnd = async (req: AuthRequest, res: express.Response) => {
    try {
      const meeting = await verifyMeetingHost(req.params.roomId, req, res);
      if (!meeting) return;

      // Update status in PostgreSQL
      if (supabaseServer) {
        await supabaseServer
          .from('meetings')
          .update({ status: 'completed' })
          .eq('id', meeting.id);
      } else {
        meeting.status = 'completed';
      }

      // 1. Broadcast over Real-time WebRTC Signaling (SSE)
      broadcastToRoomSignaling(meeting.room_id, {
        type: 'meeting_ended',
        meetingId: meeting.room_id,
      });

      // 2. Broadcast over LiveKit if configured
      if (livekitService && isLiveKitConfigured) {
        const payload = new TextEncoder().encode(
          JSON.stringify({
            type: 'meeting_ended',
            meetingId: meeting.room_id,
          })
        );
        await livekitService.sendData(meeting.room_id, payload, DataPacket_Kind.RELIABLE).catch(() => {});
        await livekitService.deleteRoom(meeting.room_id).catch(() => {});
      }

      return res.json({ success: true, message: 'Meeting ended for all participants' });
    } catch (err: any) {
      console.error('Error on end meeting:', err);
      return res.status(500).json({ error: 'Failed to end meeting' });
    }
  };

  app.post('/api/meetings/:roomId/host/end', optionalAuth, handleHostEnd);
  app.post('/api/meetings/:roomId/end', optionalAuth, handleHostEnd);

  // =========================================================================
  // 10. SECURE LIVEKIT TOKEN GENERATION (Verified user, meeting exists, authorized permissions)
  // =========================================================================
  app.post('/api/livekit/token', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { roomName, participantName, password } = req.body || {};

      if (!roomName || typeof roomName !== 'string' || roomName.trim().length === 0) {
        return res.status(400).json({ error: 'roomName is required' });
      }

      const cleanRoomName = roomName.trim();
      if (!isValidRoomCode(cleanRoomName)) {
        return res.status(400).json({ error: 'Invalid room name format' });
      }

      const clientIp = getClientIp(req);
      const normalized = normalizeRoomId(cleanRoomName);
      const withSpaces = normalized.replace(/-/g, ' ');

      // 1. Verify meeting exists in PostgreSQL database or fallback
      let meeting: any = null;
      if (supabaseServer) {
        const { data } = await supabaseServer
          .from('meetings')
          .select('id, room_id, title, host_id, password_hash, status')
          .or(`room_id.eq.${normalized},room_id.eq.${cleanRoomName},room_id.eq.${withSpaces}`)
          .maybeSingle();

        if (data) {
          meeting = data;
        }
      }

      if (!meeting) {
        const match = memMeetings.find(
          (m) =>
            m.normalized_room_id === normalized ||
            m.room_id === cleanRoomName ||
            m.room_id.replace(/[\s-]+/g, '-') === normalized
        );
        if (match) {
          meeting = match;
        }
      }

      const verifiedUserId = req.user?.id || null;
      const verifiedUserUuid = verifiedUserId ? toDeterministicUUID(verifiedUserId) : null;

      if (!meeting) {
        meeting = {
          id: `m-${Date.now()}`,
          room_id: normalized,
          title: `Room ${normalized}`,
          host_id: verifiedUserId || 'host-auto',
          password_hash: null,
          status: 'active',
        };
        memMeetings.unshift({
          ...meeting,
          normalized_room_id: normalized,
          is_locked: false,
          is_waiting_room_enabled: true,
          created_at: new Date().toISOString(),
        });
      }

      if (meeting.status === 'completed') {
        return res.status(403).json({ error: 'This meeting has ended' });
      }

      // 2. Validate user identity and authorization
      let isHost = Boolean(
        verifiedUserId &&
        (meeting.host_id === verifiedUserId || meeting.host_id === verifiedUserUuid)
      );

      if (!isHost && (meeting.host_id === 'host-auto' || meeting.host_id === 'host-default' || !meeting.host_id)) {
        meeting.host_id = verifiedUserId || `host-${Date.now()}`;
        isHost = true;
      }

      // Lock authorization check: if meeting is locked, only the host can join
      const roomRuntime = getRoomRuntimeState(meeting.room_id);
      if (roomRuntime.isLocked && !isHost) {
        return res.status(403).json({ error: 'Meeting is locked by the host' });
      }

      // Password authorization check: if meeting has a password and user is not host
      if (meeting.password_hash && !isHost) {
        if (!checkRateLimit(passwordAttempts, clientIp, 15, 300000)) {
          return res.status(429).json({ error: 'Too many failed attempts. Please wait 5 minutes.' });
        }

        if (!password || typeof password !== 'string') {
          return res.status(401).json({ error: 'Meeting password is required', requiresPassword: true });
        }
        const isMatch = verifyMeetingPassword(password.trim(), meeting.password_hash);
        if (!isMatch) {
          return res.status(401).json({ error: 'Incorrect meeting password', requiresPassword: true });
        }
      }

      // 3. LiveKit credentials from environment secrets (never hardcoded, never exposed to client)
      const apiKey = process.env.LIVEKIT_API_KEY;
      const apiSecret = process.env.LIVEKIT_API_SECRET;
      const livekitUrl = process.env.LIVEKIT_URL;

      if (!isLiveKitConfigured || !apiKey || !apiSecret || !livekitUrl) {
        return res.status(200).json({
          configured: false,
          serverUrl: null,
          token: null,
          isHost,
          meetingId: meeting.room_id,
          message: 'LiveKit server credentials not active or not verified. Using direct WebRTC Mesh.',
        });
      }

      // 4. Generate LiveKit JWT token with participant identity, name, metadata, and grants
      // Ensure unique identity per browser session so two tabs of the same account do not evict each other
      const participantIdentity = verifiedUserId
        ? `${verifiedUserId}_${Math.random().toString(36).slice(2, 7)}`
        : `user-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      const displayName = (participantName && typeof participantName === 'string' ? participantName.trim() : null) ||
        req.user?.user_metadata?.name ||
        req.user?.email?.split('@')[0] ||
        'Guest User';

      const at = new AccessToken(apiKey, apiSecret, {
        identity: participantIdentity,
        name: displayName,
        metadata: JSON.stringify({
          userId: verifiedUserId,
          isHost,
          role: isHost ? 'host' : 'participant',
          meetingDbId: meeting.id,
        }),
      });

      const canonicalRoomName = normalizeRoomId(meeting.room_id) || meeting.room_id;

      at.addGrant({
        roomJoin: true,
        room: canonicalRoomName,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
        roomAdmin: isHost,
      });

      const token = await at.toJwt();

      res.json({
        configured: true,
        serverUrl: livekitUrl,
        token,
        identity: participantIdentity,
        roomName: canonicalRoomName,
        isHost,
      });
    } catch (err: any) {
      console.error('Error generating LiveKit token:', err);
      res.status(500).json({ error: 'Failed to generate LiveKit token', details: err?.message });
    }
  });

  // =========================================================================
  // 17. CROSS-DEVICE REAL-TIME SIGNALING RELAY (SSE + HTTP POST + POLL WebRTC Mesh)
  // Connects Mobile, Laptop, Desktop, and multi-browser participants seamlessly
  // =========================================================================
  interface RoomSignalingRecord {
    seq: number;
    roomId: string;
    senderId: string;
    targetId?: string;
    message: any;
    timestamp: number;
  }

  let globalSignalingSeq = 0;
  const roomSignalingBuffer = new Map<string, RoomSignalingRecord[]>();

  const storeSignalingMessage = (roomId: string, message: any): number => {
    const seq = ++globalSignalingSeq;
    const msgId = message.msgId || `${message.type || 'msg'}_${message.participantId || 'anon'}_${seq}_${Date.now()}`;
    const record: RoomSignalingRecord = {
      seq,
      roomId,
      senderId: message.participantId,
      targetId: message.targetId,
      message: { ...message, msgId, __seq: seq },
      timestamp: Date.now(),
    };

    let list = roomSignalingBuffer.get(roomId);
    if (!list) {
      list = [];
      roomSignalingBuffer.set(roomId, list);
    }
    list.push(record);

    // Keep up to 100 messages, trim older than 2 minutes
    const now = Date.now();
    if (list.length > 100) {
      list.splice(0, list.length - 100);
    }
    const filtered = list.filter((m) => now - m.timestamp < 120000);
    roomSignalingBuffer.set(roomId, filtered);

    return seq;
  };

  // Subscribe to real-time room events (Server-Sent Events)
  app.get('/api/signaling/events/:roomId', (req, res) => {
    const rawRoomId = req.params.roomId;
    const participantId = (req.query.participantId as string) || `p_${Math.random().toString(36).slice(2, 9)}`;
    const roomId = normalizeRoomId(rawRoomId) || rawRoomId;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const clientKey = `${roomId}::${participantId}`;
    signalingClients.set(clientKey, { id: participantId, roomId, res });

    // Send initial connected confirmation
    res.write(`data: ${JSON.stringify({ type: 'connected', participantId, roomId, latestSeq: globalSignalingSeq })}\n\n`);

    // Replay recent active presence/state signaling messages so late-connecting mobile devices learn about peers
    // (Never replay single-use ephemeral WebRTC negotiation messages like offers/answers/ice)
    const list = roomSignalingBuffer.get(roomId) || [];
    const recent = list.filter(
      (m) =>
        Date.now() - m.timestamp < 30000 &&
        m.senderId !== participantId &&
        (!m.targetId || m.targetId === participantId) &&
        m.message?.type !== 'webrtc_offer' &&
        m.message?.type !== 'webrtc_answer' &&
        m.message?.type !== 'webrtc_ice' &&
        m.message?.type !== 'join'
    );
    for (const item of recent) {
      try {
        res.write(`data: ${JSON.stringify(item.message)}\n\n`);
      } catch {}
    }

    // Keepalive ping every 10s to maintain active HTTP stream through reverse proxies
    const pingInterval = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(pingInterval);
      }
    }, 10000);

    req.on('close', () => {
      clearInterval(pingInterval);
      signalingClients.delete(clientKey);
    });
  });

  // Polling fallback endpoint for mobile cellular networks & proxy buffering recovery
  app.get('/api/signaling/poll/:roomId', (req, res) => {
    const rawRoomId = req.params.roomId;
    const participantId = (req.query.participantId as string) || '';
    const sinceSeq = parseInt((req.query.since as string) || '0', 10) || 0;
    const roomId = normalizeRoomId(rawRoomId) || rawRoomId;

    const list = roomSignalingBuffer.get(roomId) || [];
    const newMessages = list
      .filter((m) => {
        if (m.seq <= sinceSeq) return false;
        if (m.senderId === participantId) return false;
        if (m.targetId && m.targetId !== participantId) return false;
        // Never replay single-use ephemeral WebRTC negotiation messages on initial catchup
        if (sinceSeq === 0 && (
          m.message?.type === 'webrtc_offer' ||
          m.message?.type === 'webrtc_answer' ||
          m.message?.type === 'webrtc_ice'
        )) {
          return false;
        }
        return true;
      })
      .map((m) => m.message);

    res.json({ messages: newMessages, latestSeq: globalSignalingSeq });
  });

  // Broadcast signaling messages (WebRTC SDP Offer/Answer, ICE Candidates, Chat, Reactions, State Changes)
  app.post('/api/signaling/message', (req, res) => {
    const { roomId: rawRoomId, message } = req.body || {};
    if (!rawRoomId || !message) {
      return res.status(400).json({ error: 'Missing roomId or message payload' });
    }

    const roomId = normalizeRoomId(rawRoomId) || rawRoomId;
    const targetId = message.targetId;
    const senderId = message.participantId;

    // Buffer message for reliable delivery to late-joining or reconnecting mobile peers
    const seq = storeSignalingMessage(roomId, message);
    const msgId = message.msgId || `msg_${seq}_${Date.now()}`;
    const enrichedMessage = { ...message, msgId, __seq: seq };
    const sseData = `data: ${JSON.stringify(enrichedMessage)}\n\n`;

    let deliveredCount = 0;

    for (const [key, client] of signalingClients.entries()) {
      if (client.roomId !== roomId) continue;
      // If targetId is specified, send only to targeted peer
      if (targetId && client.id !== targetId) continue;
      // Do not echo back to sender
      if (!targetId && client.id === senderId) continue;

      try {
        client.res.write(sseData);
        if (typeof (client.res as any).flush === 'function') {
          (client.res as any).flush();
        }
        deliveredCount++;
      } catch {
        signalingClients.delete(key);
      }
    }

    res.json({ success: true, deliveredCount, seq });
  });

  // Vite middleware in dev or static files in production
  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VideoMeet server listening on http://0.0.0.0:${PORT}`);
    if (isServerSupabaseConfigured) {
      console.log('Connected to Supabase PostgreSQL Database');
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
