import React, { useState } from 'react';
import { Video, Download, Share2, Play, X } from 'lucide-react';
import { Recording } from '../../types';

interface RecordingsTabProps {
  recordings: Recording[];
  onShowToast: (msg: string) => void;
}

export const RecordingsTab: React.FC<RecordingsTabProps> = ({
  recordings,
  onShowToast,
}) => {
  const [playingRecording, setPlayingRecording] = useState<Recording | null>(null);

  const handleDownload = (rec: Recording) => {
    onShowToast(`Downloading "${rec.title}" (${rec.fileSize})...`);
    // Simulated instant trigger
  };

  const handleShare = (rec: Recording) => {
    navigator.clipboard.writeText(`https://vidmeet.app/rec/${rec.id}`);
    onShowToast(`Recording link copied to clipboard`);
  };

  return (
    <div className="space-y-6 text-left">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-[var(--text)] tracking-tight font-['Bricolage_Grotesque']">
          Recordings
        </h2>
        <span className="text-xs text-[var(--muted)] font-medium">
          {recordings.length} Saved sessions
        </span>
      </div>

      {recordings.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {recordings.map((rec) => (
            <div
              key={rec.id}
              className="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm space-y-4 hover:shadow-md transition-shadow"
            >
              {/* Visual Thumbnail */}
              <div
                onClick={() => setPlayingRecording(rec)}
                className={`h-32 rounded-xl bg-gradient-to-br ${rec.thumbnailGradient} flex items-center justify-center text-white cursor-pointer relative group overflow-hidden shadow-inner`}
              >
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </div>
                <span className="absolute bottom-2 right-2 bg-black/60 px-2 py-0.5 rounded text-[10px] font-mono font-medium">
                  {rec.duration}
                </span>
              </div>

              {/* Info */}
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-[var(--text)] font-['Bricolage_Grotesque'] truncate">
                  {rec.title}
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  {rec.date} · {rec.participantsCount} participants · {rec.fileSize}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1 border-t border-[var(--border)]">
                <button
                  onClick={() => setPlayingRecording(rec)}
                  className="flex-1 py-1.5 rounded-xl text-xs font-semibold text-[var(--text)] bg-[var(--bg)] hover:bg-[var(--border)] border border-[var(--border)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Play</span>
                </button>

                <button
                  onClick={() => handleDownload(rec)}
                  className="p-1.5 rounded-xl text-[var(--muted)] hover:text-[var(--text)] bg-[var(--bg)] hover:bg-[var(--border)] border border-[var(--border)] transition-colors cursor-pointer"
                  title="Download MP4"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleShare(rec)}
                  className="p-1.5 rounded-xl text-[var(--muted)] hover:text-[var(--text)] bg-[var(--bg)] hover:bg-[var(--border)] border border-[var(--border)] transition-colors cursor-pointer"
                  title="Share link"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-center max-w-lg mx-auto space-y-3">
          <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-[var(--primary)] flex items-center justify-center mx-auto">
            <Video className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[var(--text)] font-['Bricolage_Grotesque']">
            No recordings yet
          </h3>
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            Recordings made during your hosted meetings will automatically appear here with cloud storage and instant MP4 playback.
          </p>
        </div>
      )}

      {/* Video Playback Modal */}
      {playingRecording && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-[#0b1020] border border-[#252d47] rounded-2xl overflow-hidden shadow-2xl text-white">
            <div className="flex items-center justify-between p-4 border-b border-[#252d47]">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-[var(--primary)]" />
                <h3 className="font-bold text-sm font-['Bricolage_Grotesque']">
                  {playingRecording.title}
                </h3>
              </div>
              <button
                onClick={() => setPlayingRecording(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Simulated interactive video player canvas */}
            <div className="aspect-video bg-black flex flex-col items-center justify-center p-6 relative group">
              <div className="w-16 h-16 rounded-full bg-[var(--primary)] flex items-center justify-center text-white shadow-xl animate-pulse">
                <Play className="w-7 h-7 fill-current ml-1" />
              </div>
              <p className="text-xs text-slate-400 mt-4">
                Playing back recorded meeting stream · HD 1080p
              </p>
              
              {/* Timeline bar */}
              <div className="absolute bottom-4 left-6 right-6 flex items-center gap-3">
                <span className="text-[10px] font-mono text-slate-400">04:15</span>
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--primary)] w-1/3 rounded-full" />
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {playingRecording.duration}
                </span>
              </div>
            </div>

            <div className="p-4 flex items-center justify-between text-xs text-slate-400 bg-[#151b30]">
              <span>Recorded on {playingRecording.date}</span>
              <button
                onClick={() => handleDownload(playingRecording)}
                className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white font-semibold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download MP4</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
