import { create } from "zustand";
import type { Lead } from "~/types/lead";
import type { EmailSignature } from "~/types/signature";

interface ComposeDraftState {
  isOpen: boolean;
  campaignId: string | null;
  leads: Lead[];
  signatures: EmailSignature[];

  // Form
  leadId: string;
  subject: string;
  body: string;
  signatureId: string;
  preview: boolean;

  // Actions
  open: (opts: { campaignId: string; leads: Lead[]; signatures: EmailSignature[] }) => void;
  close: () => void;
  setLeadId: (id: string) => void;
  setSubject: (s: string) => void;
  setBody: (s: string) => void;
  setSignatureId: (id: string) => void;
  setPreview: (v: boolean) => void;
}

export const useComposeDraft = create<ComposeDraftState>((set) => ({
  isOpen: false,
  campaignId: null,
  leads: [],
  signatures: [],
  leadId: "",
  subject: "",
  body: "",
  signatureId: "",
  preview: false,

  open: ({ campaignId, leads, signatures }) => {
    const defaultLead = leads[0];
    const defaultSig = signatures.find((s) => s.isDefault) ?? signatures[0];
    set({
      isOpen: true,
      campaignId,
      leads,
      signatures,
      leadId: defaultLead?.id ?? "",
      subject: "",
      body: defaultLead ? `Hi ${defaultLead.ceo},\n\n` : "",
      signatureId: defaultSig?.id ?? "",
      preview: false,
    });
  },

  close: () => set({ isOpen: false }),
  setLeadId: (leadId) =>
    set((s) => {
      const lead = s.leads.find((l) => l.id === leadId);
      return {
        leadId,
        body: lead ? `Hi ${lead.ceo},\n\n` : s.body,
      };
    }),
  setSubject: (subject) => set({ subject }),
  setBody: (body) => set({ body }),
  setSignatureId: (signatureId) => set({ signatureId }),
  setPreview: (preview) => set({ preview }),
}));
