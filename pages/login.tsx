import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { signIn, useSession } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      const callbackUrl =
        typeof router.query.callbackUrl === "string"
          ? router.query.callbackUrl
          : "/dashboard";
      router.replace(callbackUrl);
    }
  }, [status, router]);

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-50">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink-200 border-t-ink-900" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const callbackUrl =
      typeof router.query.callbackUrl === "string"
        ? router.query.callbackUrl
        : "/dashboard";

    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setIsSubmitting(false);
      return;
    }

    router.push(callbackUrl);
  };

  return (
    <>
      <Head>
        <title>Sign in — Jojjy Gallery CRM</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-ink-50 px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">
              Jojjy Gallery
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Staff sign in
            </h1>
            <p className="mt-2 text-sm text-ink-600">
              CRM access only. Customer accounts from the public site will not
              work here.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-lg border border-ink-200 bg-white p-6 shadow-sm space-y-4"
          >
            {error ? (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <label className="block">
              <span className="text-xs font-medium text-ink-700">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm outline-none focus:border-ink-900"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-ink-700">Password</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-ink-300 px-3 py-2 text-sm outline-none focus:border-ink-900"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-md bg-ink-950 px-3 py-2.5 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-60"
            >
              {isSubmitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
