import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { createBeat } from "wasp/client/operations";

type CadencePreset = "daily" | "weekly" | "on_demand";

const PRESETS: Record<
  CadencePreset,
  { label: string; cron: string | null; cadenceType: "TIME_BASED" | "ON_DEMAND" }
> = {
  daily: {
    label: "Daily, 7am (Europe/Warsaw)",
    cron: "0 7 * * *",
    cadenceType: "TIME_BASED",
  },
  weekly: {
    label: "Weekly on Monday, 7am",
    cron: "0 7 * * 1",
    cadenceType: "TIME_BASED",
  },
  on_demand: {
    label: "On-demand (no schedule)",
    cron: null,
    cadenceType: "ON_DEMAND",
  },
};

export function NewBeatPage() {
  const navigate = useNavigate();
  const [brief, setBrief] = useState("");
  const [preset, setPreset] = useState<CadencePreset>("daily");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = brief.trim();
    if (trimmed.length < 4) {
      setError("Brief must be at least 4 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const p = PRESETS[preset];
      const { beatId } = await createBeat({
        brief: trimmed,
        cadenceType: p.cadenceType,
        cronExpression: p.cron ?? undefined,
      });
      navigate(`/beats/${beatId}`);
    } catch (err: any) {
      setError(err?.message ?? String(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <Link to="/dashboard" className="text-sm text-neutral-500 hover:underline">
        ← Back to dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">Create a new beat</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Describe what you want covered. The Beat Designer turns it into a spec.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium">Brief</label>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="e.g. Daily digest of AI agent framework releases, papers, and notable real-world deployments."
            rows={6}
            maxLength={2000}
            className="w-full rounded border border-neutral-300 p-3 text-sm focus:border-neutral-500 focus:outline-none"
            required
          />
          <p className="mt-1 text-xs text-neutral-400">
            {brief.length} / 2000
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Cadence</label>
          <div className="space-y-2">
            {(Object.keys(PRESETS) as CadencePreset[]).map((key) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-3 rounded border border-neutral-200 p-3 hover:border-neutral-400"
              >
                <input
                  type="radio"
                  name="cadence"
                  value={key}
                  checked={preset === key}
                  onChange={() => setPreset(key)}
                />
                <span className="text-sm">{PRESETS[key].label}</span>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create beat"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="rounded border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
