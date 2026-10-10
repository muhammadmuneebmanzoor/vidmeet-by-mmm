import React, { useState, useRef, useEffect } from 'react';
import { Send, X, MessageSquare } from 'lucide-react';
import { ChatMessage } from '../types';

export interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onClose?: () => void;
  isSending?: boolean;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onSendMessage,
  onClose,
  isSending = false,
}) => {
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    onSendMessage(trimmed);
    setInput('');
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 md:hidden animate-in fade-in duration-200"
      />

      <div className="fixed inset-y-0 right-0 w-full sm:w-96 md:static md:w-84 lg:w-96 rounded-none md:rounded-2xl bg-[#151b30] border-l md:border border-[#252d47] flex flex-col shadow-2xl overflow-hidden h-full z-40 text-left animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-[#252d47] flex items-center justify-between bg-[#111728]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm font-['Bricolage_Grotesque']">
                Meeting Chat
              </h3>
              <p className="text-[10px] text-slate-400">
                {messages.length} {messages.length === 1 ? 'message' : 'messages'}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-[#252d47] transition-colors cursor-pointer"
              title="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-[#1f2847] flex items-center justify-center text-slate-300">
                <MessageSquare className="w-6 h-6 text-[var(--primary)]" />
              </div>
              <p className="font-semibold text-slate-300 text-xs">No messages yet</p>
              <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                Send a message to collaborate with everyone in this meeting in real-time.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isSelf = m.isSelf;
              return (
                <div
                  key={m.id}
                  className={`flex gap-2.5 ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-xs flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: m.avatarColor || '#4f46e5' }}
                  >
                    {m.sender ? m.sender[0].toUpperCase() : 'U'}
                  </div>

                  <div className={`max-w-[78%] ${isSelf ? 'text-right' : 'text-left'}`}>
                    <div className={`flex items-center gap-1.5 mb-1 ${isSelf ? 'justify-end' : 'justify-start'}`}>
                      <span className="font-semibold text-slate-200 text-[11px]">
                        {isSelf ? 'You' : m.sender}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono tabular-nums">
                        {m.timestamp}
                      </span>
                    </div>

                    <p
                      className={`p-2.5 rounded-2xl leading-relaxed break-words text-xs shadow-sm ${
                        isSelf
                          ? 'bg-[var(--primary)] text-white rounded-tr-xs'
                          : 'bg-[#0b1020] text-slate-200 border border-[#252d47] rounded-tl-xs'
                      }`}
                    >
                      {m.text}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-[#252d47] bg-[#111728] space-y-1.5">
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={input}
              maxLength={2000}
              aria-label="Chat message"
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message everyone in meeting…"
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#252d47] bg-[#0b1020] text-white text-xs focus:border-[var(--primary)] focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || isSending}
              aria-label="Send message"
              className="w-10 h-10 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-d)] disabled:opacity-40 text-white flex items-center justify-center flex-shrink-0 transition-all cursor-pointer shadow-md disabled:cursor-not-allowed active:scale-95"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          {input.length > 1500 && (
            <div className="text-[10px] text-right text-slate-400 font-mono tabular-nums">
              {input.length} / 2000
            </div>
          )}
        </form>
      </div>
    </>
  );
};
