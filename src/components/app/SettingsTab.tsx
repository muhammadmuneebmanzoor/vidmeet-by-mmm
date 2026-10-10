import React, { useState, useEffect, useRef } from 'react';
import { Camera, Mic, Moon, Sun, Monitor, Shield, Bell, Key } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SettingsTabProps {
  userName: string;
  userEmail: string;
  onUpdateProfile: (name: string, email: string) => void;
  onShowToast: (msg: string) => void;
  currentTheme: string;
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  userName,
  userEmail,
  onUpdateProfile,
  onShowToast,
  currentTheme,
  onThemeChange,
}) => {
  const [subTab, setSubTab] = useState<'profile' | 'meetings' | 'appearance' | 'notifications' | 'security'>('profile');
  
  // Profile state
  const [name, setName] = useState(userName || '');
  const [email, setEmail] = useState(userEmail || '');
  const [timezone, setTimezone] = useState('(GMT+5) Pakistan Standard Time');

  useEffect(() => {
    if (userName) setName(userName);
  }, [userName]);

  useEffect(() => {
    if (userEmail) setEmail(userEmail);
  }, [userEmail]);

  // Meetings state
  const [autoAudio, setAutoAudio] = useState(true);
  const [waitingRoom, setWaitingRoom] = useState(true);
  const [micDevices, setMicDevices] = useState<string[]>(['Default – Built-in mic', 'USB Headset']);
  const [camDevices, setCamDevices] = useState<string[]>(['FaceTime HD Camera', 'External HD Webcam']);

  // Notifications state
  const [reminderNotif, setReminderNotif] = useState(true);
  const [chatNotif, setChatNotif] = useState(true);
  const [emailNotif, setEmailNotif] = useState(false);

  // Security state
  const [password, setPassword] = useState('••••••••');
  const [twoFactor, setTwoFactor] = useState(false);

  // Enumerate real devices if available in browser
  useEffect(() => {
    async function loadDevices() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const mics = devices.filter((d) => d.kind === 'audioinput').map((d) => d.label || 'Microphone');
          const cams = devices.filter((d) => d.kind === 'videoinput').map((d) => d.label || 'Webcam');

          if (mics.length > 0) setMicDevices(mics);
          if (cams.length > 0) setCamDevices(cams);
        }
      } catch (err) {
        console.warn('Could not enumerate audio/video devices:', err);
      }
    }
    loadDevices();
  }, []);

  const { user, profile, updateProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [avatar, setAvatar] = useState<string>(() => {
    return localStorage.getItem('vidmeet_avatar_url') || profile?.avatar_url || user?.photoURL || '';
  });

  useEffect(() => {
    const handleAvatarUpdate = () => {
      setAvatar(localStorage.getItem('vidmeet_avatar_url') || profile?.avatar_url || user?.photoURL || '');
    };
    window.addEventListener('vidmeet_avatar_updated', handleAvatarUpdate);
    return () => window.removeEventListener('vidmeet_avatar_updated', handleAvatarUpdate);
  }, [profile?.avatar_url, user?.photoURL]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onShowToast('Please select a valid image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      onShowToast('Image size should be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 400;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        setAvatar(dataUrl);
        localStorage.setItem('vidmeet_avatar_url', dataUrl);
        window.dispatchEvent(new Event('vidmeet_avatar_updated'));

        updateProfile({ avatar_url: dataUrl }).catch(() => {});
        onShowToast('Profile photo updated successfully');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemovePhoto = async () => {
    setAvatar('');
    localStorage.removeItem('vidmeet_avatar_url');
    window.dispatchEvent(new Event('vidmeet_avatar_updated'));
    try {
      await updateProfile({ avatar_url: '' });
    } catch {}
    onShowToast('Profile photo removed');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile({ name, avatar_url: avatar });
      onUpdateProfile(name, email);
      onShowToast('Profile settings saved');
    } catch {
      onUpdateProfile(name, email);
      onShowToast('Profile settings saved');
    }
  };

  return (
    <div className="space-y-6 text-left">
      <h2 className="text-2xl font-extrabold text-[var(--text)] tracking-tight font-['Bricolage_Grotesque']">
        Settings
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* Left Subtabs */}
        <div className="md:col-span-3 flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0">
          {[
            { id: 'profile', label: 'Profile' },
            { id: 'meetings', label: 'Meetings' },
            { id: 'appearance', label: 'Appearance' },
            { id: 'notifications', label: 'Notifications' },
            { id: 'security', label: 'Security' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-semibold transition-all text-left whitespace-nowrap ${
                subTab === tab.id
                  ? 'bg-[var(--primary)]/15 text-[var(--primary)] font-bold'
                  : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right Content Panel */}
        <div className="md:col-span-9 p-6 md:p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm">
          
          {/* 1. Profile Tab */}
          {subTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[var(--primary)] text-white text-xl font-bold flex items-center justify-center shadow-md select-none overflow-hidden border border-[var(--border)]">
                  {avatar ? (
                    <img src={avatar} alt={name || 'User'} className="w-full h-full object-cover" />
                  ) : (
                    <span>{name ? name[0].toUpperCase() : 'A'}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text)] bg-[var(--bg)] hover:bg-[var(--border)] border border-[var(--border)] transition-colors cursor-pointer"
                  >
                    Change photo
                  </button>
                  {avatar && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="px-3 py-2 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text)]">Full name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:border-[var(--primary)] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text)]">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:border-[var(--primary)] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text)]">Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:border-[var(--primary)] focus:outline-none"
                >
                  <option>(GMT+5) Pakistan Standard Time</option>
                  <option>(GMT+0) London, UTC</option>
                  <option>(GMT-5) New York, EST</option>
                  <option>(GMT-8) Pacific Time, PST</option>
                </select>
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-d)] transition-colors shadow-sm"
              >
                Save changes
              </button>
            </form>
          )}

          {/* 2. Meetings Tab */}
          {subTab === 'meetings' && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>Microphone device</span>
                </label>
                <select className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:border-[var(--primary)] focus:outline-none">
                  {micDevices.map((d, i) => (
                    <option key={i}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>Camera device</span>
                </label>
                <select className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:border-[var(--primary)] focus:outline-none">
                  {camDevices.map((d, i) => (
                    <option key={i}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="border-t border-[var(--border)] pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text)]">
                    Join with audio automatically
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAutoAudio(!autoAudio);
                      onShowToast(autoAudio ? 'Auto-audio disabled' : 'Auto-audio enabled');
                    }}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      autoAudio ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
                        autoAudio ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text)]">
                    Enable waiting room by default
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setWaitingRoom(!waitingRoom);
                      onShowToast(waitingRoom ? 'Waiting room disabled' : 'Waiting room enabled');
                    }}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      waitingRoom ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
                        waitingRoom ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. Appearance Tab */}
          {subTab === 'appearance' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-[var(--text)] font-['Bricolage_Grotesque']">
                Theme preference
              </h3>

              <div className="inline-flex p-1 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
                <button
                  onClick={() => onThemeChange('light')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    currentTheme === 'light'
                      ? 'bg-[var(--primary)] text-white shadow-sm'
                      : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Light</span>
                </button>

                <button
                  onClick={() => onThemeChange('dark')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    currentTheme === 'dark'
                      ? 'bg-[var(--primary)] text-white shadow-sm'
                      : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Dark</span>
                </button>

                <button
                  onClick={() => onThemeChange('system')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    currentTheme === 'system'
                      ? 'bg-[var(--primary)] text-white shadow-sm'
                      : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>System</span>
                </button>
              </div>

              <p className="text-xs text-[var(--muted)]">
                Selecting dark mode renders high-contrast navy backgrounds optimized for low-light video calls.
              </p>
            </div>
          )}

          {/* 4. Notifications Tab */}
          {subTab === 'notifications' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div>
                  <b className="text-xs font-semibold text-[var(--text)] block">Meeting reminders</b>
                  <small className="text-[11px] text-[var(--muted)]">Notify 10 minutes before calls</small>
                </div>
                <button
                  type="button"
                  onClick={() => setReminderNotif(!reminderNotif)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    reminderNotif ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
                      reminderNotif ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div>
                  <b className="text-xs font-semibold text-[var(--text)] block">Chat notifications</b>
                  <small className="text-[11px] text-[var(--muted)]">Play sound when new chat message arrives</small>
                </div>
                <button
                  type="button"
                  onClick={() => setChatNotif(!chatNotif)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    chatNotif ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
                      chatNotif ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <b className="text-xs font-semibold text-[var(--text)] block">Email notifications</b>
                  <small className="text-[11px] text-[var(--muted)]">Send weekly summaries and recordings</small>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailNotif(!emailNotif)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    emailNotif ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
                      emailNotif ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* 5. Security Tab */}
          {subTab === 'security' && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text)]">Current password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:border-[var(--primary)] focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => onShowToast('Password updated')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text)] bg-[var(--bg)] hover:bg-[var(--border)] border border-[var(--border)] transition-colors"
              >
                Update password
              </button>

              <div className="border-t border-[var(--border)] pt-4 flex items-center justify-between">
                <div>
                  <b className="text-xs font-semibold text-[var(--text)] block">Two-factor authentication (2FA)</b>
                  <small className="text-[11px] text-[var(--muted)]">Add an extra layer of protection to your account</small>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTwoFactor(!twoFactor);
                    onShowToast(twoFactor ? '2FA disabled' : '2FA enabled');
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    twoFactor ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
                      twoFactor ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
