// public/src/shimmer-cta.js
// One-off CTA shimmer with randomized interval (4–8s)

function rand(min, max){ return min + Math.random() * (max - min); }

function scheduleShimmer(el){
  if (!el) return;
  const runOnce = () => {
    el.classList.add('shimmer-run');
    // remove after animation duration (6s) to allow re-trigger
    setTimeout(() => { el.classList.remove('shimmer-run'); }, 6100);
    // schedule next between 4–8s after finishing
    const nextIn = rand(4000, 8000);
    el._shimmerTimer = setTimeout(runOnce, nextIn);
  };

  const firstIn = rand(4000, 8000);
  el._shimmerTimer = setTimeout(runOnce, firstIn);
}

function clearShimmer(el){ try { clearTimeout(el?._shimmerTimer); } catch {} }

export function initCtaShimmer(){
  const buttons = Array.from(document.querySelectorAll('.squishy-cc'));
  buttons.forEach(scheduleShimmer);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden){ buttons.forEach(clearShimmer); }
    else { buttons.forEach(scheduleShimmer); }
  });
}

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', () => initCtaShimmer(), { once: true });
} else {
  initCtaShimmer();
}

