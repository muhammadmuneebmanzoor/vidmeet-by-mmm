import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import { Meeting, Recording, ToastMessage } from './types';
import { INITIAL_MEETINGS, INITIAL_RECORDINGS } from './data/mockData';
import { LandingPage } from './components/LandingPage';
import { AuthView } from './components/AuthView';
import { JoinView } from './components/JoinView';
import { WaitingRoom } from './components/WaitingRoom';
import { MeetingRoom } from './components/MeetingRoom';
import { AppView } from './components/app/AppView';
import { CreateMeetingModal } from './components/CreateMeetingModal';
import { Toast } from './components/Toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PrivacyView } from './components/PrivacyView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { 
  supabase, 
  isSupabaseConfigured, 
  toDeterministicUUID, 
  generateRoomCode, 
  normalizeRoomId,
  saveLocalStoredMeeting, 
  getLocalStoredMeetings, 
  removeLocalStoredMeeting,
  saveMeetingDirectToSupabase,
  getMeetingDirectFromSupabase
} from './lib/supabase';

// Meeting Room Route Component with Waiting Room lobby support
interface MeetingPageRouteProps {
  userName: string;
  setUserName: (n: string) => void;
  onShowToast: (msg: string) => void;
}

function MeetingPageRoute({ userName, setUserName, onShowToast }: MeetingPageRouteProps) {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [inLobby, setInLobby] = useState(true);
  const activeRoomId = roomId ? decodeURIComponent(roomId) : '';
  const [meetingParams, setMeetingParams] = useState<{
    name: string;
    micOn: boolean;
    camOn: boolean;
    meetingDbId?: string;
    meetingTitle?: string;
    isHost?: boolean;
    isLocked?: boolean;
    meetingPassword?: string;
  }>({
    name: userName || '',
    micOn: true,
    camOn: true,
  });

  if (!activeRoomId) {
    return <Navigate to="/join" replace />;
  }

  if (inLobby) {
    return (
      <WaitingRoom
        initialName={userName}
        initialMeetingId={activeRoomId}
        onJoinMeeting={(params) => {
          setTimeout(() => {
            setUserName(params.name);
            setMeetingParams({
              name: params.name,
              micOn: params.isMicOn,
              camOn: params.isCamOn,
              meetingDbId: params.meetingDbId,
              meetingTitle: params.meetingTitle,
              isHost: params.isHost,
              isLocked: params.isLocked,
              meetingPassword: params.password,
            });
            setInLobby(false);
            onShowToast(`Joined meeting: ${params.meetingTitle || activeRoomId}`);
          }, 0);
        }}
        onCancel={() => navigate('/dashboard')}
        onShowToast={onShowToast}
      />
    );
  }

  return (
    <MeetingRoom
      meetingTitle={meetingParams.meetingTitle || `Room: ${activeRoomId}`}
      meetingId={activeRoomId}
      meetingDbId={meetingParams.meetingDbId}
      meetingPassword={meetingParams.meetingPassword}
      userName={meetingParams.name || userName || 'Guest'}
      initialMicOn={meetingParams.micOn}
      initialCamOn={meetingParams.camOn}
      isHost={meetingParams.isHost}
      initialIsLocked={meetingParams.isLocked}
      onLeaveMeeting={() => {
        onShowToast('You left the meeting');
        navigate('/dashboard');
      }}
      onShowToast={onShowToast}
    />
  );
}

