"use client";

import { useCallback, useRef, useState } from "react";

export type CopilotMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export function useCopilotChat() {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [status, setStatus] = useState<"ready" | "submitted" | "streaming">("ready");
  const [error, setError] = useState<Error | null>(null);
  const abortController = useRef<AbortController | null>(null);

  const stop = useCallback(() => abortController.current?.abort(), []);

  const send = useCallback(async (message: string) => {
    if (abortController.current) return;

    const controller = new AbortController();
    const userMessage: CopilotMessage = { id: crypto.randomUUID(), role: "user", text: message };
    const assistantMessageId = crypto.randomUUID();
    abortController.current = controller;
    setError(null);
    setStatus("submitted");
    setMessages((current) => [...current, userMessage, { id: assistantMessageId, role: "assistant", text: "" }]);

    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "Evee Copilot could not respond.");
      }
      if (!response.body) throw new Error("Evee Copilot returned an empty response.");

      setStatus("streaming");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        if (!text) continue;
        setMessages((current) => current.map((item) => item.id === assistantMessageId ? { ...item, text: item.text + text } : item));
      }
      const trailingText = decoder.decode();
      if (trailingText) {
        setMessages((current) => current.map((item) => item.id === assistantMessageId ? { ...item, text: item.text + trailingText } : item));
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause : new Error("Evee Copilot could not respond."));
      }
    } finally {
      if (abortController.current === controller) abortController.current = null;
      setStatus("ready");
    }
  }, []);

  return { error, messages, send, status, stop };
}
