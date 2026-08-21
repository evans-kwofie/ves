import { create } from "zustand";
export const useProductSheet = create<{
  open: boolean;
  openSheet: () => void;
  closeSheet: () => void;
}>((set) => ({
  open: false,
  openSheet: () => set({ open: true }),
  closeSheet: () => set({ open: false }),
}));
