import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Cancel01Icon } from "hugeicons-react";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetOverlay({ className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={className}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }}
      {...props}
    />
  );
}

export function SheetContent({ children, className, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <SheetOverlay />
      <DialogPrimitive.Content
        className={className}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 420,
          background: "var(--card)",
          borderLeft: "1px solid var(--card-border)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.4)",
          outline: "none",
        }}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          style={{
            position: "absolute",
            top: 18,
            right: 20,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--muted-foreground)",
            padding: 4,
            display: "flex",
            alignItems: "center",
            borderRadius: 4,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--foreground)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--muted-foreground)"; }}
        >
          <Cancel01Icon size={15} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "20px 24px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0, paddingRight: 48 }}>
      {children}
    </div>
  );
}

export function SheetTitle({ children }: { children: React.ReactNode }) {
  return (
    <DialogPrimitive.Title style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
      {children}
    </DialogPrimitive.Title>
  );
}

export function SheetDescription({ children }: { children: React.ReactNode }) {
  return (
    <DialogPrimitive.Description style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "2px 0 0" }}>
      {children}
    </DialogPrimitive.Description>
  );
}

export function SheetBody({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
      {children}
    </div>
  );
}

export function SheetFooter({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
      {children}
    </div>
  );
}
