const ACTIVE_CLASS = 'shimmer-run';
const MIN_DELAY = 5000;
const MAX_DELAY = 7000;
const ANIMATION_DURATION = 2400; // matches CSS animation length in ms

function clearTimers(store) {
  if (!store) return;
  if (store.start) {
    clearTimeout(store.start);
    store.start = null;
  }
  if (store.end) {
    clearTimeout(store.end);
    store.end = null;
  }
}

function schedule(icon) {
  const store = icon.__menuIconShimmer || (icon.__menuIconShimmer = {});
  const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);

  store.start = setTimeout(() => {
    icon.classList.add(ACTIVE_CLASS);

    store.end = setTimeout(() => {
      icon.classList.remove(ACTIVE_CLASS);
      schedule(icon);
    }, ANIMATION_DURATION);
  }, delay);
}

export function startMenuIconShimmer(icon) {
  if (!icon || typeof icon !== 'object') return;

  stopMenuIconShimmer(icon);
  schedule(icon);
}

export function stopMenuIconShimmer(icon) {
  if (!icon || typeof icon !== 'object') return;

  const store = icon.__menuIconShimmer;
  clearTimers(store);
  icon.classList.remove(ACTIVE_CLASS);
}

export function stopAllMenuIconShimmers(icons) {
  if (!icons) return;
  icons.forEach((icon) => stopMenuIconShimmer(icon));
}
