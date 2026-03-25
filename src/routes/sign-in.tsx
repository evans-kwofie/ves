import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { authClient } from "~/lib/auth-client";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/sign-in")({
  component: SignInPage,
});

function SignInPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    console.log("[sign-in] submitting for", email);
    const result = await authClient.signIn.email({ email, password });
    console.log("[sign-in] result:", JSON.stringify(result));
    setLoading(false);
    if (result.error) {
      toast.error(result.error.message ?? "Sign in failed");
      return;
    }
    console.log("[sign-in] success — navigating to /");
    window.location.href = "/";
  }

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="auth-logo">
          vesper<span style={{ color: "var(--accent)" }}>.</span>
        </div>
        <p className="auth-sub">Sign in to your workspace</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="auth-field">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={loading} style={{ width: "100%", marginTop: 8 }}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="auth-link-row">
          Don&apos;t have an account?{" "}
          <a href="/sign-up" className="auth-link">
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}
