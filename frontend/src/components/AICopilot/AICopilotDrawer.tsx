'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  CheckCircle2,
  Calendar,
  Fuel,
  CloudSun,
  ListTodo,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import { showToast } from '@/utils/sweetalert';
import { readCached, writeCached } from '@/lib/offline/localStore';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  action?: {
    type: string;
    data: Record<string, unknown>;
  };
  timestamp: string;
}

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}`;
}

function getFormattedTime(): string {
  return new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome',
    sender: 'assistant',
    text: 'สวัสดีครับ! ผมคือ AI Copilot ประจำ ART Workspace สามารถถามข้อมูลสรุปวันนี้, จดโน้ตด่วน หรือตั้งเตือนความจำได้ทันทีครับ ✨',
    timestamp: '08:00',
  },
];

const SUGGESTIONS = [
  { label: 'สรุปภาพรวมวันนี้', icon: ListTodo, prompt: 'สรุปภาพรวมวันนี้' },
  { label: 'เช็คราคาน้ำมัน', icon: Fuel, prompt: 'ราคาน้ำมันวันนี้' },
  { label: 'สภาพอากาศ', icon: CloudSun, prompt: 'รายงานสภาพอากาศวันนี้' },
  { label: 'จดโน้ตด่วน', icon: Sparkles, prompt: 'จดโน้ตว่า ตรวจสอบงานประจำสัปดาห์' },
];

export default function AICopilotDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  const executeAction = async (action: { type: string; data: Record<string, unknown> }) => {
    try {
      if (action.type === 'add_note') {
        const text = String(action.data?.text || action.data?.title || 'โน้ตใหม่');
        const newNote = {
          id: generateId('note'),
          text,
          done: false,
        };

        // 1. Sync with profile/quick-notes API
        try {
          const res = await fetchWithAuth('/api/v1/profile/quick-notes');
          let currentNotes = [];
          if (res.ok) {
            const body = await res.json();
            currentNotes = Array.isArray(body.notes) ? body.notes : [];
          }
          const updated = [...currentNotes, newNote];
          await fetchWithAuth('/api/v1/profile/quick-notes', {
            method: 'PUT',
            body: JSON.stringify({ notes: updated }),
          });
          writeCached('profile/quick-notes', { notes: updated });
        } catch {
          // Offline fallback
        }

        // 2. Also save to localStorage for widget compatibility
        try {
          const raw = localStorage.getItem('quick_notes_tasks');
          const currentLocal = raw ? JSON.parse(raw) : [];
          const updatedLocal = [...currentLocal, newNote];
          localStorage.setItem('quick_notes_tasks', JSON.stringify(updatedLocal));
        } catch {
          // Ignore storage errors
        }

        window.dispatchEvent(new CustomEvent('art-quick-notes-updated'));
        showToast(`บันทึกโน้ตสำเร็จ: "${text}"`, 'success');
      } else if (action.type === 'add_reminder') {
        const title = String(action.data?.title || 'รายการเตือนใหม่');
        const todayStr = new Date().toISOString().split('T')[0];
        const newReminder = {
          id: generateId('rem'),
          title,
          date: todayStr,
          kind: action.data?.kind || 'errand',
          done: false,
        };

        try {
          const res = await fetchWithAuth('/api/v1/planner/reminders');
          let currentReminders = [];
          if (res.ok) {
            const body = await res.json();
            currentReminders = Array.isArray(body.reminders) ? body.reminders : [];
          }
          const updated = [...currentReminders, newReminder];
          await fetchWithAuth('/api/v1/planner/reminders', {
            method: 'POST',
            body: JSON.stringify({ reminders: updated }),
          });
          writeCached('profile/reminders', { reminders: updated });
        } catch {
          // Offline fallback
        }

        window.dispatchEvent(new CustomEvent('art-reminders-updated'));
        showToast(`สร้างรายการเตือน: "${title}" สำเร็จ`, 'success');
      }
    } catch {
      showToast('ไม่สามารถประมวลผลคำสั่งอัตโนมัติได้', 'error');
    }
  };

  const sendMessage = async (messageText: string) => {
    const text = messageText.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: generateId('u'),
      sender: 'user',
      text,
      timestamp: getFormattedTime(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Gather context
      let pendingTasks = 0;
      let taskList: string[] = [];
      try {
        const raw = localStorage.getItem('quick_notes_tasks');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const pending = parsed.filter((t: { done?: boolean }) => !t.done);
            pendingTasks = pending.length;
            taskList = pending.map((t: { text?: string }) => t.text || '').filter(Boolean);
          }
        }
      } catch {
        // Ignore storage error
      }

      const res = await fetchWithAuth('/api/v1/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: text,
          context: {
            pendingTasks,
            tasks: taskList.slice(0, 5),
            page: window.location.pathname,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: generateId('a'),
        sender: 'assistant',
        text: data.reply || 'ขออภัยครับ ไม่สามารถประมวลผลคำตอบได้ในขณะนี้',
        action: data.action || undefined,
        timestamp: getFormattedTime(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (data.action) {
        await executeAction(data.action);
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: generateId('err'),
        sender: 'assistant',
        text: 'ขออภัยครับ ไม่สามารถเชื่อมต่อกับ AI Assistant ได้ในขณะนี้ โปรดลองใหม่อีกครั้ง',
        timestamp: getFormattedTime(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      {/* ── Floating Action Trigger Button ────────────────────────────── */}
      <div className="fixed bottom-5 right-5 z-40">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`group relative flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
            isOpen ? 'rotate-90' : ''
          }`}
          aria-label={isOpen ? 'ปิด AI Copilot' : 'เปิด AI Copilot'}
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <X size={22} aria-hidden="true" />
          ) : (
            <>
              <Sparkles size={22} aria-hidden="true" className="transition-transform group-hover:rotate-12" />
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white" />
              </span>
            </>
          )}
        </button>
      </div>

      {/* ── AI Assistant Drawer ───────────────────────────────────────── */}
      {isOpen && (
        <section
          aria-label="หน้าต่างสนทนา AI Copilot"
          className="fixed bottom-20 right-4 sm:right-6 z-50 flex h-[530px] max-h-[calc(100dvh-6.5rem)] w-[min(calc(100vw-2rem),380px)] flex-col rounded-[20px] border border-[var(--hairline)] bg-[var(--surface)] text-[var(--ink)] shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-2xl transition-all animate-in fade-in zoom-in-95"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--hairline)] px-4 py-3 bg-[var(--glass-40)]">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--accent-soft)] text-[var(--accent-text)]">
                <Bot size={18} aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-[14px] font-bold tracking-tight text-[var(--ink)]">
                    AI Copilot
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    ออนไลน์
                  </span>
                </div>
                <p className="text-[11px] text-[var(--ink-tertiary)]">ผู้ช่วยอัจฉริยะประจำ Workspace</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--surface-chip)] hover:text-[var(--ink)] active:scale-95 transition-colors"
              aria-label="ปิดหน้าต่าง AI Copilot"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          {/* Quick Prompt Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto p-2 border-b border-[var(--hairline)] bg-[var(--surface-subtle)] scrollbar-none text-[11px]">
            {SUGGESTIONS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => sendMessage(item.prompt)}
                  disabled={isLoading}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-secondary)] border border-[var(--hairline)] hover:bg-[var(--surface-chip)] hover:text-[var(--accent)] active:scale-95 transition-all disabled:opacity-50"
                >
                  <Icon size={12} className="text-[var(--accent)]" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
            {messages.map((msg) => {
              const isAssistant = msg.sender === 'assistant';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${isAssistant ? 'items-start' : 'items-end justify-end'}`}
                >
                  {isAssistant && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] mt-0.5">
                      <Sparkles size={14} aria-hidden="true" />
                    </div>
                  )}

                  <div
                    className={`max-w-[82%] rounded-[16px] px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      isAssistant
                        ? 'rounded-tl-xs bg-[var(--surface-grouped)] text-[var(--ink)] border border-[var(--hairline)] shadow-2xs'
                        : 'rounded-br-xs bg-[var(--accent)] text-white shadow-xs'
                    }`}
                  >
                    <p className="whitespace-pre-line">{msg.text}</p>

                    {/* Action Confirmation Badge */}
                    {msg.action && (
                      <div className="mt-2 flex items-center gap-2 rounded-[11px] bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                        <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                        <span className="truncate">
                          {msg.action.type === 'add_note' ? 'เพิ่มลงใน Quick Notes แล้ว' : 'ตั้งเตือนในระบบแล้ว'}
                        </span>
                      </div>
                    )}

                    <span
                      className={`block mt-1 text-[10px] ${
                        isAssistant ? 'text-[var(--ink-tertiary)]' : 'text-white/70'
                      }`}
                    >
                      {msg.timestamp}
                    </span>
                  </div>

                  {!isAssistant && (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-chip)] text-[var(--ink-secondary)] mb-0.5">
                      <User size={14} aria-hidden="true" />
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-start gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] mt-0.5">
                  <Sparkles size={14} aria-hidden="true" />
                </div>
                <div className="rounded-[16px] rounded-tl-xs bg-[var(--surface-grouped)] border border-[var(--hairline)] px-3.5 py-2.5 shadow-2xs">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-bounce" />
                    <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:0.2s]" />
                    <span className="h-2 w-2 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-[var(--hairline)] bg-[var(--surface-subtle)] p-2.5"
          >
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="สั่งงาน เช่น 'จดโน้ตว่า...', 'สรุปภาพรวม'…"
                disabled={isLoading}
                className="w-full rounded-full border border-[var(--hairline)] bg-[var(--surface)] py-2 pl-3.5 pr-10 text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:outline-hidden focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                aria-label="ส่งข้อความ"
                className="absolute right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
              >
                <Send size={13} aria-hidden="true" />
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
