export type ViewState = 'landing' | 'login' | 'signup' | 'app' | 'join' | 'wait' | 'meet';

export type AppTab = 'dash' | 'meetings' | 'calendar' | 'recs' | 'settings' | 'about-dev';

export type MeetingFilter = 'all' | 'hosted' | 'attended' | 'recorded';

export interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  host: string;
  status: 'hosted' | 'attended' | 'scheduled';
  isRecorded: boolean;
  participantsCount: number;
  password?: string;
  code: string;
  isHost?: boolean;
  hasPassword?: boolean;
  isLocked?: boolean;
  hostId?: string;
  isWaitingRoomEnabled?: boolean;
}

export interface Recording {
  id: string;
  title: string;
  date: string;
  duration: string;
  participantsCount: number;
  thumbnailGradient: string;
  videoUrl?: string;
  fileSize: string;
}

export interface Participant {
  id: string;
  name: string;
  avatarColor: string;
  isHost: boolean;
  isMicOn: boolean;
  isCamOn: boolean;
  isSpeaking: boolean;
  isMicLocked?: boolean;
  isLocal?: boolean;
  mediaStream?: MediaStream | null;
  videoTrack?: any;
}

export interface ChatMessage {
  id: string;
  sender: string;
  avatarColor: string;
  text: string;
  timestamp: string;
  isSelf: boolean;
}

export interface ToastMessage {
  id: string;
  text: string;
}

export interface DeveloperProfile {
  name: string;
  role: string;
  specialization: string;
  bio1: string;
  bio2: string;
  skills: string[];
  email: string;
  links: {
    linkedin: string;
    instagram: string;
    facebook: string;
    github?: string;
  };
  copyright: string;
}
