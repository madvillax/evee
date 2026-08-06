"use client";

import {
  ArrowUp,
  CircleNotch,
  Command,
  Crosshair,
  NewspaperClipping,
  PauseCircle,
  PlayCircle,
  Robot,
  Stop,
} from "@phosphor-icons/react";
import { memo, type KeyboardEvent, type RefObject, useRef, useState } from "react";
import { type CopilotMessage, useCopilotChat } from "./use-copilot-chat";

type CopilotCommand = {
  name: string;
  description: string;
};

const commands: readonly CopilotCommand[] = [
  { name: "/scan", description: "Scan connected sources now" },
  { name: "/digest", description: "Show the latest opportunity digest" },
  { name: "/pause", description: "Pause monitoring alerts" },
  { name: "/resume", description: "Resume monitoring alerts" },
] as const;

const quickActions = [
  { label: "Scan now", command: "/scan", icon: Crosshair },
  { label: "View digest", command: "/digest", icon: NewspaperClipping },
  { label: "Pause alerts", command: "/pause", icon: PauseCircle },
  { label: "Resume alerts", command: "/resume", icon: PlayCircle },
] as const;

type ComposerProps = {
  activeIndex: number;
  busy: boolean;
  draft: string;
  empty: boolean;
  suggestions: readonly CopilotCommand[];
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  onCommand: (command: CopilotCommand) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onShowCommands: () => void;
  onStop: () => void;
};

