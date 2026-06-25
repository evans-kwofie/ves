import { create } from "zustand";

interface WorkspaceStore {
  selectorOpen: boolean;
  createOpen: boolean;
  openSelector: () => void;
  closeSelector: () => void;
  openCreate: () => void;
  closeCreate: () => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  selectorOpen: false,
  createOpen: false,
  openSelector: () => set({ selectorOpen: true }),
  closeSelector: () => set({ selectorOpen: false }),
  openCreate: () => set({ selectorOpen: false, createOpen: true }),
  closeCreate: () => set({ createOpen: false }),
}));
