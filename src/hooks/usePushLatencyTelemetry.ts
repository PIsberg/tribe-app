import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const SAMPLE_RATE = 0.2; // sample ~20% of own sends
const MAX_TRACKED_INFLIGHT = 50; // bound the in-memory map

/**
 * Measures push-latency for this client's own sends: time from when the
 * `send` mutation resolved (server committed the message) to when that
 * message first appears in our reactive `messages.list` snapshot.
 *
 * Sampled per-send to avoid mutation-storm overhead. Backgrounded reports
 * are fire-and-forget — failures are silent.
 *
 * Returns a `recordSend(messageId)` callback the caller invokes right after
 * a send resolves with its returned messageId. The hook watches `messages`
 * for that ID and reports the delta to convex.
 */
export function usePushLatencyTelemetry(
  tribeId: Id<"tribes">,
  messages: ReadonlyArray<{ _id: string }> | undefined
): (messageId: string) => void {
  const recordMutation = useMutation(api.metrics.recordPushLatency);
  // messageId → sendResolvedAt
  const pendingRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!messages || pendingRef.current.size === 0) return;
    const now = Date.now();
    for (const m of messages) {
      const sentAt = pendingRef.current.get(m._id);
      if (sentAt === undefined) continue;
      pendingRef.current.delete(m._id);
      const latency = now - sentAt;
      // Drop pathological values — clock skew, suspended tabs.
      if (latency < 0 || latency > 30_000) continue;
      recordMutation({ tribeId, latencyMs: latency }).catch(() => {});
    }
  }, [messages, tribeId, recordMutation]);

  return (messageId: string) => {
    if (Math.random() > SAMPLE_RATE) return;
    // Cap the in-flight map; drop oldest entries if we somehow miss too many.
    if (pendingRef.current.size >= MAX_TRACKED_INFLIGHT) {
      const firstKey = pendingRef.current.keys().next().value;
      if (firstKey) pendingRef.current.delete(firstKey);
    }
    pendingRef.current.set(messageId, Date.now());
  };
}
