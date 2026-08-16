import { create, useStore } from "zustand";

export const ShowAddStepState = create<{
  show: boolean;
  setShow: (val: boolean) => void;
}>((set) => {
  return {
    show: false,
    setShow: (val) => {
      set({
        show: val,
      });
    },
  };
});

export const useShowAddSequenceStepState = () => {
  const show = useStore(ShowAddStepState, (state) => state.show);

  const setShow = useStore(ShowAddStepState, (state) => state.setShow);

  return {
    show,
    setShow,
  };
};
