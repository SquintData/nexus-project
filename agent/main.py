"""Nexus agent main loop.

Architecture:
  sd.RawInputStream(callback) → audio queue → wake detector / VAD recorder →
  STT (Groq) → LLM tool_calls (OpenAI) → tool execution → 2nd LLM pass → TTS.

Callback-based mic capture: Ctrl+C exits cleanly (no blocking reads).
Run from project root: `python -m agent.main`
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import queue
import sys
import threading
import time
from pathlib import Path

import sounddevice as sd
from rich.console import Console
from rich.logging import RichHandler

from agent.config import has_auth, load
from agent.db.client import NexusDB
from agent.llm.orchestrator import LLMOrchestrator
from agent.pairing import run_pairing_flow
from agent.sphere import configure as configure_sphere, set_sphere
from agent.tools.handlers import ToolHandlers
from agent.voice.recorder import VAD_CHUNK, record_until_silence
from agent.voice.stt import GroqSTT
from agent.voice.tts import OpenAITTS
from agent.voice.vad import SileroVAD
from agent.wake_word import SAMPLE_RATE, WakeWordDetector

LOG_DIR = Path(__file__).resolve().parent / "logs"
LOG_DIR.mkdir(exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    handlers=[
        RichHandler(rich_tracebacks=True, show_path=False, show_time=False, markup=True),
        logging.FileHandler(LOG_DIR / "session.log", encoding="utf-8"),
    ],
)
for noisy in ("httpx", "openai", "urllib3", "torch"):
    logging.getLogger(noisy).setLevel(logging.WARNING)
log = logging.getLogger("nexus")
console = Console()


def _load_config_json() -> dict:
    path = Path(__file__).resolve().parent / "config.json"
    if not path.exists():
        return {"allowed_apps": {}}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


class NexusAgent:
    def __init__(self):
        self.cfg = load()
        local = _load_config_json()
        self.allowed_apps: dict[str, str] = local.get("allowed_apps", {})

        self.db = NexusDB(self.cfg)
        get_token = self.db.get_access_token
        self.stt = GroqSTT(self.cfg.stt_proxy_url, get_token, self.cfg.stt_model)
        self.tts = OpenAITTS(self.cfg.tts_proxy_url, get_token, self.cfg.tts_model, self.cfg.tts_voice)
        self.llm = LLMOrchestrator(self.cfg.llm_proxy_url, get_token, self.cfg.llm_model)
        self.wake = WakeWordDetector(self.cfg.vosk_model_path, self.cfg.wake_word)
        console.print("[dim]Loading Silero VAD ...[/]")
        self.vad = SileroVAD(sample_rate=SAMPLE_RATE)
        self.tools: ToolHandlers | None = None
        self.audio_q: queue.Queue = queue.Queue()
        self._mic_muted = False  # True while TTS is playing → discard mic chunks
        self.chat_llm = LLMOrchestrator(self.cfg.llm_proxy_url, get_token, self.cfg.llm_model)
        self._stop_chat = threading.Event()
        self._chat_msg_queue: queue.Queue = queue.Queue()

    def _mic_callback(self, indata, frames, time_info, status) -> None:
        if status:
            pass  # mic glitches ignored
        if self._mic_muted:
            return  # avoid echo loop: don't capture our own TTS playback
        self.audio_q.put(bytes(indata))

    def _drain_queue(self) -> None:
        while not self.audio_q.empty():
            try:
                self.audio_q.get_nowait()
            except queue.Empty:
                break

    def _speak(self, text: str) -> None:
        """TTS with mic muted + queue drained to break echo feedback."""
        self._mic_muted = True
        try:
            self.tts.speak(text)
        finally:
            self._drain_queue()
            self._mic_muted = False

    def start(self) -> None:
        console.rule("[bold cyan]Nexus Agent[/]")
        log.info("Logging in to Supabase ...")
        uid = self.db.login()
        log.info(f"Logged in as user {uid[:8]}…")
        configure_sphere(
            self.cfg.supabase_url,
            self.cfg.supabase_anon_key,
            self.db.get_access_token,
            uid,
        )
        self.tools = ToolHandlers(self.db, self.allowed_apps)

        console.print(
            f"[bold blue]● Standby.[/] Diga '[cyan]{self.cfg.wake_word}[/]' para acordar "
            f"(Ctrl+C para sair)."
        )
        set_sphere("idle")
        self._start_realtime_worker(uid)
        t = threading.Thread(target=self._chat_loop, daemon=True, name="chat-worker")
        t.start()

        try:
            with sd.RawInputStream(
                samplerate=SAMPLE_RATE,
                channels=1,
                dtype="int16",
                blocksize=VAD_CHUNK,
                callback=self._mic_callback,
            ):
                while True:
                    self._wait_for_wake()
                    self._session()
        except KeyboardInterrupt:
            console.print("\n[dim]Bye.[/]")
            try:
                sd.stop()
            except Exception:
                pass
            raise  # let main() do hard os._exit

    def _wait_for_wake(self) -> None:
        self.wake.reset()
        while True:
            try:
                chunk = self.audio_q.get(timeout=0.5)
            except queue.Empty:
                continue  # check for KeyboardInterrupt
            if self.wake.feed(chunk):
                console.print("[bold green]● Acordado.[/] Falando...")
                set_sphere("listening")
                # Drain residual mic buffer so leftover wake-word audio
                # doesn't contaminate the command capture
                while not self.audio_q.empty():
                    try:
                        self.audio_q.get_nowait()
                    except queue.Empty:
                        break
                return

    def _session(self) -> None:
        while True:
            audio = record_until_silence(
                self.audio_q, self.vad, timeout_seconds=self.cfg.sleep_timeout
            )
            if audio is None:
                console.print("[bold blue]● Standby.[/] Voltando a dormir...")
                set_sphere("idle")
                return
            try:
                text = self.stt.transcribe(audio)
            except Exception as e:
                log.error(f"STT failed: {e}")
                set_sphere("error")
                self._speak("Erro na transcrição.")
                set_sphere("listening")
                continue
            cleaned = "".join(c for c in text if c.isalnum()).strip()
            if not cleaned:
                continue
            log.info(f"[cyan]Você:[/] {text}")
            try:
                set_sphere("processing")
                memory = self.db.list_memory()
                routine_names = self.db.list_routine_names()
                reply, executed = self.llm.process(
                    user_text=text,
                    memory=memory,
                    routines=routine_names,
                    apps=list(self.allowed_apps.keys()),
                    tool_executor=self.tools,  # type: ignore[arg-type]
                )
                for act in executed:
                    log.info(f"[magenta]tool[/] {act['name']}({act['args']}) → {act['result']}")
                log.info(f"[bold green]Nexus:[/] {reply}")
                try:
                    self.db.save_chat_message("user", text, "voice")
                    self.db.save_chat_message("assistant", reply, "voice")
                except Exception:
                    pass
                self._speak(reply)
                set_sphere("listening")
            except Exception as e:
                log.exception("Pipeline error")
                self.llm.reset_session()  # corrupt history → clear before next turn
                set_sphere("error")
                self._speak("Ocorreu um erro interno.")
                set_sphere("listening")


    def _start_realtime_worker(self, uid: str) -> None:
        t = threading.Thread(
            target=self._realtime_thread_fn, args=(uid,), daemon=True, name="realtime-worker"
        )
        t.start()

    def _realtime_thread_fn(self, uid: str) -> None:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(self._realtime_subscribe(uid))
        except Exception:
            log.exception("realtime-worker crashed")
        finally:
            loop.close()

    async def _realtime_subscribe(self, uid: str) -> None:
        from realtime import AsyncRealtimeClient

        # Library appends /websocket?apikey={token} — pass https URL + anon key.
        # User JWT is set via set_auth() so RLS applies on channel join.
        client = AsyncRealtimeClient(
            self.cfg.supabase_url + "/realtime/v1",
            self.cfg.supabase_anon_key,
            auto_reconnect=True,
        )
        await client.connect()
        await client.set_auth(self.db.get_access_token())
        channel = client.channel("chat-messages")
        # Use "*" (all) instead of "INSERT": bypasses a str-vs-int id
        # comparison bug in realtime-py 2.0.6 that silently drops events.
        channel.on_postgres_changes(
            "*",
            self._on_realtime_chat,
            table="chat_messages",
            schema="public",
            filter=f"user_id=eq.{uid}",
        )
        await channel.subscribe()
        log.info("[dim]realtime-worker: subscribed to chat_messages[/]")
        await client.listen()

    def _on_realtime_chat(self, payload: dict) -> None:
        data = payload.get("data", {})
        if data.get("type") != "INSERT":
            return
        # Realtime v2 uses "record"; older protocol used "new"
        record = data.get("record") or data.get("new") or {}
        if record.get("status") == "pending" and record.get("role") == "user":
            log.info("[dim]realtime-worker: enqueuing chat message[/]")
            self._chat_msg_queue.put(record)

    def _chat_loop(self) -> None:
        log.info("[dim]chat-worker thread started[/]")
        last_fallback = time.time()
        while not self._stop_chat.is_set():
            messages: list[dict] = []

            try:
                msg = self._chat_msg_queue.get(timeout=5.0)
                messages.append(msg)
                while True:
                    try:
                        messages.append(self._chat_msg_queue.get_nowait())
                    except queue.Empty:
                        break
            except queue.Empty:
                pass

            # Fallback poll every 60s in case Realtime misses anything
            now = time.time()
            if now - last_fallback >= 60:
                last_fallback = now
                try:
                    messages.extend(self.db.get_pending_chat_messages())
                except Exception:
                    log.exception("chat fallback poll failed")

            seen: set[str] = set()
            for msg in messages:
                msg_id = msg.get("id")
                if not msg_id or msg_id in seen:
                    continue
                seen.add(msg_id)
                self._process_chat_msg(msg)

    def _process_chat_msg(self, msg: dict) -> None:
        msg_id = msg["id"]
        session_id = msg.get("session_id")
        self.db.mark_chat_message_done(msg_id)
        if not session_id:
            log.warning(f"chat msg {msg_id} has no session_id, skipping")
            return
        try:
            memory = self.db.list_memory()
            routine_names = self.db.list_routine_names()
            history = self.db.get_session_history(session_id, exclude_msg_id=msg_id)
            self.chat_llm.reset_session()
            for h in history:
                if h["role"] in ("user", "assistant"):
                    self.chat_llm.session_history.append(
                        {"role": h["role"], "content": h["content"]}
                    )
            reply, _ = self.chat_llm.process(
                user_text=msg["content"],
                memory=memory,
                routines=routine_names,
                apps=list(self.allowed_apps.keys()),
                tool_executor=self.tools,  # type: ignore[arg-type]
            )
            log.info(f"[bold green]Nexus (chat):[/] {reply}")
            self.db.save_chat_message("assistant", reply, "chat", session_id=session_id)
            self.db.touch_chat_session(session_id)
        except Exception:
            log.exception("Chat processing error")
            self.db.save_chat_message(
                "assistant",
                "Erro ao processar mensagem.",
                "chat",
                session_id=session_id,
            )


def _bootstrap_auth_if_needed() -> None:
    """Run interactive pairing if no credentials present in .env."""
    cfg = load()
    if has_auth(cfg):
        return
    run_pairing_flow(cfg.supabase_url, cfg.supabase_anon_key)


def main() -> int:
    try:
        _bootstrap_auth_if_needed()
        NexusAgent().start()
        return 0
    except KeyboardInterrupt:
        # Hard exit: torch/playsound/portaudio teardown is slow + can hang terminal
        os._exit(0)
    except Exception:
        log.exception("Fatal error")
        return 1


if __name__ == "__main__":
    sys.exit(main())
