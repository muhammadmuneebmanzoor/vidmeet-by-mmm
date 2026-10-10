import React, { useState } from 'react';
import { 
  Video, Monitor, MessageSquare, 
  Calendar, Shield, Users, ArrowRight, CheckCircle2, Lock, User, Hash, Sparkles
} from 'lucide-react';
import { Navbar } from './Navbar';
import { AboutDeveloperCard } from './AboutDeveloperCard';
import { useAuth } from '../context/AuthContext';

interface LandingPageProps {
  onNavigate: (view: 'landing' | 'login' | 'signup' | 'join' | 'app' | 'wait') => void;
  onShowToast: (msg: string) => void;
  currentTheme?: string;
  onThemeChange?: (theme: 'light' | 'dark' | 'system') => void;
  onQuickJoin?: (roomId: string, name: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ 
  onNavigate, 
  onShowToast, 
  currentTheme, 
  onThemeChange,
  onQuickJoin,
}) => {
  const { user, profile } = useAuth();

  const [quickRoomId, setQuickRoomId] = useState('');
  const [quickName, setQuickName] = useState(profile?.name || user?.user_metadata?.name || '');
  const [quickError, setQuickError] = useState('');

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleStartMeetingClick = () => {
    if (!user) {
      onShowToast('Please log in first to start a meeting');
      onNavigate('login');
    } else {
      onNavigate('app');
    }
  };

  const handleQuickJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setQuickError('');

    // Resume AudioContext on mobile user interaction
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

    if (!quickRoomId.trim()) {
      setQuickError('Please enter a meeting room ID or code');
      return;
    }

    if (!quickName.trim()) {
      setQuickError('Please enter your name to be displayed on your video box');
      return;
    }

    const cleanCode = quickRoomId.trim().replace(/^https?:\/\/.*\/meeting\//, '');
    if (onQuickJoin) {
      onQuickJoin(cleanCode, quickName.trim());
    } else {
      onNavigate('join');
    }
  };

  const features = [
    {
      icon: <Video className="w-6 h-6 text-[var(--primary)]" />,
      title: 'Crystal-clear video',
      desc: 'Adaptive HD that holds up on slow networks with low latency.'
    },
    {
      icon: <Monitor className="w-6 h-6 text-[var(--primary)]" />,
      title: 'Screen sharing',
      desc: 'Share a window, tab, or your whole screen in high resolution.'
    },
    {
      icon: <MessageSquare className="w-6 h-6 text-[var(--primary)]" />,
      title: 'Real-time chat',
      desc: 'Instant messaging, interactive reactions and participant notes.'
    },
    {
      icon: <Calendar className="w-6 h-6 text-[var(--primary)]" />,
      title: 'Simple scheduling',
      desc: 'Plan meetings, set passcodes, and send invites in seconds.'
    },
    {
      icon: <Shield className="w-6 h-6 text-[var(--primary)]" />,
      title: 'Secure meetings',
      desc: 'End-to-end encryption, waiting rooms, and comprehensive host controls.'
    },
    {
      icon: <Users className="w-6 h-6 text-[var(--primary)]" />,
      title: 'Works everywhere',
      desc: 'Modern browser, tablet, or phone. No client downloads required.'
    }
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors">
      <Navbar 
        onNavigate={onNavigate} 
        onScrollToSection={scrollToSection} 
        currentTheme={currentTheme}
        onThemeChange={onThemeChange}
      />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 pt-14 md:pt-20 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Text */}
          <div className="lg:col-span-6 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-[var(--primary)] border border-indigo-500/20">
              <span className="w-2 h-2 rounded-full bg-[var(--ok)] animate-ping" />
              <span>VidMeet by MMM · HD Video Meetings</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[var(--text)] leading-[1.05] font-['Bricolage_Grotesque']">
              VidMeet by MMM <br className="hidden sm:block" />
              <span className="text-[var(--primary)]">Meet. Connect. Collaborate.</span>
            </h1>

            <p className="text-lg md:text-xl text-[var(--muted)] max-w-xl leading-relaxed">
              VidMeet by MMM is a secure online video conferencing application. Host instant HD meetings, collaborate with real-time screen sharing, chat securely, and schedule video calls effortlessly on any device without downloads.
            </p>

            <div className="flex flex-wrap gap-3.5 pt-2">
              <button
                onClick={handleStartMeetingClick}
                className="px-6 py-3.5 rounded-xl font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-d)] transition-all shadow-lg shadow-indigo-500/25 flex items-center gap-2 cursor-pointer"
              >
                <span>Start a meeting</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => onNavigate('join')}
                className="px-6 py-3.5 rounded-xl font-bold text-[var(--text)] bg-[var(--surface)] hover:bg-[var(--bg)] border border-[var(--border)] transition-all shadow-sm cursor-pointer"
              >
                Join a meeting
              </button>
            </div>

            <div className="pt-4 flex items-center gap-6 text-xs text-[var(--muted)] font-medium">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[var(--ok)]" />
                <span>Real-time Video</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[var(--ok)]" />
                <span>No install required</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[var(--ok)]" />
                <span>LiveKit & WebRTC</span>
              </div>
            </div>
          </div>

          {/* Right Live Interactive Join Card */}
          <div className="lg:col-span-6">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 shadow-xl text-left space-y-5 relative">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/logo.png"
                    alt="VidMeet MMM Logo"
                    className="w-9 h-9 object-contain rounded-lg shadow-sm bg-white p-0.5 border border-[var(--border)]"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h3 className="font-bold text-sm text-[var(--text)] font-['Bricolage_Grotesque']">
                      Instant Room Gateway
                    </h3>
                    <p className="text-[11px] text-[var(--muted)]">Direct access to live video sessions</p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              </div>

              {quickError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500 animate-in fade-in">
                  {quickError}
                </div>
              )}

              <form onSubmit={handleQuickJoinSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span>Meeting Room ID / Code</span>
                  </label>
                  <input
                    type="text"
                    value={quickRoomId}
                    onChange={(e) => {
                      setQuickRoomId(e.target.value);
                      setQuickError('');
                    }}
                    placeholder="e.g. 492-817-305"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] focus:border-[var(--primary)] focus:outline-none transition-colors text-sm font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span>Your Display Name <span className="text-red-500">*</span></span>
                  </label>
                  <p className="text-[11px] text-[var(--muted)]">This will appear on your video box and be visible to others.</p>
                  <input
                    type="text"
                    value={quickName}
                    onChange={(e) => {
                      setQuickName(e.target.value);
                      setQuickError('');
                    }}
                    placeholder="Enter your name"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] focus:border-[var(--primary)] focus:outline-none transition-colors text-sm"
                  />
                </div>

                <div className="pt-1 flex flex-col sm:flex-row items-center gap-3">
                  <button
                    type="submit"
                    className="w-full sm:flex-1 py-3 rounded-xl font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-d)] transition-all shadow-md shadow-indigo-500/20 text-sm cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Join Meeting Room</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleStartMeetingClick}
                    className="w-full sm:w-auto px-4 py-3 rounded-xl font-semibold text-xs text-[var(--text)] bg-[var(--bg)] hover:bg-[var(--border)]/30 border border-[var(--border)] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Start a Meeting
                  </button>
                </div>
              </form>

              <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--muted)]">
                <span>🔐 Secure encrypted rooms</span>
                <span>⚡ LiveKit SFU + WebRTC</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-7xl mx-auto px-6 md:px-12 py-16 border-t border-[var(--border)]">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl md:text-4xl font-extrabold text-[var(--text)] tracking-tight font-['Bricolage_Grotesque']">
            Everything a meeting needs. Nothing it doesn't.
          </h2>
          <p className="text-[var(--muted)] mt-3 text-base">
            Engineered with modern WebRTC, responsive video feeds, and frictionless browser access.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat, index) => (
            <div
              key={index}
              className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow text-left"
            >
              <div className="p-3 rounded-xl bg-indigo-500/10 w-max mb-4">
                {feat.icon}
              </div>
              <h3 className="text-lg font-bold text-[var(--text)] mb-2">
                {feat.title}
              </h3>
              <p className="text-sm text-[var(--muted)] leading-relaxed">
                {feat.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* About the Developer Showcase Section */}
      <section id="about-dev" className="max-w-7xl mx-auto px-6 md:px-12 py-16">
        <AboutDeveloperCard onShowToast={onShowToast} />
      </section>

      {/* CTA Box */}
      <section className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <div className="rounded-3xl bg-[#0b1020] border border-[#252d47] p-10 md:p-16 text-center text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
          
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight font-['Bricolage_Grotesque'] mb-4">
            Your next meeting starts here
          </h2>
          <p className="text-slate-300 max-w-md mx-auto mb-8 text-base">
            Free for up to 40 minutes. No downloads, zero fuss. Instant HD collaboration.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => onNavigate('signup')}
              className="px-8 py-3.5 rounded-xl font-bold bg-[var(--primary)] hover:bg-[var(--primary-d)] text-white shadow-lg transition-all"
            >
              Create free account
            </button>
            <button
              onClick={() => onNavigate('app')}
              className="px-8 py-3.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all"
            >
              Enter Dashboard
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-8 px-6 md:px-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--muted)]">
          <div className="flex items-center gap-2.5 font-semibold">
            <img
              src="/logo.png"
              alt="VidMeet MMM Logo"
              className="w-6 h-6 object-contain rounded-md shadow-xs bg-white p-0.5 border border-[var(--border)]"
              referrerPolicy="no-referrer"
            />
            <span>© 2026 VidMeet by MMM</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => scrollToSection('about-dev')} className="hover:text-[var(--text)] transition-colors cursor-pointer">
              Developer Profile
            </button>
            <a href="/privacy" className="hover:text-[var(--text)] transition-colors cursor-pointer">
              Privacy Policy
            </a>
            <button onClick={() => onShowToast('Terms of service verified.')} className="hover:text-[var(--text)] transition-colors cursor-pointer">
              Terms
            </button>
            <button onClick={() => onShowToast('All systems operational: WebRTC, Cloud, Media Relays 100%')} className="hover:text-[var(--text)] transition-colors cursor-pointer">
              Status
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
