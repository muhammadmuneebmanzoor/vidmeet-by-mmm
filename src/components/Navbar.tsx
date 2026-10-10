import React from 'react';
import { Video, Sun, Moon, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  onNavigate: (view: 'landing' | 'login' | 'signup' | 'join' | 'app') => void;
  onScrollToSection?: (sectionId: string) => void;
  currentTheme?: string;
  onThemeChange?: (theme: 'light' | 'dark' | 'system') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onNavigate,
  onScrollToSection,
  currentTheme = 'light',
  onThemeChange,
}) => {
  const { user } = useAuth();

  return (
    <nav className="sticky top-0 z-40 flex items-center justify-between px-6 md:px-12 py-4 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md transition-colors">
      {/* Logo */}
      <div 
        onClick={() => onNavigate('landing')}
        className="flex items-center gap-2.5 font-extrabold text-xl tracking-tight cursor-pointer select-none font-['Bricolage_Grotesque']"
      >
        <img 
          src="/logo.png" 
          alt="VidMeet MMM Logo" 
          className="w-9 h-9 object-contain rounded-lg shadow-sm bg-white p-0.5 border border-[var(--border)]"
          referrerPolicy="no-referrer"
        />
        <div className="flex flex-col leading-none">
          <span className="text-[var(--text)] font-extrabold text-lg">VidMeet</span>
          <small className="text-[11px] font-medium text-[var(--muted)] tracking-wide font-sans">by MMM</small>
        </div>
      </div>

      {/* Center Nav Links */}
      <div className="hidden md:flex items-center gap-7 text-sm font-medium text-[var(--muted)]">
        <button 
          onClick={() => onScrollToSection ? onScrollToSection('features') : onNavigate('landing')}
          className="hover:text-[var(--text)] transition-colors cursor-pointer"
        >
          Features
        </button>
        <button 
          onClick={() => onScrollToSection ? onScrollToSection('about-dev') : onNavigate('landing')}
          className="hover:text-[var(--primary)] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          About Developer
        </button>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2.5">
        {/* Theme Switch Button on Home Page */}
        {onThemeChange && (
          <button
            onClick={() => onThemeChange(currentTheme === 'dark' ? 'light' : 'dark')}
            className="w-9 h-9 rounded-xl border border-[var(--border)] hover:bg-[var(--surface)] flex items-center justify-center text-[var(--text)] transition-colors shadow-sm cursor-pointer"
            title={`Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label="Toggle theme"
          >
            {currentTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-500" />
            )}
          </button>
        )}

        {user ? (
          <button
            onClick={() => onNavigate('app')}
            className="px-4 py-2 text-sm font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-d)] rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
          >
            <span>Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <>
            <button
              onClick={() => onNavigate('login')}
              className="px-4 py-2 text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface)] border border-[var(--border)] rounded-xl transition-all shadow-sm cursor-pointer"
            >
              Log in
            </button>
            <button
              onClick={() => onNavigate('signup')}
              className="px-4 py-2 text-sm font-semibold text-white bg-[var(--primary)] hover:bg-[var(--primary-d)] rounded-xl transition-all shadow-sm cursor-pointer"
            >
              Sign up
            </button>
          </>
        )}
      </div>
    </nav>
  );
};
