import React from 'react';
import { ArrowLeft, Shield, Lock, Eye, FileText, CheckCircle2, Mail, ExternalLink } from 'lucide-react';

export const PrivacyView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)] hover:underline cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to VidMeet by MMM Home</span>
        </button>

        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <Shield className="w-3.5 h-3.5" />
            <span>Official Privacy Policy</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-['Bricolage_Grotesque']">
            VidMeet by MMM Privacy Policy
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Effective Date: October 2026 · App Name: <strong>VidMeet by MMM (VidMeet-by-MMM)</strong>
          </p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-[var(--muted)]">
          {/* Section 1 */}
          <section className="space-y-3 bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)]">
            <h2 className="text-lg font-bold text-[var(--text)] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[var(--primary)]" />
              1. Overview & Purpose of the Application
            </h2>
            <p>
              <strong>VidMeet by MMM</strong> ("VidMeet", "we", "our") is a full-stack video conferencing and real-time collaboration application developed by Muhammad Muneeb Manzoor. The purpose of VidMeet by MMM is to provide users with secure, high-definition online video meetings, interactive chat, meeting scheduling, and screen sharing capabilities without complexity.
            </p>
            <p>
              This Privacy Policy explains how we collect, use, store, and protect your information when you access our application or authenticate via Google OAuth.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3 bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)]">
            <h2 className="text-lg font-bold text-[var(--text)] flex items-center gap-2">
              <Eye className="w-5 h-5 text-[var(--primary)]" />
              2. Information We Collect
            </h2>
            <p>
              We only collect essential data required to provide meeting and authentication services:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-[var(--text)]">
              <li><strong>Account Information:</strong> When signing in with Google OAuth, we receive your email address, full name, and avatar picture provided by Google.</li>
              <li><strong>Meeting Data:</strong> Meeting room titles, participant display names, scheduling timestamps, and encrypted chat messages sent during meetings.</li>
              <li><strong>Technical Session Data:</strong> Ephemeral WebRTC connection tokens used by LiveKit to establish peer-to-peer audio and video streams. We do not store or record private audio/video streams unless you explicitly record a session.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3 bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)]">
            <h2 className="text-lg font-bold text-[var(--text)] flex items-center gap-2">
              <Lock className="w-5 h-5 text-[var(--primary)]" />
              3. Google API User Data Policy Compliance
            </h2>
            <p>
              VidMeet by MMM requests access only to the standard, non-sensitive Google OAuth scopes:
            </p>
            <div className="bg-[var(--bg)] p-3.5 rounded-xl border border-[var(--border)] font-mono text-xs text-[var(--text)] space-y-1">
              <div>• <code>.../auth/userinfo.email</code> (to authenticate your account)</div>
              <div>• <code>.../auth/userinfo.profile</code> (to display your name and avatar)</div>
              <div>• <code>openid</code> (for secure OAuth2 authentication token verification)</div>
            </div>
            <p>
              <strong>Google User Data Disclosure:</strong> VidMeet by MMM’s use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer" className="text-[var(--primary)] underline inline-flex items-center gap-1">Google API Services User Data Policy <ExternalLink className="w-3 h-3" /></a>, including the Limited Use requirements.
            </p>
            <p>
              We do <strong>not</strong> sell, rent, or transfer your Google user data to any third-party advertisers, data brokers, or external AI model training systems.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3 bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)]">
            <h2 className="text-lg font-bold text-[var(--text)] flex items-center gap-2">
              <Shield className="w-5 h-5 text-[var(--primary)]" />
              4. Data Storage, Security & Retention
            </h2>
            <p>
              Your account authentication is secured via Firebase Authentication with industry-standard token validation. All data in transit is encrypted using industry-standard TLS 1.3 / HTTPS encryption.
            </p>
            <p>
              We retain account data as long as your account remains active. You may delete your account or meeting history at any time through the application settings or by contacting the developer.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3 bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)]">
            <h2 className="text-lg font-bold text-[var(--text)] flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[var(--primary)]" />
              5. How to Revoke Access to Google Data
            </h2>
            <p>
              You may revoke VidMeet by MMM's access to your Google Account at any time directly through Google’s security controls:
            </p>
            <p>
              Visit <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer" className="text-[var(--primary)] font-semibold underline inline-flex items-center gap-1">Google Account Third-Party Permissions <ExternalLink className="w-3.5 h-3.5" /></a>, select <strong>VidMeet by MMM</strong>, and click <strong>Remove Access</strong>.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3 bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)]">
            <h2 className="text-lg font-bold text-[var(--text)] flex items-center gap-2">
              <Mail className="w-5 h-5 text-[var(--primary)]" />
              6. Contact & Developer Information
            </h2>
            <p>
              For any questions, data deletion requests, or privacy inquiries regarding VidMeet by MMM, please contact the developer:
            </p>
            <div className="bg-[var(--bg)] p-4 rounded-xl border border-[var(--border)] text-xs text-[var(--text)] space-y-1">
              <div><strong>Developer:</strong> Muhammad Muneeb Manzoor</div>
              <div><strong>Application:</strong> VidMeet by MMM (VidMeet-by-MMM)</div>
              <div><strong>Support & Privacy Email:</strong> <a href="mailto:muneebmanzoor1214@gmail.com" className="text-[var(--primary)] underline font-medium">muneebmanzoor1214@gmail.com</a></div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
