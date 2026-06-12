import { create } from "zustand";
import type { Lead } from "~/types/lead";
import type { EmailSignature } from "~/types/signature";
import type { CampaignStep } from "~/db/queries/steps";

interface ComposeDraftState {
  isOpen: boolean;
  campaignId: string | null;
  leads: Lead[];
  signatures: EmailSignature[];
  steps: CampaignStep[];

  // Form
  leadId: string;
  stepNumber: number | null;
  subject: string;
  body: string;
  signatureId: string;
  preview: boolean;

  // Actions
  open: (opts: {
    campaignId: string;
    leads: Lead[];
    signatures: EmailSignature[];
    steps?: CampaignStep[];
    leadId?: string;
    stepNumber?: number;
  }) => void;
  close: () => void;
  setLeadId: (id: string) => void;
  setStepNumber: (n: number | null) => void;
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
  steps: [],
  leadId: "",
  stepNumber: null,
  subject: "",
  body: "",
  signatureId: "",
  preview: false,

  open: ({ campaignId, leads, signatures, steps = [], leadId, stepNumber }) => {
    const defaultLead = leads.find((l) => l.id === leadId) ?? leads[0];
    const defaultSig = signatures.find((s) => s.isDefault) ?? signatures[0];
    const defaultStep = steps.find((s) => s.stepNumber === stepNumber) ?? steps[0];
    set({
      isOpen: true,
      campaignId,
      leads,
      signatures,
      steps,
      leadId: defaultLead?.id ?? "",
      stepNumber: defaultStep?.stepNumber ?? null,
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
      return { leadId, body: lead ? `Hi ${lead.ceo},\n\n` : s.body };
    }),
  setStepNumber: (stepNumber) => set({ stepNumber }),
  setSubject: (subject) => set({ subject }),
  setBody: (body) => set({ body }),
  setSignatureId: (signatureId) => set({ signatureId }),
  setPreview: (preview) => set({ preview }),
}));
