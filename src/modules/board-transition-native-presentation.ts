/** Await actual native coverage release before any authored transition clock starts. */
export async function releaseNativeBoardTransitionPresentation(options: {
  ready: () => Promise<boolean>;
  isCurrent: () => boolean;
  start: () => void;
  cancel: () => void;
}): Promise<void> {
  let accepted = false;
  try { accepted = await options.ready(); } catch { /* The same transition owns cancellation. */ }
  if (!options.isCurrent()) return;
  if (accepted) {
    try { options.start(); }
    catch { if (options.isCurrent()) options.cancel(); }
  } else options.cancel();
}
