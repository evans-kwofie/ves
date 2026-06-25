import * as React from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "~/lib/auth-client";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { PasswordInput } from "~/components/ui/password-input";
import { toast } from "sonner";
import { AuthLayout } from "~/components/modules/AuthLayout";

export const Route = createFileRoute("/sign-in")({
  beforeLoad: ({ context }) => {
    if (context.session) throw redirect({ to: "/" });
  },
  component: SignInPage,
});

function SignInPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await authClient.signIn.email({ email, password });
    setLoading(false);
    if (result.error) {
      toast.error(result.error.message ?? "Sign in failed");
      return;
    }
    window.location.href = "/";
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to your workspace</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
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
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <a href="/forgot-password" className="text-[12px] text-muted-foreground hover:text-accent transition-colors">
              Forgot password?
            </a>
          </div>
          <PasswordInput
            id="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full mt-1">
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <p className="text-[12px] text-center text-muted-foreground">
        Don&apos;t have an account?{" "}
        <a href="/sign-up" className="text-accent font-medium hover:underline">Sign up</a>
      </p>
    </AuthLayout>
  );
}