function ChatComposer({
  activeIndex,
  busy,
  draft,
  empty,
  suggestions,
  textareaRef,
  onChange,
  onCommand,
  onKeyDown,
  onSend,
  onShowCommands,
  onStop,
}: ComposerProps) {
  return (
    <div className="relative w-full">
      {suggestions.length ? (
        <div
          id="copilot-command-menu"
          role="listbox"
          aria-label="Copilot commands"
          className={`absolute z-30 max-h-72 w-full overflow-y-auto rounded-[12px] border bg-[var(--surface)] p-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.24)] ${empty ? "top-[calc(100%+8px)]" : "bottom-[calc(100%+8px)]"}`}
        >
          <div className="flex items-center justify-between px-2.5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-faint)]">Commands</p>
            <p className="text-[9px] text-[var(--text-faint)]">↑↓ select · Enter run · Esc close</p>
          </div>
          {suggestions.map((command, index) => (
            <button
              key={command.name}
              id={`copilot-command-${command.name.slice(1)}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onCommand(command)}
              className={`grid w-full grid-cols-[72px_1fr] items-center gap-2 rounded-[8px] px-2.5 py-2.5 text-left active:scale-[0.99] ${index === activeIndex ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-subtle)]"}`}
            >
              <code className="text-[11px] font-semibold text-[var(--accent)]">{command.name}</code>
              <span className="truncate text-[11px] text-[var(--text-muted)]">{command.description}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="rounded-[14px] border bg-[var(--background)] p-2 shadow-[var(--shadow)] focus-within:border-[var(--accent)]">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          rows={empty ? 3 : 2}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-controls={suggestions.length ? "copilot-command-menu" : undefined}
          aria-activedescendant={suggestions[activeIndex] ? `copilot-command-${suggestions[activeIndex].name.slice(1)}` : undefined}
          aria-expanded={Boolean(suggestions.length)}
          className="max-h-40 min-h-14 w-full resize-none bg-transparent px-2.5 py-2 text-[14px] leading-5 outline-none placeholder:text-[var(--text-faint)]"
          placeholder="Ask Evee anything. Type / for commands."
        />
        <div className="flex items-center gap-2 px-1 pt-1">
          <button
            type="button"
            onClick={onShowCommands}
            className="flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[10px] font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)] active:scale-[0.97]"
          >
            <Command size={13} /><span>Commands</span><kbd className="ml-0.5 font-mono text-[9px] text-[var(--text-faint)]">/</kbd>
          </button>
          <span className="hidden text-[9px] text-[var(--text-faint)] sm:inline">Replies stay human-reviewed</span>
          {busy ? (
            <button type="button" onClick={onStop} aria-label="Stop streaming" className="ml-auto grid size-8 place-items-center rounded-[8px] bg-[var(--surface-strong)] active:scale-[0.97]"><Stop size={13} weight="fill" /></button>
          ) : (
            <button type="button" onClick={onSend} disabled={!draft.trim()} aria-label="Send message" className="ml-auto grid size-8 place-items-center rounded-[8px] bg-[var(--accent)] text-[var(--accent-foreground)] disabled:opacity-35 active:scale-[0.96]"><ArrowUp size={14} weight="bold" /></button>
          )}
        </div>
      </div>
    </div>
  );
}

const ChatMessages = memo(function ChatMessages({ messages }: { messages: readonly CopilotMessage[] }) {
  return (
    <div className="mx-auto grid max-w-2xl gap-5">
      {messages.map((message) => (
        <div key={message.id} className={message.role === "user" ? "ml-auto max-w-[82%] rounded-[12px] bg-[var(--accent)] px-3.5 py-2.5 text-xs leading-5 text-[var(--accent-foreground)]" : "max-w-[92%] text-xs leading-6 text-[var(--text)]"}>
          <p className="whitespace-pre-wrap">{message.text}</p>
        </div>
      ))}
    </div>
  );
});

export function AgentChat() {
  const [draft, setDraft] = useState("");
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const agent = useCopilotChat();
  const busy = agent.status === "submitted" || agent.status === "streaming";
  const commandQuery = draft.startsWith("/") && !draft.includes(" ") ? draft.toLowerCase() : "";
  const suggestions = commandQuery ? commands.filter((command) => command.name.startsWith(commandQuery)) : [];
  const empty = agent.messages.length === 0;

  function executeCommand(command: CopilotCommand, argumentsText = "") {
    if (busy) return;
    setDraft("");
    setActiveCommandIndex(0);
    void agent.send(`${command.name}${argumentsText ? ` ${argumentsText}` : ""}`);
  }

  function send(message = draft) {
    const text = message.trim();
    if (!text || busy) return;
    if (text.startsWith("/")) {
      const [name = "", ...argumentParts] = text.split(/\s+/);
      const command = commands.find((item) => item.name === name.toLowerCase());
      if (command) {
        executeCommand(command, argumentParts.join(" "));
        return;
      }
    }
    setDraft("");
    setActiveCommandIndex(0);
    void agent.send(text);
  }

  function showCommands() {
    setDraft("/");
    setActiveCommandIndex(0);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveCommandIndex((current) => (current + 1) % suggestions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveCommandIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setDraft("");
        setActiveCommandIndex(0);
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        executeCommand(suggestions[activeCommandIndex] ?? suggestions[0]!);
        return;
      }
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  const composer = (
    <ChatComposer
      activeIndex={activeCommandIndex}
      busy={busy}
      draft={draft}
      empty={empty}
      suggestions={suggestions}
      textareaRef={textareaRef}
      onChange={(value) => {
        setDraft(value);
        setActiveCommandIndex(0);
      }}
      onCommand={executeCommand}
      onKeyDown={handleKeyDown}
      onSend={() => send()}
      onShowCommands={showCommands}
      onStop={agent.stop}
    />
  );

  return (
    <section className="flex min-h-[calc(100dvh-104px)] flex-col">
      {empty ? (
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-0 pb-16 pt-8">
          <div className="mb-7 text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-[13px] bg-[var(--accent-soft)] text-[var(--accent)]"><Robot size={22} weight="fill" /></span>
            <h1 className="mt-4 text-2xl font-semibold tracking-[-0.045em]">Ask Evee</h1>
            <p className="mx-auto mt-2 max-w-md text-[12px] leading-5 text-[var(--text-muted)]">Research demand, manage monitors, review opportunities, and control alerts from one conversation.</p>
          </div>
          {composer}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {quickActions.map((action) => (
              <button key={action.command} type="button" onClick={() => send(action.command)} className="flex h-8 items-center gap-1.5 rounded-[8px] border bg-[var(--surface)] px-2.5 text-[10px] font-medium text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)] active:scale-[0.97]">
                <action.icon size={12} />{action.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b pb-3">
            <span className="grid size-7 place-items-center rounded-[8px] bg-[var(--accent-soft)] text-[var(--accent)]"><Robot size={14} weight="fill" /></span>
            <div><h1 className="text-xs font-semibold">Evee Copilot</h1><p className="text-[9px] text-[var(--text-faint)]">Connected to your workspace</p></div>
          </div>
          <div className="flex-1 overflow-y-auto py-6">
            <ChatMessages messages={agent.messages} />
            {busy ? <div className="mx-auto mt-5 flex max-w-2xl items-center gap-2 text-xs text-[var(--text-faint)]"><CircleNotch className="animate-spin" size={14} />Working across your workspace...</div> : null}
          </div>
          {agent.error ? <p className="mx-auto mb-2 w-full max-w-2xl rounded-[9px] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] px-3 py-2 text-xs text-[var(--danger)]">{agent.error.message}</p> : null}
          <div className="mx-auto w-full max-w-2xl pb-1">{composer}</div>
        </>
      )}
    </section>
  );
}
