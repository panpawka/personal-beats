import { useState } from "react";
import { Link, useParams } from "react-router";
import {
  useQuery,
  getIssue,
  submitItemFeedback,
} from "wasp/client/operations";
import type { Feedback } from "../shared/types";

export function IssueDetailPage() {
  const { beatId, issueId } = useParams<{ beatId: string; issueId: string }>();
  const { data: issue, isLoading, error, refetch } = useQuery(getIssue, {
    issueId: issueId!,
  });

  const [pendingItemId, setPendingItemId] = useState<string | null>(null);

  async function onFeedback(itemId: string, feedback: Feedback) {
    setPendingItemId(itemId);
    try {
      await submitItemFeedback({ issueItemId: itemId, feedback });
      refetch();
    } catch (err: any) {
      alert(err?.message ?? String(err));
    } finally {
      setPendingItemId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <p className="text-neutral-500">Loading…</p>
      </div>
    );
  }
  if (error || !issue) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <p className="text-red-600">Issue not found.</p>
        <Link
          to={beatId ? `/beats/${beatId}` : "/dashboard"}
          className="mt-4 inline-block text-sm underline"
        >
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <Link
        to={`/beats/${beatId}`}
        className="text-sm text-neutral-500 hover:underline"
      >
        ← Back to beat
      </Link>

      <header className="mt-4">
        <h1 className="text-2xl font-semibold">{issue.subject}</h1>
        {issue.dek && (
          <p className="mt-1 text-base text-neutral-600">{issue.dek}</p>
        )}
        <p className="mt-2 text-xs text-neutral-500">
          {new Date(issue.publishedAt).toLocaleString()} · email:{" "}
          {issue.emailStatus}
          {issue.emailSentAt
            ? ` · sent ${new Date(issue.emailSentAt).toLocaleString()}`
            : ""}
        </p>
        {issue.coverageNote && (
          <p className="mt-2 text-xs text-neutral-500">
            Coverage: {issue.coverageNote}
          </p>
        )}
      </header>

      {/* Rendered email preview */}
      {issue.htmlBody && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">
            Email preview
          </h2>
          <iframe
            title="issue preview"
            srcDoc={issue.htmlBody}
            sandbox="allow-same-origin"
            className="h-[800px] w-full rounded border border-neutral-200 bg-white"
          />
        </section>
      )}

      {/* Items with feedback */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Items</h2>
        <ul className="mt-3 space-y-4">
          {issue.items.map((item) => {
            const isPending = pendingItemId === item.id;
            return (
              <li
                key={item.id}
                className="rounded border border-neutral-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold">{item.headline}</h3>
                    <p className="mt-1 text-sm text-neutral-700">
                      {item.summary}
                    </p>
                    {item.whyItMatters && (
                      <p className="mt-2 text-sm italic text-neutral-600">
                        {item.whyItMatters}
                      </p>
                    )}
                    <a
                      href={item.primarySourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs text-blue-600 hover:underline"
                    >
                      {item.primarySourceUrl}
                    </a>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      onClick={() => onFeedback(item.id, "POSITIVE")}
                      disabled={isPending}
                      className={`rounded border px-2 py-1 text-xs ${
                        item.feedback === "POSITIVE"
                          ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                          : "border-neutral-300 hover:bg-neutral-100"
                      } disabled:opacity-50`}
                      aria-pressed={item.feedback === "POSITIVE"}
                    >
                      👍
                    </button>
                    <button
                      onClick={() => onFeedback(item.id, "NEGATIVE")}
                      disabled={isPending}
                      className={`rounded border px-2 py-1 text-xs ${
                        item.feedback === "NEGATIVE"
                          ? "border-red-400 bg-red-50 text-red-800"
                          : "border-neutral-300 hover:bg-neutral-100"
                      } disabled:opacity-50`}
                      aria-pressed={item.feedback === "NEGATIVE"}
                    >
                      👎
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
