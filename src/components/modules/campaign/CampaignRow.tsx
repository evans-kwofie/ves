import { Link } from "@tanstack/react-router";
import CampaignDropdownMenu from "./molecules/CampaignDropdown";
import type { Campaign, CampaignStatus } from "~/types/campaign";
import { CHANNEL_META } from "~/lib/channels";
import type { Channel } from "~/lib/channels";

export const STATUS_BADGE: Record<CampaignStatus, { label: string; cls: string }> = {
  draft:     { label: "Draft",     cls: "badge badge-gray"   },
  active:    { label: "Active",    cls: "badge badge-green"  },
  scheduled: { label: "Scheduled", cls: "badge badge-blue"   },
  completed: { label: "Completed", cls: "badge badge-purple" },
};

export function replyRate(sent: number, replies: number) {
  if (sent === 0) return "—";
  return `${Math.round((replies / sent) * 100)}%`;
}

function ChannelBadge({ channels }: { channels: Channel[] }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
      {channels.map((c) => {
        const { Icon, label } = CHANNEL_META[c];
        return <Icon key={c} size={12} title={label} />;
      })}
      <span>{channels.map((c) => CHANNEL_META[c].label).join(", ")}</span>
    </span>
  );
}

export function CampaignRow({
  campaign,
  workspaceId,
  onDelete,
  onStatusChange,
}: {
  campaign: Campaign;
  workspaceId: string;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: CampaignStatus) => void;
}) {
  const badge = STATUS_BADGE[campaign.status];

  return (
    <tr className="border-b border-border last:border-0 transition-colors">
      <td className="py-3 px-4">
        <Link
          to="/$workspaceId/campaigns/$id"
          params={{ workspaceId, id: campaign.id }}
          className="text-[13px] font-medium text-foreground hover:text-accent transition-colors"
        >
          {campaign.name}
        </Link>
        {campaign.goal && (
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{campaign.goal}</p>
        )}
      </td>

      <td className="py-3 px-4">
        <span className={badge.cls}>{badge.label}</span>
      </td>

      <td className="py-3 px-4">
        {campaign.channels.length > 0
          ? <ChannelBadge channels={campaign.channels} />
          : <span className="text-muted-foreground/40">—</span>}
      </td>

      <td className="py-3 px-4 text-[13px] tabular-nums">{campaign.leadCount}</td>
      <td className="py-3 px-4 text-[13px] tabular-nums">{campaign.sentCount}</td>
      <td className="py-3 px-4 text-[13px] tabular-nums">{campaign.replyCount}</td>
      <td className="py-3 px-4 text-[13px] tabular-nums font-medium">
        <span className={campaign.replyCount > 0 ? "text-accent" : "text-muted-foreground"}>
          {replyRate(campaign.sentCount, campaign.replyCount)}
        </span>
      </td>

      <td className="py-3 px-4">
        <CampaignDropdownMenu
          campaignId={campaign.id}
          workspaceId={workspaceId}
          status={campaign.status}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
        />
      </td>
    </tr>
  );
}
