import { create } from "zustand";
import type { Lead } from "~/types/lead";

interface AddLeadStore {
  open: boolean;
  campaignId: string | null;
  orgId: string | null;
  existingLeadIds: string[];
  onLeadAdded: ((lead: Lead) => void) | null;
  openDialog: (opts: {
    campaignId: string;
    orgId: string;
    existingLeadIds?: string[];
    onLeadAdded?: (lead: Lead) => void;
  }) => void;
  closeDialog: () => void;
}

export const useAddLeadStore = create<AddLeadStore>((set) => ({
  open: false,
  campaignId: null,
  orgId: null,
  existingLeadIds: [],
  onLeadAdded: null,
  openDialog: ({ campaignId, orgId, existingLeadIds = [], onLeadAdded = null }) =>
    set({ open: true, campaignId, orgId, existingLeadIds, onLeadAdded }),
  closeDialog: () => set({ open: false }),
}));
