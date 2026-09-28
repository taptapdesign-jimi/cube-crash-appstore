type StopSound = () => void;
type SfxOwnerLoader = () => Promise<readonly StopSound[]>;

// One complete stop registry for global Sounds OFF and diagnostic isolation.
// Imports stay lazy: importing this registry does not initialize cue owners.
// Include full owner stops only; route-specific visual tails keep their own API.
const soundOwners: readonly SfxOwnerLoader[] = [
  () => import('./launch-logo-transition-sound.js').then(owner => [owner.stopLaunchLogoTransitionSound]),
  () => import('./homepage-slider-motion-sound.js').then(owner => [owner.stopHomepageSliderMotionSounds]),
  () => import('./journey-hub-exit-sound.js').then(owner => [owner.stopJourneyHubExitSounds]),
  () => import('./journey-unit-motion-sound.js').then(owner => [owner.stopJourneyUnitMotionSounds]),
  () => import('./journey-new-card-sound.js').then(owner => [owner.stopJourneyNewCardSounds]),
  () => import('./board-popin-sound.js').then(owner => [owner.stopBoardPopInSound]),
  () => import('./arcade-crate-sound.js').then(owner => [owner.stopArcadeCrateSounds]),
  () => import('./arcade-round-digit-sound.js').then(owner => [owner.stopArcadeRoundDigitSounds, owner.stopBoardTransitionDigitSounds]),
  () => import('./arcade-stage-clear-sound.js').then(owner => [owner.stopArcadeStageClearSounds]),
  () => import('./barrel-merge6-sound.js').then(owner => [owner.stopBarrelMerge6Sounds]),
  () => import('./beach-ball-merge6-sound.js').then(owner => [owner.stopBeachBallMerge6Sounds]),
  () => import('./bee-merge6-sound.js').then(owner => [owner.stopBeeMerge6Sounds]),
  () => import('./board-transition-area55-sound.js').then(owner => [owner.stopBoardTransitionArea55Sounds]),
  () => import('./board-transition-forest-ambient-sound.js').then(owner => [owner.stopBoardTransitionForestAmbientSound]),
  () => import('./bottle-finale-sound.js').then(owner => [owner.stopBottleFinaleSounds]),
  () => import('./bottle-pull-merge-sound.js').then(owner => [owner.stopBottlePullMergeSounds]),
  () => import('./clean-board-sound.js').then(owner => [owner.stopCleanBoardSounds]),
  () => import('./core-tnt-merge6-sound.js').then(owner => [owner.stopCoreTntMerge6Sound]),
  () => import('./cta-activation-sound.js').then(owner => [owner.stopCtaActivationSounds]),
  () => import('./fail-screen-sound.js').then(owner => [owner.stopFailScreenSounds]),
  () => import('./fish-merge6-sound.js').then(owner => [owner.stopFishMerge6Sounds]),
  () => import('./flower-merge6-sound.js').then(owner => [owner.stopFlowerMerge6Sounds]),
  () => import('./gameplay-exit-modal-enter-sound.js').then(owner => [owner.stopGameplayExitModalEnterSound]),
  () => import('./homepage-slider-swipe-sound.js').then(owner => [owner.stopHomepageSliderSwipeSound]),
  () => import('./gameplay-pickup-sound.js').then(owner => [owner.stopGameplayPickupSound]),
  () => import('./honey-merge6-sound.js').then(owner => [owner.stopHoneyMerge6Sounds]),
  () => import('./journey-backpack-sound.js').then(owner => [owner.stopJourneyBackpackSounds]),
  () => import('./journey-card-entry-flip-sound.js').then(owner => [owner.stopJourneyCardEntryFlipSounds]),
  () => import('./journey-forest-ambient-sound.js').then(owner => [owner.stopJourneyForestAmbientSounds]),
  () => import('./journey-forest-gameplay-sound.js').then(owner => [owner.stopJourneyForestGameplaySound]),
  () => import('./journey-worlds-hub-sound.js').then(owner => [owner.stopJourneyWorldsHubSound]),
  () => import('./juice-finale-sound.js').then(owner => [owner.stopJuiceMerge6Sounds]),
  () => import('./kanta-merge6-sound.js').then(owner => [owner.stopKantaMerge6Sounds]),
  () => import('./laser-gun-merge6-sound.js').then(owner => [owner.stopLaserGunMerge6Sounds]),
  () => import('./magnet-pull-force-sound.js').then(owner => [owner.stopMagnetPullForceSounds]),
  () => import('./navigation-close-sound.js').then(owner => [owner.stopNavigationCloseSound]),
  () => import('./navigation-icon-sound.js').then(owner => [owner.stopNavigationIconSounds]),
  () => import('./no-moves-sound.js').then(owner => [owner.stopNoMovesSound]),
  () => import('./ordinary-stack-sound.js').then(owner => [owner.stopOrdinaryStackSound]),
  () => import('./regular-merge6-sound.js').then(owner => [owner.stopRegularMerge6Sounds]),
  () => import('./robo-cube-merge6-sound.js').then(owner => [owner.stopRoboCubeMerge6Sounds]),
  () => import('./spaceship-merge6-sound.js').then(owner => [owner.stopSpaceshipMerge6Sounds]),
  () => import('./wild-special-landing-sound.js').then(owner => [owner.stopWildSpecialLandingSound]),
  () => import('./wild-special-merge6-poof-sound.js').then(owner => [owner.stopWildSpecialMerge6PoofSounds]),
  () => import('./wild-star-merge6-sound.js').then(owner => [owner.stopWildStarMerge6Sound]),
];

export async function stopRegisteredSfxOwners(isCurrent: () => boolean): Promise<void> {
  // Each asynchronous boundary revalidates the caller's cleanup generation.
  // Serial imports avoid one all-family import burst on the Settings gesture.
  for (const load of soundOwners) {
    if (!isCurrent()) return;
    try {
      const stops = await load();
      for (const stop of stops) {
        if (!isCurrent()) return;
        try { stop(); } catch { /* Continue retiring independent sound families. */ }
      }
    } catch { /* A failed owner import cannot strand the remaining families. */ }
  }
}
