import { Campaign } from "~/types/campaign";
import CampaignDetailsDropdown from "./CampaignDetailsDropdown";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import {
  Analytics01Icon,
  Clock01Icon,
  Linkedin01Icon,
  MailSend01Icon,
  Message01Icon,
  Target01Icon,
  User02Icon,
} from "hugeicons-react";
import { Button } from "~/components/ui/button";

export default function CampaignDetailHeader({
  campaign,
  workspaceId,
}: {
  workspaceId: string;
  campaign: Campaign;
}) {
  return (
    <>
      <div className="px-7 py-6">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight">
                {campaign.name}
              </h1>

              <Badge
                variant="secondary"
                className="h-5 rounded-md px-2 text-[11px] font-medium capitalize"
              >
                {campaign.status}
              </Badge>
            </div>

            {campaign.goal && (
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                {campaign.goal}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-y-2 text-sm text-muted-foreground">
              <MetaItem
                icon={Linkedin01Icon}
                value={campaign.channels?.join(", ") || "No channel"}
                capitalize
              />

              <MetaDivider />

              <MetaItem
                icon={User02Icon}
                value={`${campaign.leadCount ?? 0} leads`}
              />

              <MetaDivider />

              <MetaItem
                icon={MailSend01Icon}
                value={`${campaign.sentCount ?? 0} sent`}
              />

              <MetaDivider />

              <MetaItem
                icon={Message01Icon}
                value={`${campaign.replyCount ?? 0} replies`}
              />

              <MetaDivider />

              <MetaItem
                icon={Clock01Icon}
                value={
                  campaign.lastRunAt
                    ? `Last run ${formatDate(campaign.lastRunAt)}`
                    : "Never run"
                }
              />
              <MetaDivider />

              <MetaItem
                icon={Target01Icon}
                value={campaign.intentType?.replaceAll("_", " ") || "No intent"}
                capitalize
              />
            </div>
          </div>

          <div className="flex items-center gap-x-2">
            <Button variant={"outline"}>
              <Analytics01Icon />
              View Analytics
            </Button>
            <CampaignDetailsDropdown
              workspaceId={workspaceId}
              campaignId={campaign.id as string}
              status={campaign.status}
              existingLeadIds={[]}
              onDelete={() => window.history.back()}
              onStatusChange={(id, status) => {
                console.log({ id, status });
              }}
            />
          </div>
        </div>
      </div>

      <Separator />
    </>
  );
}

function MetaItem({
  icon: Icon,
  value,
  capitalize = false,
}: {
  icon: React.ElementType;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <Icon className="size-3.5 text-muted-foreground/70" />
      <span className={capitalize ? "capitalize" : undefined}>{value}</span>
    </div>
  );
}

function MetaDivider() {
  return <span aria-hidden="true" className="mx-3 h-3.5 w-px bg-border" />;
}

function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}
