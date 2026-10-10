import React, { useState, useRef, useEffect } from 'react';
import { User, Settings, Sparkles, HelpCircle, LogOut, ChevronUp } from 'lucide-react';

export interface UserMenuProps {
  userName: string;
  userEmail: string;
  avatarUrl?: string | null;
  plan?: string;
  onOpenSettings: () => void;
  onOpenAboutDev?: () => void;
  onLogout: () => void;
  onHelp?: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({
  userName,
  userEmail,
  avatarUrl,
  plan = 'Pro plan',
  onOpenSettings,
  onOpenAboutDev,
  onLogout,
  onHelp,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [internalAvatar, setInternalAvatar] = useState<string>(() => {
    return avatarUrl || localStorage.getItem('vidmeet_avatar_url') || '';
  });

  useEffect(() => {
    if (avatarUrl !== undefined) {
      setInternalAvatar(avatarUrl || '');
    }
  }, [avatarUrl]);

  useEffect(() => {
    const handleAvatarUpdate = () => {
      setInternalAvatar(localStorage.getItem('vidmeet_avatar_url') || '');
    };
    window.addEventListener('vidmeet_avatar_updated', handleAvatarUpdate);
    return () => window.removeEventListener('vidmeet_avatar_updated', handleAvatarUpdate);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div className="relative w-full text-left" ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--bg)] transition-colors text-left group select-none cursor-pointer"
      >
        <div className="w-9 h-9 rounded-full bg-[var(--primary)] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden border border-[var(--border)]">
          {internalAvatar ? (
            <img src={internalAvatar} alt={userName} className="w-full h-full object-cover" />
          ) : (
            userName ? userName[0].toUpperCase() : 'U'
          )}
        </div>
        <div className="flex-1 min-w-0">
          <b className="text-xs font-bold text-[var(--text)] block truncate">
            {userName}
          </b>
          <small className="text-[10px] text-[var(--muted)] block">{plan}</small>
        </div>
        <ChevronUp
          className={`w-3.5 h-3.5 text-[var(--muted)] group-hover:text-[var(--text)] transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute bottom-14 left-0 right-0 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl p-2 z-50 text-xs space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="p-2 border-b border-[var(--border)] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[var(--primary)] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 overflow-hidden border border-[var(--border)]">
              {internalAvatar ? (
                <img src={internalAvatar} alt={userName} className="w-full h-full object-cover" />
              ) : (
                userName ? userName[0].toUpperCase() : 'U'
              )}
            </div>
            <div className="min-w-0 flex-1">
              <b className="text-[var(--text)] block truncate">{userName}</b>
              <span className="text-[11px] text-[var(--muted)] truncate block">{userEmail}</span>
            </div>
          </div>

          <button
            onClick={() => {
              setIsOpen(false);
              onOpenSettings();
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] text-[var(--text)] transition-colors flex items-center gap-2"
          >
            <Settings className="w-3.5 h-3.5 text-[var(--muted)]" />
            <span>Profile & Settings</span>
          </button>

          {onOpenAboutDev && (
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenAboutDev();
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] text-amber-500 font-semibold transition-colors flex items-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>About Developer</span>
            </button>
          )}

          {onHelp && (
            <button
              onClick={() => {
                setIsOpen(false);
                onHelp();
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--bg)] text-[var(--text)] transition-colors flex items-center gap-2"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[var(--muted)]" />
              <span>Help & Support</span>
            </button>
          )}

          <div className="border-t border-[var(--border)] my-1" />

          <button
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-500 font-semibold transition-colors flex items-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
};
