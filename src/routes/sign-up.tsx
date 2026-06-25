import * as React from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { authClient } from "~/lib/auth-client";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { PasswordInput } from "~/components/ui/password-input";
import { toast } from "sonner";
import { AuthLayout } from "~/components/modules/AuthLayout";

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
    const result = await authClient.signUp.email({ name, email, password });
    setLoading(false);
    if (result.error) {
      toast.error(result.error.message ?? "Sign up failed");
      return;
    }
    window.location.href = "/";
  }

  return (
    <AuthLayout>
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-bold tracking-tight text-foreground">Create an account</h1>
        <p className="text-[13px] text-muted-foreground">Get started with Nextreach for free</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
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
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full mt-1">
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="text-[12px] text-center text-muted-foreground">
        Already have an account?{" "}
        <a href="/sign-in" className="text-accent font-medium hover:underline">Sign in</a>
      </p>
    </AuthLayout>
  );
}
