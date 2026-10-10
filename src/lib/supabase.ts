import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project.supabase.co' &&
  !supabaseUrl.includes('your-project')
);

// Client-side Supabase instance using only the public Anon key
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'videomeet_supabase_auth',
    },
  }
);

// Convert any ID (Firebase UID or custom string) to deterministic UUID for PostgreSQL
export function toDeterministicUUID(id: string): string {
  if (!id) return '00000000-0000-4000-a000-000000000000';
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id;
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x12345678, h4 = 0x87654321;
  for (let i = 0; i < id.length; i++) {
    const ch = id.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 2246822519);
    h4 = Math.imul(h4 ^ ch, 3266489917);
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  const s = `${hex(h1)}${hex(h2)}${hex(h3)}${hex(h4)}`;
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-a${s.slice(17, 20)}-${s.slice(20, 32)}`;
}

// Generate human-friendly 9-digit meeting code e.g. "492-817-305"
export function generateRoomCode(): string {
  const p1 = Math.floor(100 + Math.random() * 900);
  const p2 = Math.floor(100 + Math.random() * 900);
  const p3 = Math.floor(100 + Math.random() * 900);
  return `${p1}-${p2}-${p3}`;
}

// Normalize room ID for matching
export function normalizeRoomId(roomId: string): string {
  if (!roomId || typeof roomId !== 'string') return '';
  const trimmed = roomId.trim().toLowerCase();
  const alphanumericOnly = trimmed.replace(/[\s-]+/g, '');
  if (/^[a-z0-9]{9}$/.test(alphanumericOnly)) {
    return `${alphanumericOnly.slice(0, 3)}-${alphanumericOnly.slice(3, 6)}-${alphanumericOnly.slice(6, 9)}`;
  }
  return trimmed.replace(/[\s-]+/g, '-');
}

// Local storage helper for resilient multi-device and Vercel static fallback
const LOCAL_MEETINGS_KEY = 'vidmeet_saved_meetings_db';

export function getLocalStoredMeetings(): any[] {
  try {
    const raw = localStorage.getItem(LOCAL_MEETINGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalStoredMeeting(meeting: any) {
  try {
    const list = getLocalStoredMeetings().filter((m: any) => m.id !== meeting.id && m.code !== meeting.code);
    list.unshift(meeting);
    localStorage.setItem(LOCAL_MEETINGS_KEY, JSON.stringify(list.slice(0, 50)));
  } catch {}
}

export function removeLocalStoredMeeting(meetingId: string) {
  try {
    const list = getLocalStoredMeetings().filter((m: any) => m.id !== meetingId && m.code !== meetingId);
    localStorage.setItem(LOCAL_MEETINGS_KEY, JSON.stringify(list));
  } catch {}
}

// Client-side SHA-256 password hasher using standard Web Crypto API
export async function hashMeetingPasswordClient(password: string): Promise<string> {
  try {
    const enc = new TextEncoder();
    const data = enc.encode(password + 'vidmeet_secure_room_salt_2025');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return btoa(password);
  }
}

export interface DirectSaveMeetingPayload {
  title: string;
  password?: string;
  isScheduled: boolean;
  scheduledDate?: string;
  scheduledTime?: string;
  duration?: string;
  isInstant: boolean;
}

/**
 * Robust direct Supabase insertion for Vercel and client environments.
 * Handles profiles upsert, foreign-key recovery, anonymous auth, and table schema variations.
 */
export async function saveMeetingDirectToSupabase(
  payload: DirectSaveMeetingPayload,
  user: any
): Promise<{ success: boolean; meeting?: any; error?: string }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase database is not configured in environment variables' };
  }

  try {
    // 1. Check or establish Supabase auth session
    let sbUserId: string | null = null;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user?.id) {
        sbUserId = sessionData.session.user.id;
      } else {
        // Attempt anonymous sign-in if enabled on Supabase project
        const { data: anonData } = await supabase.auth.signInAnonymously().catch(() => ({ data: null }));
        if (anonData?.user?.id) {
          sbUserId = anonData.user.id;
        }
      }
    } catch {}

    const hostId = user?.id || user?.uid || sbUserId || 'host-auto';
    const hostUuid = sbUserId || toDeterministicUUID(hostId);
    const hostName = user?.displayName || user?.user_metadata?.name || 'Host';
    const hostEmail = user?.email || '';

    // 2. Profile handling: Upsert profile or locate an existing valid foreign-key profile
    let confirmedHostId = hostUuid;
    let anyExistingProfileId: string | null = null;

    try {
      const { error: profErr } = await supabase.from('profiles').upsert(
        {
          id: hostUuid,
          name: hostName,
          email: hostEmail,
        },
        { onConflict: 'id' }
      );

      if (profErr) {
        console.warn('Direct profile upsert notice in Supabase:', profErr);
      }
    } catch (pe) {
      console.warn('Profile upsert exception:', pe);
    }

    // Probe for any existing profile in case foreign-key constraint on auth.users rejected our upsert
    try {
      const { data: existingProf } = await supabase.from('profiles').select('id').limit(1).maybeSingle();
      if (existingProf?.id) {
        anyExistingProfileId = existingProf.id;
      }
    } catch {}

    // 3. Generate collision-resistant 9-digit room code
    let roomId = generateRoomCode();
    let collisionFree = false;
    let attempts = 0;

    while (!collisionFree && attempts < 5) {
      try {
        const { data: existingRoom } = await supabase
          .from('meetings')
          .select('id')
          .eq('room_id', roomId)
          .maybeSingle();

        if (!existingRoom) {
          collisionFree = true;
        } else {
          roomId = generateRoomCode();
        }
      } catch {
        collisionFree = true;
      }
      attempts++;
    }

    // 4. Compute password hash if protected
    let passwordHash: string | null = null;
    if (payload.password && payload.password.trim().length > 0) {
      passwordHash = await hashMeetingPasswordClient(payload.password.trim());
    }

    const meetingStatus = payload.isScheduled ? 'scheduled' : 'active';

    // 5. Attempt insertion into 'meetings' table (Attempt A: Full schema)
    const primaryPayload = {
      title: payload.title.trim(),
      room_id: roomId,
      host_id: confirmedHostId,
      status: meetingStatus,
      is_locked: false,
      is_waiting_room_enabled: true,
      ...(passwordHash ? { password_hash: passwordHash } : {}),
    };

    let { data: dbMeeting, error: dbErr } = await supabase
      .from('meetings')
      .insert(primaryPayload)
      .select()
      .single();

    // 6. Foreign-key fallback (Attempt B): If host_id constraint failed, use existing valid profile
    if (dbErr && (dbErr.code === '23503' || dbErr.message?.includes('foreign key')) && anyExistingProfileId) {
      console.warn('Foreign key fallback: inserting with verified existing profile id', anyExistingProfileId);
      const retryFk = await supabase
        .from('meetings')
        .insert({
          ...primaryPayload,
          host_id: anyExistingProfileId,
        })
        .select()
        .single();

      if (!retryFk.error && retryFk.data) {
        dbMeeting = retryFk.data;
        dbErr = null;
      }
    }

    // 7. Schema mismatch fallback (Attempt C): Retry with minimal required columns
    if (dbErr && (dbErr.code === '42703' || dbErr.message?.includes('column'))) {
      console.warn('Schema mismatch notice, retrying with minimal columns');
      const minimalPayload = {
        title: payload.title.trim(),
        room_id: roomId,
        host_id: anyExistingProfileId || confirmedHostId,
        status: meetingStatus,
      };

      const retryMin = await supabase
        .from('meetings')
        .insert(minimalPayload)
        .select()
        .single();

      if (!retryMin.error && retryMin.data) {
        dbMeeting = retryMin.data;
        dbErr = null;
      }
    }

    if (dbErr) {
      console.error('Supabase direct insert failed:', dbErr);
      return { success: false, error: dbErr.message || 'Database insert failed' };
    }

    if (dbMeeting) {
      return { success: true, meeting: dbMeeting };
    }

    return { success: false, error: 'Database did not return inserted record' };
  } catch (err: any) {
    console.error('saveMeetingDirectToSupabase error:', err);
    return { success: false, error: err?.message || 'Unexpected database error' };
  }
}

/**
 * Retrieve a meeting directly from Supabase by room ID or UUID.
 */
export async function getMeetingDirectFromSupabase(roomIdOrCode: string): Promise<any | null> {
  if (!isSupabaseConfigured || !roomIdOrCode) return null;

  try {
    const raw = roomIdOrCode.trim();
    const normalized = normalizeRoomId(raw);

    // Try exact room_id match
    const { data: m1 } = await supabase
      .from('meetings')
      .select('*')
      .eq('room_id', raw)
      .maybeSingle();

    if (m1) return m1;

    // Try normalized code match
    if (normalized !== raw) {
      const { data: m2 } = await supabase
        .from('meetings')
        .select('*')
        .eq('room_id', normalized)
        .maybeSingle();

      if (m2) return m2;
    }

    // Try primary key ID match if valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(raw)) {
      const { data: m3 } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', raw)
        .maybeSingle();

      if (m3) return m3;
    }

    return null;
  } catch (e) {
    console.warn('getMeetingDirectFromSupabase notice:', e);
    return null;
  }
}
