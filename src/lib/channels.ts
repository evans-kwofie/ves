import { Mail01Icon, Linkedin01Icon, InstagramIcon, RedditIcon } from "hugeicons-react";

export const CHANNEL_LIST = ["email", "linkedin", "instagram", "reddit"] as const;

export type Channel = (typeof CHANNEL_LIST)[number];

export const CHANNEL_META: Record<Channel, {
  label: string;
  Icon: React.ElementType;
  description: (ctx: string | null) => string;
}> = {
  email: {
    label: "Email",
    Icon: Mail01Icon,
    description: (ctx) =>
      ctx
        ? `The AI will write a personalised email for each lead — ${ctx.toLowerCase()}`
        : "The AI will write a personalised cold email for each lead based on their profile.",
  },
  linkedin: {
    label: "LinkedIn",
    Icon: Linkedin01Icon,
    description: (ctx) =>
      ctx
        ? `The AI will draft a LinkedIn message for each lead — ${ctx.toLowerCase()}`
        : "The AI will draft a short LinkedIn message for each lead. You'll copy and send it manually.",
  },
  instagram: {
    label: "Instagram",
    Icon: InstagramIcon,
    description: (ctx) =>
      ctx
        ? `The AI will write a casual Instagram DM for each lead — ${ctx.toLowerCase()}`
        : "The AI will write a short Instagram DM for each lead. You'll copy and send it manually.",
  },
  reddit: {
    label: "Reddit",
    Icon: RedditIcon,
    description: (ctx) =>
      ctx
        ? `The AI will craft a Reddit comment or DM for each lead — ${ctx.toLowerCase()}`
        : "The AI will craft a relevant Reddit comment or DM for each lead based on their activity.",
  },
};
