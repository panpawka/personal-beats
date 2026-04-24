import { Link, Navigate } from "react-router";
import { useAuth } from "wasp/client/auth";

export function LandingPage() {
  const { data: user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl p-12">
        <p className="text-neutral-500">Loading…</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="mx-auto max-w-2xl p-12">
      <h1 className="text-3xl font-semibold">Personal Newsroom</h1>
      <p className="mt-4 text-neutral-600">
        Your own editorial agent. Describe a beat, get a newsletter.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          to="/signup"
          className="rounded bg-neutral-900 px-4 py-2 text-white"
        >
          Sign up
        </Link>
        <Link
          to="/login"
          className="rounded border border-neutral-300 px-4 py-2"
        >
          Log in
        </Link>
      </div>
    </div>
  );
}
