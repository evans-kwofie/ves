import * as React from "react";
import { CheckmarkCircle01Icon } from "hugeicons-react";

const FEATURES = [
  "Reddit & LinkedIn buying signal discovery",
  "AI-powered outreach campaigns & reply generation",
  "Full CRM pipeline from first signal to close",
];

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[2fr_3fr]">
      {/* Left — form */}
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-background">
        <div className="md:hidden mb-8 text-[20px] font-bold tracking-tight text-foreground">
          nextreach<span className="text-accent">.</span>
        </div>
        <div className="w-full max-w-md flex flex-col gap-7">{children}</div>
      </div>

      {/* Right — branding */}
      <div className="hidden md:flex flex-col justify-between bg-sidebar border-l border-card-border p-12 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute -top-40 -right-40 w-120 h-120 bg-accent/6 rounded-full blur-3xl pointer-events-none" />

        {/* App preview — clipped from bottom-right corner */}
        <div className="absolute bottom-0 right-0 translate-x-16 translate-y-16 pointer-events-none z-10">
          <div className="rounded-3xl overflow-hidden border border-white/8 bg-white/5 p-2 w-148">
            <img
              src="/dashboard-preview.png"
              alt="Nextreach dashboard"
              className="w-full block"
            />
          </div>
        </div>

        <div className="flex flex-col gap-40 relative z-20">
          <span className="text-[20px] font-bold tracking-tight text-foreground">
            nextreach<span className="text-accent">.</span>
          </span>

          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <h2 className="text-[34px] font-bold leading-[1.15] tracking-tight text-foreground">
                Find buyers. Start conversations.
                <br />
                Close deals.
              </h2>
              <p className="text-[14px] text-muted-foreground leading-relaxed max-w-lg">
                Spot buying signals on Reddit and LinkedIn, run AI-powered
                outreach, and manage your full pipeline from one place.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {FEATURES.map((f) => (
                <div key={f} className="flex items-center gap-2.5">
                  <CheckmarkCircle01Icon
                    size={15}
                    className="text-accent shrink-0"
                  />
                  <span className="text-[13px] text-muted-foreground">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground/40 relative z-20">
          © {new Date().getFullYear()} Nextreach
        </p>
      </div>
    </div>
  );
}
