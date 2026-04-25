import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useLingui } from "@lingui/react/macro";
import {
  useQuery,
  getBeat,
  getBeatSourceDomains,
  getIssuesForBeat,
  getIssueSessionStatus,
  getAgentEvents,
  submitClarification,
  triggerOnDemandRun,
  pauseBeat,
  resumeBeat,
  deleteBeat,
} from "wasp/client/operations";

export type TranscriptEvent = {
  id: string;
  type: string;
  payload: string;
  occurredAt: Date | string;
};

// Statuses that warrant polling the transcript panel.
export const STREAMABLE_STATUSES = new Set<string>([
  "DRAFT",
  "DESIGNING",
  "AWAITING_CLARIFICATION",
  "SCOUTING",
]);

export function parseEventPayload(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export interface ClarificationSummary {
  questions: string[];
  reasoning: string;
  sessionId: string;
}

export function extractLatestClarification(
  events: TranscriptEvent[] | undefined | null,
): ClarificationSummary | null {
  if (!events) return null;
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type !== "designer.needs_clarification") continue;
    const p = parseEventPayload(e.payload);
    return {
      questions: Array.isArray(p.questions) ? (p.questions as string[]) : [],
      reasoning: String(p.reasoning ?? ""),
      sessionId: String(p.sessionId ?? ""),
    };
  }
  return null;
}

export function useBeatActions(beatId: string | undefined) {
  const navigate = useNavigate();
  const { t } = useLingui();

  const {
    data: beat,
    isLoading: beatLoading,
    error: beatError,
    refetch: refetchBeat,
  } = useQuery(getBeat, { beatId: beatId! }, { enabled: !!beatId });

  const { data: issues, refetch: refetchIssues } = useQuery(
    getIssuesForBeat,
    { beatId: beatId! },
    { enabled: !!beatId },
  );

  const { data: sourceDomains, refetch: refetchSourceDomains } = useQuery(
    getBeatSourceDomains,
    { beatId: beatId! },
    { enabled: !!beatId },
  );

  const { data: sessionStatus, refetch: refetchSessionStatus } = useQuery(
    getIssueSessionStatus,
    { beatId: beatId! },
    { enabled: !!beatId },
  );

  const beatStatus = beat?.status ?? "";
  const isStreamable = STREAMABLE_STATUSES.has(beatStatus);
  const isGenerating = sessionStatus?.state === "running";
  const shouldPoll = isStreamable || isGenerating;

  const sessionLinkId =
    sessionStatus?.state === "running" || sessionStatus?.state === "done"
      ? sessionStatus.sessionId
      : null;

  const {
    data: agentEvents,
    error: agentEventsError,
    refetch: refetchEvents,
  } = useQuery(
    getAgentEvents,
    { beatId: beatId!, limit: 200 },
    {
      enabled: !!beatId,
      refetchInterval: shouldPoll ? 1500 : false,
    },
  );

  const events = (agentEvents as TranscriptEvent[] | undefined) ?? undefined;

  // Event pulses also drive beat/issue/session refetches so status
  // transitions surface in the same cadence.
  useEffect(() => {
    if (!shouldPoll) return;
    refetchBeat();
    refetchIssues();
    refetchSessionStatus();
    refetchSourceDomains();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events?.length, shouldPoll]);

  const latestClarification = useMemo(
    () => extractLatestClarification(events),
    [events],
  );

  // Mutation state
  const [clarifyPending, setClarifyPending] = useState(false);
  const [clarifyError, setClarifyError] = useState<string | null>(null);
  const [triggerPending, setTriggerPending] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const [pausePending, setPausePending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  async function sendClarification(reply: string) {
    if (!beatId) return;
    const trimmed = reply.trim();
    if (!trimmed) return;
    setClarifyPending(true);
    setClarifyError(null);
    try {
      await submitClarification({ beatId, reply: trimmed });
      await Promise.all([refetchBeat(), refetchEvents()]);
    } catch (err) {
      setClarifyError(err instanceof Error ? err.message : String(err));
    } finally {
      setClarifyPending(false);
    }
  }

  async function triggerRun() {
    if (!beatId || triggerPending) return;
    setTriggerPending(true);
    setTriggerError(null);
    try {
      await triggerOnDemandRun({ beatId });
      refetchSessionStatus();
      refetchIssues();
    } catch (err) {
      setTriggerError(err instanceof Error ? err.message : String(err));
    } finally {
      setTriggerPending(false);
    }
  }

  async function pause() {
    if (!beatId || pausePending) return;
    setPausePending(true);
    try {
      await pauseBeat({ beatId });
      refetchBeat();
    } finally {
      setPausePending(false);
    }
  }

  async function resume() {
    if (!beatId || pausePending) return;
    setPausePending(true);
    try {
      await resumeBeat({ beatId });
      refetchBeat();
    } finally {
      setPausePending(false);
    }
  }

  async function remove(confirmMessage?: string) {
    if (!beatId || deletePending) return;
    const message = confirmMessage ?? t`Delete this beat? This cannot be undone.`;
    if (typeof window !== "undefined" && !window.confirm(message)) return;
    setDeletePending(true);
    try {
      await deleteBeat({ beatId });
      navigate("/dashboard");
    } finally {
      setDeletePending(false);
    }
  }

  return {
    beat,
    beatLoading,
    beatError,
    issues,
    sourceDomains,
    sessionStatus,
    sessionLinkId,
    events,
    agentEventsError,
    isStreamable,
    isGenerating,
    shouldPoll,
    latestClarification,
    refetchBeat,
    refetchIssues,
    refetchSessionStatus,
    refetchEvents,
    sendClarification,
    clarifyPending,
    clarifyError,
    triggerRun,
    triggerPending,
    triggerError,
    pause,
    resume,
    pausePending,
    remove,
    deletePending,
  };
}
