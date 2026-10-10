import express from 'express';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { AccessToken } from 'livekit-server-sdk';

const app = express();
app.use(express.json());

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  supabaseUrl !== 'https://your-project.supabase.co' &&
  !supabaseUrl.includes('your-project')
);

const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseKey) : null;

const livekitUrl = process.env.LIVEKIT_URL || '';
const livekitApiKey = process.env.LIVEKIT_API_KEY || '';
const livekitApiSecret = process.env.LIVEKIT_API_SECRET || '';
const isLiveKitConfigured = Boolean(
  livekitUrl &&
  livekitApiKey &&
  livekitApiSecret &&
  livekitApiKey !== 'devkey' &&
  !livekitUrl.includes('your-livekit-instance')
);

// Helpers
function normalizeRoomId(roomId: string): string {
  if (!roomId || typeof roomId !== 'string') return '';
  const trimmed = roomId.trim().toLowerCase();
  const alphanumericOnly = trimmed.replace(/[\s-]+/g, '');
  if (/^[a-z0-9]{9}$/.test(alphanumericOnly)) {
    return `${alphanumericOnly.slice(0, 3)}-${alphanumericOnly.slice(3, 6)}-${alphanumericOnly.slice(6, 9)}`;
  }
  return trimmed.replace(/[\s-]+/g, '-');
}

function generateRoomCode(): string {
  const p1 = Math.floor(100 + Math.random() * 900);
  const p2 = Math.floor(100 + Math.random() * 900);
  const p3 = Math.floor(100 + Math.random() * 900);
  return `${p1}-${p2}-${p3}`;
}

function toDeterministicUUID(id: string): string {
  if (!id) return '00000000-0000-4000-a000-000000000000';
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id;
  const hash = crypto.createHash('md5').update(id).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function hashPassword(pass: string): string {
  return crypto.createHash('sha256').update(pass + 'vidmeet_secure_room_salt_2025').digest('hex');
}

function parseToken(authHeader?: string) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split('Bearer ')[1].trim();
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      if (payload) {
        return {
          id: payload.user_id || payload.sub || 'user',
          name: payload.name || payload.display_name || payload.email?.split('@')[0] || 'User',
          email: payload.email || '',
        };
      }
    }
  } catch {}
  return null;
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    database: isSupabaseConfigured ? 'supabase-configured' : 'memory-fallback',
    livekit: isLiveKitConfigured ? 'livekit-configured' : 'direct-mesh-signaling',
  });
});

// GET /api/meetings - list meetings
app.get('/api/meetings', async (_req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return res.json(
          data.map((m: any) => ({
            id: m.id,
            title: m.title,
            code: m.room_id,
            date: m.status === 'scheduled' ? 'Scheduled' : 'Today',
            time: 'Now',
            duration: '30 min',
            host: 'You',
            status: 'hosted',
            isHost: true,
            hasPassword: Boolean(m.password_hash),
            isLocked: Boolean(m.is_locked),
            isRecorded: false,
            participantsCount: 1,
          }))
        );
      }
    } catch {}
  }
  return res.json([]);
});

