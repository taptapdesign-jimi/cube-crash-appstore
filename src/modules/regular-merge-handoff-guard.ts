/**
 * An accepted regular stack owns its source and destination until the short
 * absorb handoff commits. No external merge may enter during that window:
 * its finalizer can remove/normalize the same tile references underneath the
 * later transaction. Magnet's pulled-tile consolidation is the sole exception
 * because it is an internal continuation of the transaction that owns both
 * protected tiles.
 */
export function shouldBlockMergeDuringRegularHandoff(
  handoffActive: boolean,
  src: any,
  dst: any,
): boolean {
  if (!handoffActive) return false;
  const isInternalPulledTilesMerge =
    src?._wildMagnetAffected === true &&
    dst?._wildMagnetAffected === true;
  return !isInternalPulledTilesMerge;
}
