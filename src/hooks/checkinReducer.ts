/**
 * Este fichero existía con una implementación duplicada y divergente del reducer.
 * Se ha eliminado la duplicación. Toda la lógica vive en useCheckin.ts.
 * Se re-exporta desde allí para compatibilidad si algo lo importara directamente.
 */
export { checkinReducer, buildEmptyState } from "./useCheckin";
export type { CheckinAction } from "./useCheckin";