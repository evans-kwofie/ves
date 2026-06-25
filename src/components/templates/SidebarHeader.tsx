import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpDownIcon, Tick01Icon, Add01Icon } from "hugeicons-react";
import { authClient } from "~/lib/auth-client";
import { useWorkspaceStore } from "~/store/workspace";

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

interface Workspace {
  id: string;
  name: string;
  logo?: string | null;
}

interface SidebarHeaderProps {
  workspaceId: string;
  workspaceName: string;
  workspaceLogo?: string | null;
}

function WorkspaceAvatar({ name, logo }: { name: string; logo?: string | null }) {
  if (logo) {
    return <img src={logo} alt={name} className="rounded-full object-cover shrink-0 size-5.5" />;
  }
  return (
    <div className="rounded-full flex items-center justify-center font-bold shrink-0 leading-none bg-accent text-accent-foreground size-5.5 text-[9px]">
      {getInitials(name)}
    </div>
  );
}

export function SidebarHeader({ workspaceId, workspaceName, workspaceLogo }: SidebarHeaderProps) {
  const navigate = useNavigate();
  const { selectorOpen, openSelector, closeSelector, openCreate } = useWorkspaceStore();
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([]);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!selectorOpen) return;
    authClient.organization.list().then((res) => {
      if (res.data) setWorkspaces(res.data);
    });
  }, [selectorOpen]);

  React.useEffect(() => {
    if (!selectorOpen) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) closeSelector();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selectorOpen, closeSelector]);

  function handleSelect(id: string) {
    closeSelector();
    if (id !== workspaceId) navigate({ to: "/$workspaceId", params: { workspaceId: id } });
  }

  return (
    <div ref={ref} className="relative mx-1 mt-1">
      <button
        onClick={() => (selectorOpen ? closeSelector() : openSelector())}
        className="w-full flex items-center gap-2.5 px-3 py-3 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
      >
        <WorkspaceAvatar name={workspaceName} logo={workspaceLogo} />
        <span className="flex-1 min-w-0 text-[13px] font-semibold text-foreground truncate leading-none text-left">
          {workspaceName}
        </span>
        <ArrowUpDownIcon size={13} className="shrink-0 text-muted-foreground" />
      </button>

      {selectorOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg py-1 overflow-hidden bg-card border border-card-border shadow-xl">
          {workspaces.map((ws) => {
            const active = ws.id === workspaceId;
            return (
              <button
                key={ws.id}
                onClick={() => handleSelect(ws.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors cursor-pointer text-left ${active ? "text-foreground" : "text-muted-foreground"}`}
              >
                <WorkspaceAvatar name={ws.name} logo={ws.logo} />
                <span className="flex-1 min-w-0 text-[12px] font-medium truncate">{ws.name}</span>
                {active && <Tick01Icon size={12} className="text-accent shrink-0" />}
              </button>
            );
          })}

          <div className="my-1 h-px bg-border" />

          <button
            onClick={openCreate}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 transition-colors cursor-pointer text-left text-muted-foreground"
          >
            <div className="size-4.5 rounded-sm flex items-center justify-center shrink-0 bg-muted">
              <Add01Icon size={10} className="text-muted-foreground" />
            </div>
            <span className="text-[12px] font-medium">New workspace</span>
          </button>
        </div>
      )}
    </div>
  );
}
