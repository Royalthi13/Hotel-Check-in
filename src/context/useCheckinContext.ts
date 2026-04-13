import { useContext } from "react";

import { CheckinContext } from "./CheckinContextDef";

export const useCheckinContext = () => {
  const ctx = useContext(CheckinContext);
  if (!ctx)
    throw new Error(
      "useCheckinContext debe usarse dentro de un CheckinProvider",
    );
  return ctx;
};