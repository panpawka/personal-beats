import { Link, useNavigate } from "react-router";
import {
  useQuery,
  getBeats,
  pauseBeat,
  resumeBeat,
  deleteBeat,
} from "wasp/client/operations";
import { logout } from "wasp/client/auth";

function statusColor(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-800";
    case "PAUSED":
      return "bg-amber-100 text-amber-800";
    case "FAILED":
      return "bg-red-100 text-red-800";
    case "AWAITING_CLARIFICATION":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-neutral-200 text-neutral-700";
  }
}

function cadenceLabel(beat: {
  cadenceType: string;
  cronExpression: string | null;
}): string {
  if (beat.cadenceType === "ON_DEMAND") return "On-demand";
  return beat.cronExpression ? `cron: ${beat.cronExpression}` : "Time-based";
}

export function DashboardPage() {
  const { data: beats, isLoading, error, refetch } = useQuery(getBeats);
  const navigate = useNavigate();

  async function onPause(beatId: string) {
    await pauseBeat({ beatId });
    refetch();
  }
  async function onResume(beatId: string) {
    await resumeBeat({ beatId });
    refetch();
  }
  async function onDelete(beatId: string) {
    if (!confirm("Delete this beat? This cannot be undone.")) return;
    await deleteBeat({ beatId });
    refetch();
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your beats</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Editorial agents working on the topics you care about.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate("/beats/new")}
            className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            New beat
          </button>
          <button
            onClick={() => logout()}
            className="rounded border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100"
          >
            Log out
          </button>
        </div>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <p className="text-neutral-500">Loading…</p>
        ) : error ? (
          <p className="text-red-600">Error: {String(error)}</p>
        ) : !beats || beats.length === 0 ? (
          <div className="rounded border border-dashed border-neutral-300 p-12 text-center">
            <p className="text-neutral-600">No beats yet.</p>
            <button
              onClick={() => navigate("/beats/new")}
              className="mt-4 rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Create your first beat
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {beats.map((beat) => (
              <li
                key={beat.id}
                className="rounded border border-neutral-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <Link
                    to={`/beats/${beat.id}`}
                    className="min-w-0 flex-1 hover:underline"
                  >
                    <h2 className="truncate text-base font-semibold">
                      {beat.title}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-sm text-neutral-600">
                      {beat.brief}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`rounded px-2 py-0.5 font-medium ${statusColor(beat.status)}`}
                      >
                        {beat.status}
                      </span>
                      <span className="text-neutral-500">
                        {cadenceLabel(beat)}
                      </span>
                      {beat.sourceCount != null && (
                        <span className="text-neutral-500">
                          {beat.sourceCount} source
                          {beat.sourceCount === 1 ? "" : "s"}
                        </span>
                      )}
                      <span className="text-neutral-500">
                        {beat.lastIssueAt
                          ? `last issue ${new Date(beat.lastIssueAt).toLocaleDateString()}`
                          : "no issues yet"}
                      </span>
                    </div>
                  </Link>
                  <div className="flex shrink-0 flex-col gap-1">
                    {beat.status === "ACTIVE" && (
                      <button
                        onClick={() => onPause(beat.id)}
                        className="rounded border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-100"
                      >
                        Pause
                      </button>
                    )}
                    {beat.status === "PAUSED" && (
                      <button
                        onClick={() => onResume(beat.id)}
                        className="rounded border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-100"
                      >
                        Resume
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(beat.id)}
                      className="rounded border border-red-300 px-3 py-1 text-xs text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
