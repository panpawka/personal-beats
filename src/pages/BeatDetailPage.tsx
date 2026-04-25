import { useNavigate, useParams } from "react-router";
import { useAuth } from "wasp/client/auth";
import { Trans, useLingui } from "@lingui/react/macro";
import { AppShell } from "../layout/AppShell";
import { Masthead } from "../layout/Masthead";
import { useBeatActions } from "../hooks/useBeatActions";
import { DesignerPanel } from "./beat/DesignerPanel";
import { ActivePanel } from "./beat/ActivePanel";

const DESIGNER_STATUSES = new Set<string>([
  "DRAFT",
  "DESIGNING",
  "AWAITING_CLARIFICATION",
  "SCOUTING",
]);

function userEmailFrom(user: unknown): string | null {
  if (!user || typeof user !== "object") return null;
  const u = user as Record<string, unknown>;
  const direct = typeof u.email === "string" ? u.email : null;
  if (direct) return direct;
  const ids = (u.identities as { email?: { id?: string } } | undefined) ?? undefined;
  return ids?.email?.id ?? null;
}

export function BeatDetailPage() {
  const { beatId } = useParams<{ beatId: string }>();
  const navigate = useNavigate();
  const { data: user } = useAuth();
  const { t } = useLingui();
  const actions = useBeatActions(beatId);

  if (actions.beatLoading) {
    return (
      <AppShell>
        <Masthead showDate={false} />
        <div
          className="content pb-loading"
          style={{
            fontFamily: "var(--mono)",
            color: "var(--ink-3)",
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          <Trans>Loading beat</Trans>
        </div>
      </AppShell>
    );
  }

  if (actions.beatError || !actions.beat) {
    return (
      <AppShell>
        <Masthead showDate={false} title={t`Beat not found`} />
        <div className="content">
          <div className="editorial-error">
            <Trans>This beat doesn't exist or you don't have access.</Trans>
          </div>
          <button
            type="button"
            className="pb-btn pb-btn-ghost"
            onClick={() => navigate("/dashboard")}
            style={{ marginTop: 18 }}
          >
            <Trans>Back to beats</Trans>
          </button>
        </div>
      </AppShell>
    );
  }

  const { beat } = actions;

  if (DESIGNER_STATUSES.has(beat.status)) {
    return (
      <DesignerPanel
        beat={{
          id: beat.id,
          title: beat.title,
          brief: beat.brief,
          summary: beat.summary ?? null,
          status: beat.status,
          cadenceType: beat.cadenceType,
          cronExpression: beat.cronExpression ?? null,
          outputLanguage: beat.outputLanguage,
          depth: beat.depth,
          defaultsApplied: beat.defaultsApplied ?? "[]",
        }}
        events={actions.events}
        agentEventsError={actions.agentEventsError}
        latestClarification={actions.latestClarification}
        sendClarification={actions.sendClarification}
        clarifyPending={actions.clarifyPending}
        clarifyError={actions.clarifyError}
        onCancel={() => navigate("/dashboard")}
        onDelete={() => actions.remove()}
        deletePending={actions.deletePending}
      />
    );
  }

  return (
    <ActivePanel
      beat={{
        id: beat.id,
        title: beat.title,
        brief: beat.brief,
        summary: beat.summary ?? null,
        status: beat.status,
        cadenceType: beat.cadenceType,
        cronExpression: beat.cronExpression ?? null,
        timezone: beat.timezone ?? null,
        depth: beat.depth,
        outputLanguage: beat.outputLanguage,
        sourceCount: beat.sourceCount ?? null,
        coverageAssessment: beat.coverageAssessment ?? null,
        coverageNote: beat.coverageNote ?? null,
        createdAt: beat.createdAt,
      }}
      issues={actions.issues}
      isGenerating={actions.isGenerating}
      triggerPending={actions.triggerPending}
      triggerError={actions.triggerError}
      sessionLinkId={actions.sessionLinkId}
      userEmail={userEmailFrom(user)}
      onTrigger={actions.triggerRun}
      onPause={actions.pause}
      onResume={actions.resume}
      onDelete={() => actions.remove()}
      pausePending={actions.pausePending}
      deletePending={actions.deletePending}
    />
  );
}
