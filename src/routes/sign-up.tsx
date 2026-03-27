import * as React from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "~/lib/auth-client";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/sign-up")({
  beforeLoad: ({ context }) => {
    if (context.session) throw redirect({ to: "/" });
  },
  component: SignUpPage,
});

function SignUpPage() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    console.log("[sign-up] submitting for", email);
    const result = await authClient.signUp.email({ name, email, password });
    console.log("[sign-up] result:", JSON.stringify(result));
    setLoading(false);
    if (result.error) {
      toast.error(result.error.message ?? "Sign up failed");
      return;
    }
    console.log("[sign-up] success — navigating to /");
    window.location.href = "/";
  }

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="auth-logo">
          vesper<span style={{ color: "var(--accent)" }}>.</span>
        </div>
        <p className="auth-sub">Create your account</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Evans Kwofie"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
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
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <Button type="submit" disabled={loading} style={{ width: "100%", marginTop: 8 }}>
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="auth-link-row">
          Already have an account?{" "}
          <a href="/sign-in" className="auth-link">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
