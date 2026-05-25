import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Mic, MessageCircle, Pencil, Send, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import type { ChatMessage, ChatSession } from "@/types";

type Tab = "new" | "history" | "voice";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

function formatRelative(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return formatTime(iso);
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `${diffDays} dias atrás`;
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

function deriveTitle(text: string): string {
  return text.trim().slice(0, 40) || "Nova conversa";
}

export default function Chat() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("new");

  // Novo chat
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([]);

  // Histórico
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [openedSession, setOpenedSession] = useState<ChatSession | null>(null);
  const [openedMessages, setOpenedMessages] = useState<ChatMessage[]>([]);

  // Voz
  const [voiceMessages, setVoiceMessages] = useState<ChatMessage[]>([]);

  // Input
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Refs mirror state so realtime callback always reads fresh values
  // (without re-subscribing on every state change → no missed events).
  const tabRef = useRef<Tab>(tab);
  const currentSessionIdRef = useRef<string | null>(null);
  const openedSessionIdRef = useRef<string | null>(null);
  useEffect(() => { tabRef.current = tab; }, [tab]);
  useEffect(() => { currentSessionIdRef.current = currentSession?.id ?? null; }, [currentSession]);
  useEffect(() => { openedSessionIdRef.current = openedSession?.id ?? null; }, [openedSession]);

  // ---- Loaders ----
  const loadSessions = useCallback(async () => {
    const { data } = await supabase
      .from("chat_sessions")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(100);
    setSessions((data ?? []) as ChatSession[]);
  }, []);

  const loadSessionMessages = useCallback(async (sessionId: string): Promise<ChatMessage[]> => {
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    return (data ?? []) as ChatMessage[];
  }, []);

  const loadVoice = useCallback(async () => {
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("source", "voice")
      .order("created_at", { ascending: true })
      .limit(500);
    setVoiceMessages((data ?? []) as ChatMessage[]);
  }, []);

  // Initial + tab-change loads
  useEffect(() => {
    if (tab === "history") loadSessions();
    if (tab === "voice") loadVoice();
  }, [tab, loadSessions, loadVoice]);

  // Realtime: one stable subscription for the component's lifetime. Reads
  // current ids/tab via refs so we never miss an event due to re-subscribing.
  useEffect(() => {
    const ch = supabase
      .channel("rt-chat-sessions")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, async () => {
        const csId = currentSessionIdRef.current;
        const osId = openedSessionIdRef.current;
        const t = tabRef.current;
        if (csId) setCurrentMessages(await loadSessionMessages(csId));
        if (osId) setOpenedMessages(await loadSessionMessages(osId));
        if (t === "voice") loadVoice();
        if (t === "history") loadSessions();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_sessions" }, () => {
        if (tabRef.current === "history") loadSessions();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadSessions, loadSessionMessages, loadVoice]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages, openedMessages, voiceMessages]);

  // ---- Tab switching ----
  function switchTab(next: Tab) {
    if (next === "new") {
      setCurrentSession(null);
      setCurrentMessages([]);
    }
    if (next === "history") {
      setOpenedSession(null);
      setOpenedMessages([]);
    }
    setText("");
    setTab(next);
  }

  // ---- Send ----
  async function send(e: FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setSending(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;

      let sessionId: string;
      if (tab === "new") {
        if (!currentSession) {
          const { data: newSession, error: sErr } = await supabase
            .from("chat_sessions")
            .insert({ user_id: u.user.id, title: deriveTitle(content) })
            .select()
            .single();
          if (sErr || !newSession) throw sErr ?? new Error("session insert failed");
          setCurrentSession(newSession as ChatSession);
          sessionId = newSession.id;
        } else {
          sessionId = currentSession.id;
        }
      } else if (tab === "history" && openedSession) {
        sessionId = openedSession.id;
      } else {
        return;
      }

      const { error } = await supabase.from("chat_messages").insert({
        user_id: u.user.id,
        role: "user",
        content,
        source: "chat",
        status: "pending",
        session_id: sessionId,
      });
      if (error) throw error;
      setText("");

      // Force reload so the new msg appears immediately, without relying on
      // realtime closure (state may not have caught up on first send).
      const fresh = await loadSessionMessages(sessionId);
      if (tab === "new") setCurrentMessages(fresh);
      else if (tab === "history") setOpenedMessages(fresh);
    } catch {
      toast("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  }

  // ---- Session actions ----
  async function openSession(s: ChatSession) {
    setOpenedSession(s);
    setOpenedMessages(await loadSessionMessages(s.id));
  }

  async function renameSession(s: ChatSession) {
    const newTitle = window.prompt("Novo título:", s.title);
    if (!newTitle || newTitle.trim() === s.title) return;
    const { error } = await supabase
      .from("chat_sessions")
      .update({ title: newTitle.trim() })
      .eq("id", s.id);
    if (error) toast("Erro ao renomear");
    else {
      if (openedSession?.id === s.id) setOpenedSession({ ...s, title: newTitle.trim() });
      loadSessions();
    }
  }

  async function deleteSession(s: ChatSession) {
    if (!window.confirm(`Excluir conversa "${s.title}"? Todas as mensagens serão perdidas.`)) return;
    const { error } = await supabase.from("chat_sessions").delete().eq("id", s.id);
    if (error) toast("Erro ao excluir");
    else {
      if (openedSession?.id === s.id) {
        setOpenedSession(null);
        setOpenedMessages([]);
      }
      loadSessions();
    }
  }

  // ---- Renderers ----
  const renderMessages = (msgs: ChatMessage[], emptyText: string) => {
    if (msgs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-white/30">
          <MessageCircle size={40} className="mb-2 opacity-40" />
          <p className="text-sm">{emptyText}</p>
        </div>
      );
    }
    const groups: { day: string; msgs: ChatMessage[] }[] = [];
    for (const msg of msgs) {
      const day = msg.created_at.slice(0, 10);
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.msgs.push(msg);
      else groups.push({ day, msgs: [msg] });
    }
    return groups.map(({ day, msgs }) => (
      <div key={day}>
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-white/30 capitalize">{formatDay(day + "T12:00:00")}</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>
        {msgs.map((msg) => (
          <div key={msg.id} className={`flex mb-1 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${
                msg.role === "user"
                  ? "bg-nexus-accent/20 border border-nexus-accent/30 text-white rounded-br-sm"
                  : "glass text-white/90 rounded-bl-sm"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] text-white/30">{formatTime(msg.created_at)}</span>
                {msg.source === "voice" && <Mic size={8} className="text-white/30" />}
              </div>
            </div>
          </div>
        ))}
      </div>
    ));
  };

  const renderTypingDots = () => (
    <div className="flex justify-start mb-1">
      <div className="glass px-4 py-2 rounded-2xl rounded-bl-sm">
        <div className="flex gap-1 items-center h-4">
          <span className="w-1.5 h-1.5 rounded-full bg-nexus-accent/60 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-nexus-accent/60 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-nexus-accent/60 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );

  const showInput = tab === "new" || (tab === "history" && openedSession !== null);
  const activeMessages =
    tab === "new" ? currentMessages : tab === "history" && openedSession ? openedMessages : [];
  const hasPending = activeMessages.some((m) => m.status === "pending");

  // ---- Render ----
  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          {tab === "history" && openedSession && (
            <button
              onClick={() => { setOpenedSession(null); setOpenedMessages([]); }}
              className="p-1 rounded hover:bg-white/10 text-white/70"
              title="Voltar"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-bold">
              {tab === "history" && openedSession ? openedSession.title : "Chat"}
            </h1>
            <p className="text-white/60 text-sm">
              {tab === "new" && (currentSession ? `${currentMessages.length} mensagem(s)` : "Nova conversa")}
              {tab === "history" && !openedSession && `${sessions.length} conversa(s)`}
              {tab === "history" && openedSession && `${openedMessages.length} mensagem(s)`}
              {tab === "voice" && `${voiceMessages.length} mensagem(s) de voz`}
            </p>
          </div>
        </div>
        {/* Tab chips */}
        <div className="flex gap-2">
          {(["new", "history", "voice"] as const).map((f) => (
            <button
              key={f}
              onClick={() => switchTab(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                tab === f
                  ? "bg-nexus-accent/20 border-nexus-accent/50 text-nexus-accent"
                  : "bg-white/5 border-white/10 text-white/50 hover:text-white"
              }`}
            >
              {f === "new" ? "Novo chat" : f === "history" ? "Histórico" : (
                <span className="flex items-center gap-1"><Mic size={10} />Voz</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-1">
        {/* HISTORY LIST */}
        {tab === "history" && !openedSession && (
          sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/30">
              <MessageCircle size={40} className="mb-2 opacity-40" />
              <p className="text-sm">Nenhuma conversa ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="glass p-3 flex items-center justify-between hover:bg-white/10 cursor-pointer rounded-lg group"
                  onClick={() => openSession(s)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{s.title}</div>
                    <div className="text-xs text-white/40">{formatRelative(s.last_message_at)}</div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); renameSession(s); }}
                      className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white"
                      title="Renomear"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession(s); }}
                      className="p-1.5 rounded hover:bg-red-500/20 text-white/60 hover:text-red-400"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* MESSAGE VIEW (new chat or opened session) */}
        {tab === "new" && renderMessages(currentMessages, "Comece uma nova conversa")}
        {tab === "history" && openedSession && renderMessages(openedMessages, "Sem mensagens nesta conversa")}
        {tab === "voice" && renderMessages(voiceMessages, "Nenhuma interação por voz ainda")}

        {hasPending && renderTypingDots()}
        <div ref={bottomRef} />
      </div>

      {/* Input (only on new chat and opened history session) */}
      {showInput && (
        <form onSubmit={send} className="flex gap-2 mt-3 shrink-0">
          <input
            type="text"
            className="input flex-1"
            placeholder="Mensagem para o Nexus..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={sending}
          />
          <button
            type="submit"
            className="btn btn-primary px-4"
            disabled={sending || !text.trim()}
          >
            <Send size={16} />
          </button>
        </form>
      )}
    </div>
  );
}
