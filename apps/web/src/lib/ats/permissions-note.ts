/**
 * El frontend no tiene endpoint de permissions efectivos del membership.
 * Las acciones ATS (request/approve/manage) se muestran para UX del flujo;
 * el backend sigue siendo autoridad (403).
 */
export const ATS_PERMISSIONS_UX_NOTE =
  "No hay API de permissions efectivos; acciones visibles, backend authoritative.";