// POST /api/meetings - create meeting
app.post('/api/meetings', async (req, res) => {
  try {
    const { title, password, isScheduled, scheduledDate, scheduledTime, duration } = req.body || {};
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Meeting title is required' });
    }

    const authUser = parseToken(req.headers.authorization);
    const hostId = authUser?.id || 'host-auto';
    const hostUuid = toDeterministicUUID(hostId);
    const hostName = authUser?.name || 'Host';

    let roomId = generateRoomCode();
    const passwordHash = password && password.trim() ? hashPassword(password.trim()) : null;
    const status = isScheduled ? 'scheduled' : 'active';

    if (supabase) {
      // Upsert host profile
      try {
        await supabase.from('profiles').upsert(
          {
            id: hostUuid,
            name: hostName,
            email: authUser?.email || '',
          },
          { onConflict: 'id' }
        );
      } catch {}

      // Insert meeting
      let { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          title: title.trim(),
          room_id: roomId,
          host_id: hostUuid,
          password_hash: passwordHash,
          status,
          is_locked: false,
          is_waiting_room_enabled: true,
        })
        .select()
        .single();

      if (meetingError && meetingError.code === '23503') {
        const { data: anyProf } = await supabase.from('profiles').select('id').limit(1).maybeSingle();
        if (anyProf?.id) {
          const retry = await supabase
            .from('meetings')
            .insert({
              title: title.trim(),
              room_id: roomId,
              host_id: anyProf.id,
              password_hash: passwordHash,
              status,
            })
            .select()
            .single();
          if (!retry.error && retry.data) {
            meetingData = retry.data;
            meetingError = null;
          }
        }
      }

      if (meetingData) {
        return res.json({
          id: meetingData.id,
          title: meetingData.title,
          code: meetingData.room_id,
          date: isScheduled && scheduledDate ? scheduledDate : 'Today',
          time: isScheduled && scheduledTime ? scheduledTime : 'Now',
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

    // Fallback response
    return res.json({
      id: `m-${Date.now()}`,
      title: title.trim(),
      code: roomId,
      date: isScheduled && scheduledDate ? scheduledDate : 'Today',
      time: isScheduled && scheduledTime ? scheduledTime : 'Now',
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
    return res.status(500).json({ error: err?.message || 'Failed to create meeting in database' });
  }
});

// GET /api/meetings/verify/:roomId
app.get('/api/meetings/verify/:roomId', async (req, res) => {
  const raw = req.params.roomId;
  const normalized = normalizeRoomId(raw);

  if (supabase) {
    try {
      const { data } = await supabase
        .from('meetings')
        .select('*')
        .or(`room_id.eq.${raw},room_id.eq.${normalized},id.eq.${raw}`)
        .maybeSingle();

      if (data) {
        return res.json({
          id: data.id,
          title: data.title,
          roomId: data.room_id,
          hasPassword: Boolean(data.password_hash),
          isLocked: Boolean(data.is_locked),
          isWaitingRoomEnabled: data.is_waiting_room_enabled !== false,
          hostId: data.host_id,
        });
      }
    } catch {}
  }

  // Allow standard room codes into lobby
  if (normalized) {
    return res.json({
      id: raw,
      title: `Room: ${raw}`,
      roomId: raw,
      hasPassword: false,
      isLocked: false,
      isWaitingRoomEnabled: true,
    });
  }

  return res.status(404).json({ error: 'Meeting not found' });
});

// POST /api/meetings/join/:roomId
app.post('/api/meetings/join/:roomId', async (req, res) => {
  const raw = req.params.roomId;
  const { displayName, password } = req.body || {};

  if (supabase) {
    try {
      const { data: meeting } = await supabase
        .from('meetings')
        .select('*')
        .or(`room_id.eq.${raw},room_id.eq.${normalizeRoomId(raw)},id.eq.${raw}`)
        .maybeSingle();

      if (meeting) {
        if (meeting.password_hash) {
          const pass = password ? hashPassword(password.trim()) : '';
          if (pass !== meeting.password_hash) {
            return res.status(401).json({ error: 'Incorrect meeting password', requiresPassword: true });
          }
        }

        return res.json({
          success: true,
          meetingId: meeting.id,
          roomId: meeting.room_id,
          title: meeting.title,
          isHost: req.body?.isHostClaim || false,
          isLocked: Boolean(meeting.is_locked),
        });
      }
    } catch {}
  }

  return res.json({
    success: true,
    meetingId: raw,
    roomId: raw,
    title: `Room: ${raw}`,
    isHost: req.body?.isHostClaim || false,
    isLocked: false,
  });
});

// POST /api/livekit/token
app.post('/api/livekit/token', async (req, res) => {
  try {
    const { roomName, participantName } = req.body || {};
    if (!roomName || !participantName) {
      return res.status(400).json({ error: 'roomName and participantName are required' });
    }

    if (isLiveKitConfigured) {
      const at = new AccessToken(livekitApiKey, livekitApiSecret, {
        identity: `${participantName}-${Date.now().toString(36)}`,
        name: participantName,
        ttl: '4h',
      });

      at.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });

      const token = await at.toJwt();
      return res.json({
        configured: true,
        serverUrl: livekitUrl,
        token,
      });
    }

    return res.json({
      configured: false,
      serverUrl: null,
      token: null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Token generation error' });
  }
});

// Cross-device real-time signaling store for serverless environments
interface SignalingClient {
  id: string;
  roomId: string;
  res: express.Response;
}

const signalingClients = new Map<string, SignalingClient>();

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

function storeSignalingMessage(roomId: string, message: any): number {
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
  if (list.length > 100) {
    list.splice(0, list.length - 100);
  }
  const now = Date.now();
  const filtered = list.filter((m) => now - m.timestamp < 120000);
  roomSignalingBuffer.set(roomId, filtered);
  return seq;
}

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

  res.write(`data: ${JSON.stringify({ type: 'connected', participantId, roomId, latestSeq: globalSignalingSeq })}\n\n`);

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

// Polling fallback endpoint
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

// Broadcast signaling messages
app.post('/api/signaling/message', (req, res) => {
  const { roomId: rawRoomId, message } = req.body || {};
  if (!rawRoomId || !message) {
    return res.status(400).json({ error: 'Missing roomId or message payload' });
  }

  const roomId = normalizeRoomId(rawRoomId) || rawRoomId;
  const targetId = message.targetId;
  const senderId = message.participantId;
  const seq = storeSignalingMessage(roomId, message);
  const msgId = message.msgId || `msg_${seq}_${Date.now()}`;
  const enrichedMessage = { ...message, msgId, __seq: seq };
  const sseData = `data: ${JSON.stringify(enrichedMessage)}\n\n`;
  let deliveredCount = 0;

  for (const [key, client] of signalingClients.entries()) {
    if (client.roomId !== roomId) continue;
    if (targetId && client.id !== targetId) continue;
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

export default app;
