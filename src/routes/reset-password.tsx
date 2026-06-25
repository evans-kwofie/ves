import * as React from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "~/lib/auth-client";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { PasswordInput } from "~/components/ui/password-input";
import { toast } from "sonner";
import { AuthLayout } from "~/components/modules/AuthLayout";
import { z } from "zod";

export const Route = createFileRoute("/reset-password")({
  beforeLoad: ({ context }) => {
    if (context.session) throw redirect({ to: "/" });
  },
  validateSearch: z.object({ token: z.string().optional() }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    if (!token) {
      toast.error("Invalid or missing reset token");
      return;
    }
    setLoading(true);
    const result = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setLoading(false);
    if (result.error) {
      toast.error(result.error.message ?? "Failed to reset password");
      return;
    }
    toast.success("Password reset — sign in with your new password");
    window.location.href = "/sign-in";
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-bold tracking-tight text-foreground">
          Set new password
        </h1>
        <p className="text-[13px] text-muted-foreground">
          Choose a strong password for your account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">New password</Label>
          <PasswordInput
            id="password"
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <PasswordInput
            id="confirm"
            placeholder="Repeat your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <Button
          type="submit"
          disabled={loading || !token}
          className="w-full mt-1"
        >
          {loading ? "Resetting..." : "Reset password"}
        </Button>
      </form>

      <p className="text-[12px] text-center text-muted-foreground">
        <a href="/sign-in" className="text-accent font-medium hover:underline">
          Back to sign in
        </a>
      </p>
    </AuthLayout>
  );
}
