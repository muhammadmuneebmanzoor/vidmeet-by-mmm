import React, { useState } from 'react';
import { Mail, Linkedin, Instagram, Facebook, Check, Copy, ExternalLink, Code2, Sparkles } from 'lucide-react';
import { INITIAL_DEVELOPER } from '../data/mockData';

interface AboutDeveloperProps {
  onShowToast?: (msg: string) => void;
  className?: string;
}

export const AboutDeveloperCard: React.FC<AboutDeveloperProps> = ({ onShowToast, className = '' }) => {
  const [copied, setCopied] = useState(false);
  const dev = INITIAL_DEVELOPER;

  const handleCopyEmail = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard.writeText(dev.email);
    setCopied(true);
    onShowToast?.(`Email copied: ${dev.email}`);
    setTimeout(() => setCopied(false), 2500);
    // Also trigger mailto
    window.location.href = `mailto:${dev.email}`;
  };

  const handleSocialClick = (platform: string, url: string) => {
    onShowToast?.(`Opening ${platform}...`);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={`w-full max-w-4xl mx-auto ${className}`}>
      {/* Outer Card matching approved image design */}
      <div className="relative rounded-2xl bg-[#0b1329] border border-[#1b2b4e] p-7 md:p-10 shadow-2xl overflow-hidden text-left text-slate-100">
        
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        {/* Badge: ABOUT THE DEVELOPER */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/50 bg-amber-500/10 text-amber-300 text-xs font-bold tracking-wider uppercase mb-5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>ABOUT THE DEVELOPER</span>
        </div>

        {/* Developer Name */}
        <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight font-['Bricolage_Grotesque'] mb-1">
          {dev.name}
        </h2>

        {/* Subtitle / Specialization */}
        <p className="text-amber-400 font-semibold text-base md:text-lg mb-6 flex items-center gap-2">
          <span>{dev.role}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          <span>{dev.specialization}</span>
        </p>

        {/* Bio paragraphs */}
        <div className="space-y-4 text-slate-300 leading-relaxed text-sm md:text-base font-normal max-w-3xl mb-8">
          <p>{dev.bio1}</p>
          <p>{dev.bio2}</p>
        </div>

        {/* Skill Badges / Tags */}
        <div className="flex flex-wrap gap-2.5 mb-8">
          {dev.skills.map((skill, index) => (
            <span
              key={index}
              className="inline-flex items-center px-4 py-1.5 rounded-full text-xs md:text-sm font-medium bg-[#13203c] border border-[#23355b] text-slate-200 hover:border-indigo-400/60 hover:text-white transition-all cursor-default shadow-sm"
            >
              {skill}
            </span>
          ))}
        </div>

        <div className="border-t border-[#1b2b4e]/80 pt-6">
          {/* Subsection Title */}
          <h3 className="text-white font-bold text-base md:text-lg mb-4">
            Get in touch & Connect
          </h3>

          {/* Social / Contact Buttons Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Email Button */}
            <button
              onClick={handleCopyEmail}
              className="group flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#13203c]/90 hover:bg-[#1c2e55] border border-[#23355b] text-white text-sm font-medium transition-all shadow-sm justify-center sm:justify-start"
              title={`Send email to ${dev.email}`}
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <Mail className="w-4 h-4 text-slate-300 group-hover:text-amber-400 transition-colors flex-shrink-0" />
              )}
              <span className="truncate">Email</span>
              <Copy className="w-3.5 h-3.5 ml-auto text-slate-400 opacity-60 group-hover:opacity-100 hidden sm:block" />
            </button>

            {/* LinkedIn Button */}
            <button
              onClick={() => handleSocialClick('LinkedIn', dev.links.linkedin)}
              className="group flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#13203c]/90 hover:bg-[#1c2e55] border border-[#23355b] text-white text-sm font-medium transition-all shadow-sm justify-center sm:justify-start"
            >
              <Linkedin className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors flex-shrink-0" />
              <span className="truncate">LinkedIn</span>
              <ExternalLink className="w-3.5 h-3.5 ml-auto text-slate-400 opacity-60 group-hover:opacity-100 hidden sm:block" />
            </button>

            {/* Instagram Button */}
            <button
              onClick={() => handleSocialClick('Instagram', dev.links.instagram)}
              className="group flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#13203c]/90 hover:bg-[#1c2e55] border border-[#23355b] text-white text-sm font-medium transition-all shadow-sm justify-center sm:justify-start"
            >
              <Instagram className="w-4 h-4 text-slate-300 group-hover:text-pink-400 transition-colors flex-shrink-0" />
              <span className="truncate">Instagram</span>
              <ExternalLink className="w-3.5 h-3.5 ml-auto text-slate-400 opacity-60 group-hover:opacity-100 hidden sm:block" />
            </button>

            {/* Facebook Button */}
            <button
              onClick={() => handleSocialClick('Facebook', dev.links.facebook)}
              className="group flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#13203c]/90 hover:bg-[#1c2e55] border border-[#23355b] text-white text-sm font-medium transition-all shadow-sm justify-center sm:justify-start"
            >
              <Facebook className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
              <span className="truncate">Facebook</span>
              <ExternalLink className="w-3.5 h-3.5 ml-auto text-slate-400 opacity-60 group-hover:opacity-100 hidden sm:block" />
            </button>
          </div>
        </div>
      </div>

      {/* Copyright line matching prototype & requested text */}
      <div className="text-center mt-6 text-xs text-slate-400">
        {dev.copyright}
      </div>
    </div>
  );
};
