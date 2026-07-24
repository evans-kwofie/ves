import { DirectoryResult } from "~/routes/api/directories/search";


export type DirectoryKey = "producthunt" | "g2" | "capterra" | "indiehackers" | "betalist" | "appsumo";
export interface ResultState {
  data: DirectoryResult;
  status: "idle" | "enriching" | "saved" | "duplicate" | "saving";
}

export interface DirectorySearchPanelProps {
  orgId: string;
}