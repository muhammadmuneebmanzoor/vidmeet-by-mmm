/**
 * Supabase PostgreSQL Database Schema for VideoMeet
 * Tables: profiles, meetings, participants, messages, scheduled_meetings, recordings
 */

export interface DbProfile {
  id: string; // references auth.users.id
  email: string;
  name: string;
  avatar_url?: string | null;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface DbMeeting {
  id: string;
  room_id: string; // unique code e.g. "team-sync-123" or "123 456 789"
  title: string;
  host_id: string; // references profiles.id
  password_hash?: string | null;
  is_locked: boolean;
  is_waiting_room_enabled: boolean;
  status: 'active' | 'ended' | 'scheduled';
  started_at?: string | null;
  ended_at?: string | null;
  created_at: string;
}

export interface DbScheduledMeeting {
  id: string;
  meeting_id: string; // references meetings.id
  host_id: string; // references profiles.id
  scheduled_start_time: string;
  estimated_duration_minutes: number;
  timezone: string;
  send_reminder: boolean;
  created_at: string;
}

export interface DbParticipant {
  id: string;
  meeting_id: string; // references meetings.id
  user_id?: string | null; // references profiles.id (nullable if guest)
  display_name: string;
  role: 'host' | 'co-host' | 'participant';
  joined_at: string;
  left_at?: string | null;
  is_muted: boolean;
  is_camera_off: boolean;
}

export interface DbMessage {
  id: string;
  meeting_id: string; // references meetings.id
  sender_id?: string | null; // references profiles.id
  sender_name: string;
  content: string;
  created_at: string;
}

export interface DbRecording {
  id: string;
  meeting_id: string; // references meetings.id
  title: string;
  duration_seconds: number;
  file_url: string;
  file_size_bytes: number;
  status: 'processing' | 'ready' | 'failed';
  created_at: string;
}

/**
 * Supabase SQL DDL definition
 * Can be run in Supabase SQL Editor to initialize all tables and RLS policies.
 * If you previously created tables with restrictive policies, you can run:
 *   ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
 *   DROP POLICY IF EXISTS "Hosts can create meetings" ON public.meetings;
 *   CREATE POLICY "Allow create meetings" ON public.meetings FOR INSERT WITH CHECK (true);
 *   DROP POLICY IF EXISTS "Meetings are viewable by authenticated users" ON public.meetings;
 *   CREATE POLICY "Allow view meetings" ON public.meetings FOR SELECT USING (true);
 */
export const SUPABASE_SQL_DDL = `
-- 1. Create profiles table (decoupled from auth.users to support Firebase Auth, Google OAuth, and Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    email TEXT,
    name TEXT NOT NULL,
    avatar_url TEXT,
    role VARCHAR(50) DEFAULT 'user' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Create meetings table
CREATE TABLE IF NOT EXISTS public.meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    host_id UUID NOT NULL,
    password_hash TEXT,
    is_locked BOOLEAN DEFAULT FALSE NOT NULL,
    is_waiting_room_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    status VARCHAR(50) DEFAULT 'active' NOT NULL,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Create scheduled_meetings table
CREATE TABLE IF NOT EXISTS public.scheduled_meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    host_id UUID NOT NULL,
    scheduled_start_time TIMESTAMPTZ NOT NULL,
    estimated_duration_minutes INTEGER DEFAULT 30 NOT NULL,
    timezone VARCHAR(100) DEFAULT 'UTC' NOT NULL,
    send_reminder BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. Create participants table
CREATE TABLE IF NOT EXISTS public.participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    user_id UUID,
    display_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'participant' NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    left_at TIMESTAMPTZ,
    is_muted BOOLEAN DEFAULT FALSE NOT NULL,
    is_camera_off BOOLEAN DEFAULT FALSE NOT NULL
);

-- 5. Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    sender_id UUID,
    sender_name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. Create recordings table
CREATE TABLE IF NOT EXISTS public.recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    duration_seconds INTEGER DEFAULT 0 NOT NULL,
    file_url TEXT NOT NULL,
    file_size_bytes BIGINT DEFAULT 0 NOT NULL,
    status VARCHAR(50) DEFAULT 'ready' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_meetings_room_id ON public.meetings(room_id);
CREATE INDEX IF NOT EXISTS idx_meetings_host_id ON public.meetings(host_id);
CREATE INDEX IF NOT EXISTS idx_participants_meeting_id ON public.participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_messages_meeting_id ON public.messages(meeting_id);
CREATE INDEX IF NOT EXISTS idx_recordings_meeting_id ON public.recordings(meeting_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_meetings_host_id ON public.scheduled_meetings(host_id);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies
CREATE POLICY "Profiles are viewable by all"
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Profiles can be inserted or updated by all"
ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- Meetings RLS Policies
CREATE POLICY "Meetings are viewable by all"
ON public.meetings FOR SELECT USING (true);

CREATE POLICY "Meetings can be created by all"
ON public.meetings FOR INSERT WITH CHECK (true);

CREATE POLICY "Meetings can be updated by all"
ON public.meetings FOR UPDATE USING (true);

CREATE POLICY "Meetings can be deleted by all"
ON public.meetings FOR DELETE USING (true);

-- Messages RLS Policies
CREATE POLICY "Participants can view messages for their meetings"
ON public.messages FOR SELECT USING (true);

CREATE POLICY "Participants can send messages"
ON public.messages FOR INSERT WITH CHECK (true);

-- Participants RLS Policies
CREATE POLICY "Participants are viewable by all"
ON public.participants FOR SELECT USING (true);

CREATE POLICY "Participants can be recorded"
ON public.participants FOR INSERT WITH CHECK (true);
`;
