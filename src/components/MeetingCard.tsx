import React from 'react';
import { Video, Clock, Users, ArrowRight, Share2, MoreVertical } from 'lucide-react';
import { Meeting } from '../types';
import { Button } from './ui/Button';

export interface MeetingCardProps {
  meeting: Meeting;
  onJoin: (code: string) => void;
  onViewDetails?: (meeting: Meeting) => void;
  onShare?: (meeting: Meeting) => void;
}

export const MeetingCard: React.FC<MeetingCardProps> = ({
  meeting,
  onJoin,
  onViewDetails,
  onShare,
}) => {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm hover:border-[var(--primary)]/40 transition-all text-left">
      {/* Date Box */}
      <div className="w-14 text-center bg-[var(--bg)] border border-[var(--border)] rounded-xl py-2 flex-shrink-0">
        <span className="text-base font-extrabold text-[var(--text)] block leading-none font-['Bricolage_Grotesque']">
          {meeting.date.length >= 6 ? meeting.date.slice(4) : meeting.date}
        </span>
        <small className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block mt-0.5">
          {meeting.date.slice(0, 3)}
        </small>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <b className="text-sm font-bold text-[var(--text)] truncate font-['Bricolage_Grotesque']">
            {meeting.title}
          </b>
          {meeting.isRecorded && (
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              · Recorded
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-[var(--muted)] flex-wrap">
          <span>{meeting.time}</span>
          <span>·</span>
          <span>{meeting.duration}</span>
          <span>·</span>
          <span className="truncate">{meeting.host}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {onShare && (
          <button
            onClick={() => onShare(meeting)}
            className="p-2 rounded-xl text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--bg)] transition-colors hidden sm:block"
            title="Share meeting link"
          >
            <Share2 className="w-4 h-4" />
          </button>
        )}

        <Button
          size="sm"
          variant="primary"
          onClick={() => onJoin(meeting.code)}
          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
        >
          Join
        </Button>
      </div>
    </div>
  );
};
