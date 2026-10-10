import React, { useState } from 'react';
import { Video, ArrowLeft, Check, ShieldCheck, AlertCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthViewProps {
  mode: 'login' | 'signup';
  onNavigate: (view: 'landing' | 'login' | 'signup' | 'app') => void;
  onLoginSuccess: (name: string, email: string) => void;
  onShowToast: (msg: string) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  mode,
  onNavigate,
  onLoginSuccess,
  onShowToast,
}) => {
  const { signIn, signUp, signInWithGoogle, user, sendPasswordReset } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [authError, setAuthError] = useState(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const err = searchParams.get('error_description') || hashParams.get('error_description');
      if (err) return err.replace(/\+/g, ' ');
    }
    return '';
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Automatically transition if user is already authenticated or just returned from OAuth
  React.useEffect(() => {
    if (user) {
      const displayName = user.user_metadata?.name || user.email?.split('@')[0] || 'User';
      onLoginSuccess(displayName, user.email || '');
    }
  }, [user, onLoginSuccess]);

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: 'Enter a password', color: 'bg-slate-200 dark:bg-slate-700' };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/\d/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    switch (score) {
      case 1:
        return { score: 1, label: 'Weak', color: 'bg-red-500' };
      case 2:
        return { score: 2, label: 'Fair', color: 'bg-amber-500' };
      case 3:
        return { score: 3, label: 'Good', color: 'bg-emerald-500' };
      case 4:
        return { score: 4, label: 'Strong', color: 'bg-emerald-500' };
      default:
        return { score: 0, label: 'Weak', color: 'bg-red-500' };
    }
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setPasswordError('');
    setAuthError('');

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError('Enter a valid email address (e.g. name@company.com)');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'signup') {
        const cleanName = fullName.trim() || email.split('@')[0] || 'User';
        const { error } = await signUp(email, password, cleanName);
        if (error) {
          setAuthError(error.message);
          setIsSubmitting(false);
          return;
        }
        onShowToast('Account created successfully');
        onLoginSuccess(cleanName, email);
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          setAuthError(error.message);
          setIsSubmitting(false);
          return;
        }
        const displayName = fullName.trim() || user?.user_metadata?.name || email.split('@')[0] || 'User';
        onShowToast(`Welcome back, ${displayName}`);
        onLoginSuccess(displayName, email);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError('');
    setIsSubmitting(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        const errorMsg = (error as any)?.message || '';
        setAuthError(errorMsg || 'Google sign-in could not be completed. Please try again.');
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Failed to initiate Google sign-in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-[var(--bg)] text-[var(--text)] transition-colors">
      
      {/* Side branding banner */}
      <div className="hidden md:flex flex-col justify-between p-12 bg-[#0b1020] text-white border-r border-[#252d47]">
        <div 
          onClick={() => onNavigate('landing')}
          className="flex items-center gap-2.5 font-extrabold text-xl cursor-pointer select-none font-['Bricolage_Grotesque']"
        >
          <img
            src="/logo.png"
            alt="VidMeet MMM Logo"
            className="w-9 h-9 object-contain rounded-lg shadow-sm bg-white p-0.5 border border-[var(--border)]"
            referrerPolicy="no-referrer"
          />
          <div className="flex flex-col leading-none">
            <span className="font-extrabold text-lg">VidMeet</span>
            <small className="text-[11px] font-medium text-slate-400">by MMM</small>
          </div>
        </div>

        <div className="my-auto space-y-4 max-w-sm">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>End-to-End Encrypted HD Video</span>
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold font-['Bricolage_Grotesque'] leading-tight">
            {mode === 'login' ? 'Clear video. Clear conversations.' : 'Set up in under a minute.'}
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            High-fidelity video conferencing with crystal-clear audio, real-time screen sharing, interactive chat, and instant rooms.
          </p>
        </div>

        <div className="text-xs text-slate-500">
          © 2026 VidMeet by Muhammad Muneeb Manzoor
        </div>
      </div>

      {/* Form area */}
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md space-y-6">
          
          {/* Top back button for mobile */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => onNavigate('landing')}
              className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to home</span>
            </button>
            <div className="md:hidden flex items-center gap-2 font-bold font-['Bricolage_Grotesque']">
              <img
                src="/logo.png"
                alt="VidMeet MMM Logo"
                className="w-7 h-7 object-contain rounded-md shadow-xs bg-white p-0.5"
                referrerPolicy="no-referrer"
              />
              <span>VidMeet</span>
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl md:text-3xl font-extrabold text-[var(--text)] tracking-tight font-['Bricolage_Grotesque']">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-sm text-[var(--muted)]">
              {mode === 'login' ? 'Log in to your VidMeet account.' : 'Get started with free HD meetings.'}
            </p>
          </div>

          {/* Auth Error Banner */}
          {authError && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-left text-xs flex items-start gap-2 text-red-500">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text)]">Full name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] focus:border-[var(--primary)] focus:outline-none transition-colors text-sm"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text)]">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError('');
                  setAuthError('');
                }}
                placeholder="you@example.com"
                className={`w-full px-3.5 py-2.5 rounded-xl border ${
                  emailError ? 'border-red-500' : 'border-[var(--border)]'
                } bg-[var(--surface)] text-[var(--text)] focus:border-[var(--primary)] focus:outline-none transition-colors text-sm`}
              />
              {emailError && <p className="text-xs text-red-500 font-medium">{emailError}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text)]">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setAuthError('');
                }}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] focus:border-[var(--primary)] focus:outline-none transition-colors text-sm"
              />
            </div>

            {mode === 'signup' && (
              <div className="space-y-1.5">
                <div className="flex gap-1.5 pt-1">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={`h-1.5 flex-1 rounded-full transition-all ${
                        step <= strength.score ? strength.color : 'bg-[var(--border)]'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex justify-between items-center text-[11px] text-[var(--muted)]">
                  <span>Strength: <strong className="text-[var(--text)]">{strength.label}</strong></span>
                  <span>Minimum 8 characters</span>
                </div>

                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-semibold text-[var(--text)]">Confirm password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setPasswordError('');
                    }}
                    placeholder="••••••••"
                    className={`w-full px-3.5 py-2.5 rounded-xl border ${
                      passwordError ? 'border-red-500' : 'border-[var(--border)]'
                    } bg-[var(--surface)] text-[var(--text)] focus:border-[var(--primary)] focus:outline-none transition-colors text-sm`}
                  />
                  {passwordError && <p className="text-xs text-red-500 font-medium">{passwordError}</p>}
                </div>
              </div>
            )}

            {mode === 'login' && (
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-[var(--text)]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    if (email && email.includes('@')) {
                      const { error } = await sendPasswordReset(email);
                      if (error) {
                        onShowToast(error.message || 'Failed to send password reset');
                      } else {
                        onShowToast(`Password reset link sent to ${email}`);
                      }
                    } else {
                      onShowToast('Please enter your email above to receive reset instructions');
                    }
                  }}
                  className="font-semibold text-[var(--primary)] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-d)] transition-all shadow-md shadow-indigo-500/20 text-sm mt-2 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{mode === 'login' ? 'Logging in...' : 'Creating account...'}</span>
                </>
              ) : (
                <span>{mode === 'login' ? 'Log in' : 'Create account'}</span>
              )}
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-[var(--border)]"></div>
              <span className="flex-shrink mx-3 text-[11px] uppercase tracking-wider text-[var(--muted)] font-semibold">Or</span>
              <div className="flex-grow border-t border-[var(--border)]"></div>
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleGoogleLogin}
              className="w-full py-2.5 rounded-xl font-semibold text-sm border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg)] transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continue with Google</span>
            </button>
          </form>

          <div className="text-center text-xs text-[var(--muted)] pt-2">
            {mode === 'login' ? (
              <span>
                New here?{' '}
                <button
                  onClick={() => onNavigate('signup')}
                  className="font-semibold text-[var(--primary)] hover:underline ml-1 cursor-pointer"
                >
                  Create account
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  onClick={() => onNavigate('login')}
                  className="font-semibold text-[var(--primary)] hover:underline ml-1 cursor-pointer"
                >
                  Log in
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
