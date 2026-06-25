import * as React from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "~/lib/auth-client";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { toast } from "sonner";
import { AuthLayout } from "~/components/modules/AuthLayout";

export const Route = createFileRoute("/forgot-password")({
  beforeLoad: ({ context }) => {
    if (context.session) throw redirect({ to: "/" });
  },
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (result.error) {
      toast.error(result.error.message ?? "No account found for that email");
      return;
    }
    setSent(true);
  }

  return (
    <AuthLayout>
      {sent ? (
        <div className="flex flex-col gap-3">
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">
            Check your email
          </h1>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            If an account exists for{" "}
            <span className="text-foreground">{email}</span>, you'll receive a
            password reset link shortly.
          </p>
          <a
            href="/sign-in"
            className="text-[13px] text-accent font-medium hover:underline mt-2"
          >
            Back to sign in
          </a>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <h1 className="text-[22px] font-bold tracking-tight text-foreground">
              Forgot password?
            </h1>
            <p className="text-[13px] text-muted-foreground">
              Enter your email and we'll send you a reset link.
            </p>
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
            <Button type="submit" disabled={loading} className="w-full mt-1">
              {loading ? "Sending..." : "Send reset link"}
            </Button>
          </form>

          <p className="text-[12px] text-center text-muted-foreground">
            <a
              href="/sign-in"
              className="text-accent font-medium hover:underline"
            >
              Back to sign in
            </a>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
