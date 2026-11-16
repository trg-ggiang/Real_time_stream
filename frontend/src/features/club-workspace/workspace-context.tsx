import { createContext, useContext } from "react";
import type { WorkspaceContext } from "./services/workspace-api";
export interface WorkspaceSession extends WorkspaceContext {
  token: string;
  clubId: string;
  reload: () => void;
  onMeeting?: () => void;
}
export const ClubContext = createContext<WorkspaceSession | null>(null);
export function useClub() {
  const context = useContext(ClubContext);
  if (!context) throw new Error("Workspace context missing");
  return context;
}
