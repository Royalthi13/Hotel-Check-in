import { createContext } from "react";
import type React from "react";
import type { CheckinState, CheckinNav, CheckinActions } from "@/types";

export interface CheckinContextValue {
  state: CheckinState;
  nav: CheckinNav;
  actions: CheckinActions;
  isLoading: boolean;
  submitError: string;
  isSubmitting: boolean;
  isOffline: boolean;
  isPartialSuccess: boolean;
  legalPassed: boolean;
  setLegalPassed: React.Dispatch<React.SetStateAction<boolean>>;
  hasMinorsFlag: boolean;
  setHasMinorsFlag: React.Dispatch<React.SetStateAction<boolean>>;
  token: string;
  handleChooseMethod: (method: "scan" | "manual") => void;
  handleSubmit: () => Promise<void>;
  handlePartialSubmit: () => Promise<void>;
  clearSubmitError: () => void;
    accessVerified: boolean;
  setAccessVerified: (v: boolean) => void;
}

export const CheckinContext = createContext<CheckinContextValue | null>(null);