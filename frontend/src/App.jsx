
import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { getCurrentUser, login } from "./services/api";

const Dashboard = lazy(() => import("./pages/Dashboard"));

function SignIn({ onSignIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await onSignIn(email, password);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Could not sign in. Check that the backend is running."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-lg">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-blue-600 p-3 text-white">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="font-bold text-slate-900">AICTE Grievance Intelligence</p>
            <p className="text-sm text-slate-500">Official sign in</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              maxLength={200}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? (
              <LoaderCircle size={17} className="animate-spin" />
            ) : (
              <LockKeyhole size={17} />
            )}
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="mt-5 text-xs leading-5 text-slate-500">
          The initial administrator account must be provisioned by running
          <code className="mx-1 rounded bg-slate-100 px-1">npm run create-admin</code>
          in the backend.
        </p>
      </section>
    </main>
  );
}

function AuthGate() {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let active = true;

    function handleAuthRequired() {
      setUser(null);
      setStatus("unauthenticated");
    }

    async function checkSession() {
      try {
        const currentUser = await getCurrentUser();
        if (active) {
          setUser(currentUser);
          setStatus("authenticated");
        }
      } catch (error) {
        if (!active) return;
        if (error.response?.status === 401) {
          setStatus("unauthenticated");
        } else {
          setStatus("unavailable");
        }
      }
    }

    window.addEventListener("sih:auth-required", handleAuthRequired);
    void Promise.resolve().then(checkSession);
    return () => {
      active = false;
      window.removeEventListener("sih:auth-required", handleAuthRequired);
    };
  }, []);

  async function handleSignIn(email, password) {
    const signedInUser = await login({ email, password });
    setUser(signedInUser);
    setStatus("authenticated");
  }

  if (status === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center gap-3 text-sm text-slate-500">
        <LoaderCircle size={20} className="animate-spin text-blue-600" />
        Checking sign-in...
      </main>
    );
  }

  if (status === "unavailable") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-semibold text-slate-800">Could not connect to the API.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-blue-700"
        >
          Retry
        </button>
      </main>
    );
  }

  if (!user) return <SignIn onSignIn={handleSignIn} />;

  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center gap-3 text-sm text-slate-500">
          <LoaderCircle size={20} className="animate-spin text-blue-600" />
          Loading dashboard...
        </main>
      }
    >
      <Dashboard
        user={user}
        onLogout={() => {
          setUser(null);
          setStatus("unauthenticated");
        }}
      />
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthGate />
    </BrowserRouter>
  );
}
