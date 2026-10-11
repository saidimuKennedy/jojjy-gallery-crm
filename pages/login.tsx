import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { signIn, useSession } from "next-auth/react";
import { Alert, Button, Card, Field, TextField } from "@/components/ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { status } = useSession();
  const router = useRouter();

  // Only same-origin paths are valid login destinations.
  const rawCallback =
    typeof router.query.callbackUrl === "string"
      ? router.query.callbackUrl
      : "/dashboard";
  const callbackUrl =
    rawCallback.startsWith("/") && !rawCallback.startsWith("//")
      ? rawCallback
      : "/dashboard";

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(callbackUrl);
    }
  }, [status, router]);

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink-200 border-t-accent-600" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

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
      <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">
              Jojjy Gallery
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">
              Staff sign in
            </h1>
            <p className="mt-2 text-sm text-ink-600">
              CRM access only. Customer accounts from the public site will not
              work here.
            </p>
          </div>

          <Card>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error ? <Alert tone="danger">{error}</Alert> : null}
              <Field label="Email" required>
                <TextField
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Password" required>
                <TextField
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
