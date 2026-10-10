import React, { useState, useEffect } from 'react';
import { 
  Home, Video, Calendar, Disc, Users, Settings, 
  Menu, Moon, Sun, Bell, Search, LogOut, HelpCircle, 
  Sparkles, Code2, X 
} from 'lucide-react';
import { AppTab, Meeting, Recording } from '../../types';
import { DashboardTab } from './DashboardTab';
import { MeetingsTab } from './MeetingsTab';
import { CalendarTab } from './CalendarTab';
import { RecordingsTab } from './RecordingsTab';
import { SettingsTab } from './SettingsTab';
import { AboutDeveloperCard } from '../AboutDeveloperCard';
import { UserMenu } from '../UserMenu';

interface AppViewProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  meetings: Meeting[];
  recordings: Recording[];
  userName: string;
  userEmail: string;
  onUpdateProfile: (name: string, email: string) => void;
  onOpenCreateModal: () => void;
  onJoinMeeting: (meetingId: string) => void;
  onDeleteMeeting?: (meetingId: string) => void;
  onLogout: () => void;
  onShowToast: (msg: string) => void;
  currentTheme: string;
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
}

export const AppView: React.FC<AppViewProps> = ({
  currentTab,
  onTabChange,
  meetings,
  recordings = [],
  userName,
  userEmail,
  onUpdateProfile,
  onOpenCreateModal,
  onJoinMeeting,
  onDeleteMeeting,
  onLogout,
  onShowToast,
  currentTheme,
  onThemeChange,
}) => {
  const [activeTab, setActiveTab] = useState<AppTab>(currentTab || 'dash');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showBellMenu, setShowBellMenu] = useState(false);
  const [hasUnreadNotif, setHasUnreadNotif] = useState(meetings.length > 0);

  // Sync prop changes to activeTab
  useEffect(() => {
    if (currentTab) {
      setActiveTab(currentTab);
    }
  }, [currentTab]);

  // Derive notifications from actual meetings
  const notifications = meetings.length > 0
    ? meetings.slice(0, 4).map((m) => ({
        title: `${m.title} · ${m.date} at ${m.time}`,
        type: 'meeting',
        color: 'bg-indigo-500',
        code: m.code,
      }))
    : [
        {
          title: 'Welcome to VidMeet! Start an instant meeting or join via code.',
          type: 'info',
          color: 'bg-emerald-500',
          code: '',
        },
      ];

  const handleNavClick = (tab: AppTab) => {
    setActiveTab(tab);
    onTabChange(tab);
    setIsSidebarOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-[var(--bg)] text-[var(--text)] transition-colors relative">
      
      {/* Mobile Sidebar Backdrop */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 md:hidden backdrop-blur-xs"
        />
      )}

      {/* Sidebar (240px wide) */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 h-screen w-64 bg-[var(--surface)] border-r border-[var(--border)] p-4 flex flex-col justify-between transition-transform duration-200 select-none ${
          isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="space-y-6">
          {/* Logo */}
          <div className="flex items-center justify-between px-2">
            <div 
              onClick={() => handleNavClick('dash')}
              className="flex items-center gap-2.5 font-extrabold text-lg cursor-pointer select-none font-['Bricolage_Grotesque']"
            >
              <img
                src="/logo.png"
                alt="VidMeet MMM Logo"
                className="w-9 h-9 object-contain rounded-lg shadow-sm bg-white p-0.5 border border-[var(--border)]"
                referrerPolicy="no-referrer"
              />
              <div className="flex flex-col leading-none text-left">
                <span className="text-[var(--text)] font-extrabold">VidMeet</span>
                <small className="text-[11px] font-medium text-[var(--muted)]">by MMM</small>
              </div>
            </div>

            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--text)] md:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <button
              onClick={() => handleNavClick('dash')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-colors text-left cursor-pointer ${
                activeTab === 'dash'
                  ? 'bg-[var(--primary)]/15 text-[var(--primary)] font-bold'
                  : 'text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => handleNavClick('meetings')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-colors text-left cursor-pointer ${
                activeTab === 'meetings'
                  ? 'bg-[var(--primary)]/15 text-[var(--primary)] font-bold'
                  : 'text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>Meetings</span>
            </button>

            <button
              onClick={() => handleNavClick('calendar')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-colors text-left cursor-pointer ${
                activeTab === 'calendar'
                  ? 'bg-[var(--primary)]/15 text-[var(--primary)] font-bold'
                  : 'text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Calendar</span>
            </button>

            {/* Special Nav: About Developer */}
            <button
              onClick={() => handleNavClick('about-dev')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-colors text-left cursor-pointer ${
                activeTab === 'about-dev'
                  ? 'bg-amber-500/15 text-amber-500 font-bold border border-amber-500/30'
                  : 'text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="truncate">About Developer</span>
            </button>

            <button
              onClick={() => handleNavClick('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-colors text-left cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-[var(--primary)]/15 text-[var(--primary)] font-bold'
                  : 'text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)]'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* User Card at bottom of sidebar */}
        <div className="pt-4 border-t border-[var(--border)]">
          <UserMenu
            userName={userName || 'User'}
            userEmail={userEmail || ''}
            plan="Free plan"
            onOpenSettings={() => handleNavClick('settings')}
            onOpenAboutDev={() => handleNavClick('about-dev')}
            onHelp={() => onShowToast('Help center: VidMeet Documentation & Support')}
            onLogout={onLogout}
          />
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 bg-[var(--surface)] border-b border-[var(--border)] backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-xl border border-[var(--border)] hover:bg-[var(--bg)] md:hidden text-[var(--text)] cursor-pointer"
              aria-label="Open sidebar"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Quick search input */}
            <div className="relative hidden sm:block w-72">
              <Search className="w-3.5 h-3.5 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search meetings…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleNavClick('meetings');
                  }
                }}
                className="w-full pl-9 pr-3.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-xs focus:border-[var(--primary)] focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Right Header Icons */}
          <div className="flex items-center gap-2 relative">
            {/* Theme Toggle Button */}
            <button
              onClick={() => onThemeChange(currentTheme === 'dark' ? 'light' : 'dark')}
              className="w-9 h-9 rounded-xl border border-[var(--border)] hover:bg-[var(--bg)] flex items-center justify-center text-[var(--text)] transition-colors cursor-pointer"
              title="Toggle theme"
            >
              {currentTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-[var(--text)]" />
              )}
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowBellMenu(!showBellMenu);
                  setHasUnreadNotif(false);
                }}
                className="w-9 h-9 rounded-xl border border-[var(--border)] hover:bg-[var(--bg)] flex items-center justify-center text-[var(--text)] transition-colors relative cursor-pointer"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {hasUnreadNotif && (
                  <span className="w-2 h-2 rounded-full bg-red-500 absolute top-2 right-2 rec-dot" />
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {showBellMenu && (
                <div className="absolute right-0 top-12 w-80 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl p-3 z-50 text-xs space-y-2 text-left">
                  <div className="flex items-center justify-between px-2 pb-1 border-b border-[var(--border)]">
                    <b className="font-bold text-[var(--text)]">Notifications</b>
                    <span className="text-[10px] text-[var(--muted)]">Recent</span>
                  </div>

                  <div className="space-y-1.5">
                    {notifications.map((n, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          if (n.code) {
                            onJoinMeeting(n.code);
                          }
                          setShowBellMenu(false);
                        }}
                        className={`flex items-start gap-2.5 p-2 rounded-xl hover:bg-[var(--bg)] transition-colors ${
                          n.code ? 'cursor-pointer' : ''
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${n.color} mt-1.5 flex-shrink-0`} />
                        <span className="text-[var(--text)] leading-snug">{n.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 md:p-8 max-w-6xl w-full mx-auto">
          {activeTab === 'dash' && (
            <DashboardTab
              meetings={meetings}
              recordings={recordings}
              userName={userName}
              onOpenCreateModal={onOpenCreateModal}
              onJoinDirect={onJoinMeeting}
              onViewMeetings={() => handleNavClick('meetings')}
              onShowToast={onShowToast}
            />
          )}

          {activeTab === 'meetings' && (
            <MeetingsTab
              meetings={meetings}
              onOpenCreateModal={onOpenCreateModal}
              onJoinMeeting={onJoinMeeting}
              onDeleteMeeting={onDeleteMeeting}
              onShowToast={onShowToast}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarTab
              meetings={meetings}
              onOpenCreateModal={onOpenCreateModal}
              onJoinMeeting={onJoinMeeting}
              onShowToast={onShowToast}
            />
          )}

          {activeTab === 'recs' && (
            <RecordingsTab
              recordings={recordings}
              onShowToast={onShowToast}
            />
          )}

          {activeTab === 'about-dev' && (
            <div className="space-y-6">
              <AboutDeveloperCard onShowToast={onShowToast} />
            </div>
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              userName={userName}
              userEmail={userEmail}
              onUpdateProfile={onUpdateProfile}
              onShowToast={onShowToast}
              currentTheme={currentTheme}
              onThemeChange={onThemeChange}
            />
          )}
        </main>
      </div>
    </div>
  );
};