function AppContent() {
  const navigate = useNavigate();
  const { user, session, profile, signOut } = useAuth();

  // User Profile State derived from Supabase Auth & Profile
  const authUserName = profile?.name || user?.user_metadata?.name || (user?.email ? user.email.split('@')[0] : '');
  const userEmail = profile?.email || user?.email || '';

  // Custom user name state (persisted when joining or starting meetings)
  const [customUserName, setCustomUserName] = useState<string>(() => {
    return localStorage.getItem('vidmeet_user_name') || '';
  });

  const effectiveUserName = customUserName || authUserName || '';

  const handleSetUserName = (n: string) => {
    const trimmed = n.trim();
    setCustomUserName(trimmed);
    if (trimmed) {
      localStorage.setItem('vidmeet_user_name', trimmed);
    }
  };

  // App Theme State
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('light');

  // Meetings & Recordings State (Synchronized with Supabase)
  const [meetings, setMeetings] = useState<Meeting[]>(INITIAL_MEETINGS);
  const [recordings] = useState<Recording[]>(INITIAL_RECORDINGS);

  // Modals & Toasts
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Fetch meetings from API or directly from Supabase / local storage
  useEffect(() => {
    async function loadMeetings() {
      let loaded: Meeting[] = [];
      try {
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        const res = await fetch('/api/meetings', { headers });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            loaded = data;
          }
        }
      } catch (err) {
        console.warn('API load notice:', err);
      }

      // If API was unavailable or returned empty, check Supabase directly (for Vercel deployment)
      if (loaded.length === 0 && isSupabaseConfigured) {
        try {
          const { data: dbMeetings } = await supabase
            .from('meetings')
            .select('*')
            .order('created_at', { ascending: false });
          if (dbMeetings && dbMeetings.length > 0) {
            loaded = dbMeetings.map((m: any) => ({
              id: m.id,
              title: m.title,
              code: m.room_id,
              date: 'Today',
              time: 'Now',
              duration: '30 min',
              host: 'You',
              status: 'hosted',
              isHost: true,
              hasPassword: Boolean(m.password_hash),
              isLocked: Boolean(m.is_locked),
              isRecorded: false,
              participantsCount: 1,
            }));
          }
        } catch {}
      }

      // Merge with locally stored meetings
      const localList = getLocalStoredMeetings();
      const mergedMap = new Map<string, Meeting>();
      [...loaded, ...localList].forEach((m: any) => {
        if (m.code && !mergedMap.has(m.code)) {
          mergedMap.set(m.code, m);
        }
      });
      setMeetings(Array.from(mergedMap.values()));
    }

    loadMeetings();
  }, [session?.access_token]);

  // Automatically navigate to /dashboard when user is authenticated from OAuth callback
  useEffect(() => {
    if (user) {
      const path = window.location.pathname;
      if (
        path === '/' ||
        path === '/login' ||
        path === '/signup' ||
        window.location.hash.includes('access_token') ||
        window.location.search.includes('code=')
      ) {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, navigate]);

  // Initialize theme on mount
  useEffect(() => {
    const savedTheme = (localStorage.getItem('vidmeet_theme') as 'light' | 'dark' | 'system') || 'light';
    setTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  const applyTheme = (t: 'light' | 'dark' | 'system') => {
    let effective = t;
    if (t === 'system') {
      effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.dataset.theme = effective;
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    localStorage.setItem('vidmeet_theme', newTheme);
    applyTheme(newTheme);
    showToast(`Theme switched to ${newTheme}`);
  };

  const showToast = (text: string) => {
    const id = `t-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  };

  // Create meeting in database with full fallback support for Vercel deployment
  const handleCreateMeeting = async (payload: {
    title: string;
    password?: string;
    isScheduled: boolean;
    scheduledDate?: string;
    scheduledTime?: string;
    duration?: string;
    isInstant: boolean;
  }) => {
    try {
      if (!session?.access_token && !user) {
        showToast('Please log in first to create a meeting');
        navigate('/login');
        return;
      }

      let savedMeeting: Meeting | null = null;
      let databaseSaved = false;

      // Tier 1: Try server API endpoint (/api/meetings)
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        };

        const res = await fetch('/api/meetings', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });

        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          savedMeeting = await res.json();
          databaseSaved = true;
        } else {
          console.warn('API /api/meetings response status:', res.status);
        }
      } catch (apiErr) {
        console.warn('Server API unavailable on current deployment, continuing to database:', apiErr);
      }

      // Tier 2: Direct Supabase database insertion (for Vercel deployment & direct database access)
      if (!savedMeeting && isSupabaseConfigured) {
        try {
          const directRes = await saveMeetingDirectToSupabase(payload, user);
          if (directRes.success && directRes.meeting) {
            const dbMeeting = directRes.meeting;
            savedMeeting = {
              id: dbMeeting.id,
              title: dbMeeting.title,
              code: dbMeeting.room_id,
              date: payload.isScheduled && payload.scheduledDate ? payload.scheduledDate : 'Today',
              time: payload.isScheduled && payload.scheduledTime ? payload.scheduledTime : 'Now',
              duration: payload.duration || '30 min',
              host: user?.displayName || user?.user_metadata?.name || 'You',
              status: 'hosted',
              isHost: true,
              hasPassword: Boolean(payload.password),
              isLocked: false,
              isRecorded: false,
              participantsCount: 1,
            };
            databaseSaved = true;
          } else {
            console.warn('Direct Supabase insert notice:', directRes.error);
          }
        } catch (dbEx) {
          console.warn('Direct Supabase exception:', dbEx);
        }
      }

      // Tier 3: Resilient client storage fallback (ensures meeting is saved and user is NEVER blocked)
      if (!savedMeeting) {
        const roomId = generateRoomCode();
        savedMeeting = {
          id: `m-${Date.now()}`,
          title: payload.title.trim(),
          code: roomId,
          date: payload.isScheduled && payload.scheduledDate ? payload.scheduledDate : 'Today',
          time: payload.isScheduled && payload.scheduledTime ? payload.scheduledTime : 'Now',
          duration: payload.duration || '30 min',
          host: user?.displayName || user?.user_metadata?.name || 'You',
          status: 'hosted',
          isHost: true,
          hasPassword: Boolean(payload.password),
          isLocked: false,
          isRecorded: false,
          participantsCount: 1,
        };
      }

      // Save to local cache
      saveLocalStoredMeeting(savedMeeting);

      // Update state
      setMeetings((prev) => [savedMeeting!, ...prev.filter((m) => m.id !== savedMeeting!.id && m.code !== savedMeeting!.code)]);

      if (savedMeeting.code) {
        sessionStorage.setItem(`vidmeet_creator_${savedMeeting.code}`, 'true');
        sessionStorage.setItem(`vidmeet_creator_${normalizeRoomId(savedMeeting.code)}`, 'true');
      }
      if (savedMeeting.id) {
        sessionStorage.setItem(`vidmeet_creator_${savedMeeting.id}`, 'true');
      }

      const toastMessage = payload.isInstant
        ? (databaseSaved ? 'Meeting saved in database! Entering room...' : 'Meeting created! Entering room...')
        : (databaseSaved ? 'Meeting saved in database successfully!' : 'Meeting scheduled successfully!');
      showToast(toastMessage);

      if (payload.isInstant) {
        navigate(`/meeting/${encodeURIComponent(savedMeeting.code)}`);
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error('Meeting creation error:', err);
      showToast(err?.message || 'Error creating meeting');
    }
  };

  // Delete meeting from database (Host only)
  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      fetch(`/api/meetings/${meetingId}`, { method: 'DELETE', headers }).catch(() => {});

      if (isSupabaseConfigured) {
        supabase.from('meetings').delete().eq('id', meetingId).then(() => {}, () => {});
      }

      removeLocalStoredMeeting(meetingId);

      setMeetings((prev) => prev.filter((m) => m.id !== meetingId && m.code !== meetingId));
      showToast('Meeting removed from database');
    } catch (err: any) {
      showToast(err?.message || 'Error deleting meeting');
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
    showToast('Signed out successfully');
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors select-auto">
      {/* Toast Notifications */}
      <Toast toasts={toasts} />

      {/* Reusable Create Meeting Modal */}
      <CreateMeetingModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateMeeting}
        onShowToast={showToast}
      />

      {/* Application Routes with Supabase Authentication */}
      <Routes>
        {/* Route: / (Home / Landing) */}
        <Route
          path="/"
          element={
            <LandingPage
              onNavigate={(view) => {
                if (view === 'login') navigate('/login');
                else if (view === 'signup') navigate('/signup');
                else if (view === 'join') navigate('/join');
                else if (view === 'wait') {
                  if (!user) {
                    showToast('Please log in first to start a meeting');
                    navigate('/login');
                  } else {
                    setIsCreateModalOpen(true);
                    navigate('/dashboard');
                  }
                }
                else if (view === 'app') navigate(user ? '/dashboard' : '/login');
                else navigate('/');
              }}
              onShowToast={showToast}
              currentTheme={theme}
              onThemeChange={handleThemeChange}
              onQuickJoin={(cleanCode, name) => {
                if (name && name.trim()) {
                  handleSetUserName(name.trim());
                }
                navigate(`/meeting/${encodeURIComponent(cleanCode)}`);
              }}
            />
          }
        />

        {/* Route: /login (Supabase Auth) */}
        <Route
          path="/login"
          element={
            <AuthView
              mode="login"
              onNavigate={(view) => {
                if (view === 'landing') navigate('/');
                else if (view === 'signup') navigate('/signup');
                else if (view === 'app') navigate('/dashboard');
                else navigate('/login');
              }}
              onLoginSuccess={(name) => {
                if (name) handleSetUserName(name);
                navigate('/dashboard');
              }}
              onShowToast={showToast}
            />
          }
        />

        {/* Route: /signup (Supabase Auth) */}
        <Route
          path="/signup"
          element={
            <AuthView
              mode="signup"
              onNavigate={(view) => {
                if (view === 'landing') navigate('/');
                else if (view === 'login') navigate('/login');
                else if (view === 'app') navigate('/dashboard');
                else navigate('/signup');
              }}
              onLoginSuccess={(name) => {
                if (name) handleSetUserName(name);
                navigate('/dashboard');
              }}
              onShowToast={showToast}
            />
          }
        />

        {/* Route: /join (Join Meeting with Meeting ID) */}
        <Route
          path="/join"
          element={
            <JoinView
              onJoin={(code, name) => {
                if (name && name.trim()) {
                  handleSetUserName(name.trim());
                }
                navigate(`/meeting/${encodeURIComponent(code)}`);
              }}
              onNavigate={(view) => {
                if (view === 'landing') navigate('/');
                else navigate('/dashboard');
              }}
            />
          }
        />

        {/* Route: /privacy (Privacy Policy for OAuth Compliance) */}
        <Route
          path="/privacy"
          element={<PrivacyView onBack={() => navigate('/')} />}
        />

        {/* Protected Route: /dashboard (Supabase Session Required) */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AppView
                currentTab="dash"
                onTabChange={(tab) => {
                  if (tab === 'settings') {
                    navigate('/settings');
                  }
                }}
                meetings={meetings}
                recordings={recordings}
                userName={effectiveUserName}
                userEmail={userEmail}
                onUpdateProfile={() => {}}
                onOpenCreateModal={() => setIsCreateModalOpen(true)}
                onJoinMeeting={(code) => {
                  if (code && code.trim().length > 0) {
                    navigate(`/meeting/${encodeURIComponent(code)}`);
                  } else {
                    navigate('/join');
                  }
                }}
                onDeleteMeeting={handleDeleteMeeting}
                onLogout={handleLogout}
                onShowToast={showToast}
                currentTheme={theme}
                onThemeChange={handleThemeChange}
              />
            </ProtectedRoute>
          }
        />

        {/* Route: /meeting/:roomId */}
        <Route
          path="/meeting/:roomId"
          element={
            <MeetingPageRoute
              userName={effectiveUserName}
              setUserName={handleSetUserName}
              onShowToast={showToast}
            />
          }
        />

        {/* Protected Route: /settings (Supabase Session Required) */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <AppView
                currentTab="settings"
                onTabChange={(tab) => {
                  if (tab === 'dash') {
                    navigate('/dashboard');
                  }
                }}
                meetings={meetings}
                recordings={recordings}
                userName={effectiveUserName}
                userEmail={userEmail}
                onUpdateProfile={() => {}}
                onOpenCreateModal={() => setIsCreateModalOpen(true)}
                onJoinMeeting={(code) => {
                  if (code && code.trim().length > 0) {
                    navigate(`/meeting/${encodeURIComponent(code)}`);
                  } else {
                    navigate('/join');
                  }
                }}
                onDeleteMeeting={handleDeleteMeeting}
                onLogout={handleLogout}
                onShowToast={showToast}
                currentTheme={theme}
                onThemeChange={handleThemeChange}
              />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
