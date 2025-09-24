// public/src/modules/board-fail-modal.js
// Game-over overlay when the board isn't fully cleared

const HEADLINES = [
  'Oops!', 'Bummer!', 'Ahh Noo!', 'Almost!', 'So Close!', 'Whoops!', 'Uh Oh!',
  'Missed It!', 'Darn!', 'Not Quite!', 'Retry Time!', 'Oh Snap!', 'Melted down!',
  'Ouch!', 'Fail!', 'Next Try!', 'Argh!', 'No Luck!', 'Oof!', 'Nearly!',
  'Shoot!', 'Try Again!', 'Whoa There!', 'Not Today!', 'Gah!', 'So Near!',
  'Drat!', 'Aw Man!', 'Dang!', 'One More!', 'That Hurt!'
];

const SUBHEADS = [
  'Board not cleared',
  'You didn’t clear the board',
  'Board remains uncleared',
  'Board still has tiles',
  'The board wasn’t cleaned',
  'Level failed – board not cleared',
  'Board incomplete',
  'Clear the board to advance'
];

const OVERLAY_ID = 'cc-board-fail-overlay';

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)] || list[0];
}

function removeExisting() {
  try {
    const prev = document.getElementById(OVERLAY_ID);
    prev?.remove?.();
  } catch {}
}

export function showBoardFailModal() {
  return new Promise(resolve => {
    removeExisting();

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'padding:48px 24px',
      'background:#f5f5f5',
      'z-index:10000000000000',
      'opacity:0',
      'transition:opacity 0.25s ease'
    ].join(';');

    const content = document.createElement('div');
    content.style.cssText = [
      'width:min(360px, 88vw)',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'text-align:center',
      'font-family:"LTCrow", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      'color:#A07662',
      'transform:translateY(24px)',
      'opacity:0',
      'transition:transform 0.55s cubic-bezier(0.65,-0.55,0.28,1.45), opacity 0.4s ease'
    ].join(';');

    const heroWrap = document.createElement('div');
    heroWrap.style.cssText = 'width:100%;display:flex;justify-content:center;margin:0 0 24px 0;';
    const hero = document.createElement('img');
    hero.src = './assets/melted-dice.png';
    hero.alt = 'Melted dice';
    hero.style.cssText = 'width:min(240px,72vw);height:auto;display:block;';
    hero.onerror = () => {
      hero.remove();
      const fallback = document.createElement('div');
      fallback.style.cssText = 'width:160px;height:160px;border-radius:32px;background:rgba(215,122,83,0.25);';
      heroWrap.appendChild(fallback);
    };
    heroWrap.appendChild(hero);

    const title = document.createElement('div');
    title.textContent = pickRandom(HEADLINES);
    title.style.cssText = 'font-weight:800;font-size:40px;line-height:1;margin:0 0 12px 0;color:#D78157;';

    const subtitle = document.createElement('div');
    subtitle.textContent = pickRandom(SUBHEADS);
    subtitle.style.cssText = 'font-weight:500;font-size:20px;line-height:1.3;margin:0 0 32px 0;color:#A47C67;';

    const buttons = document.createElement('div');
    buttons.style.cssText = 'width:249px;max-width:80vw;display:flex;flex-direction:column;gap:24px;';

    const playAgain = document.createElement('button');
    playAgain.type = 'button';
    playAgain.textContent = 'Play again';
    playAgain.className = 'squishy squishy-cc';
    playAgain.style.width = '100%';
    playAgain.style.maxWidth = '100%';
    playAgain.style.whiteSpace = 'nowrap';

    const exitBtn = document.createElement('button');
    exitBtn.type = 'button';
    exitBtn.textContent = 'Exit to menu';
    exitBtn.className = 'squishy squishy-white';
    exitBtn.style.width = '100%';
    exitBtn.style.maxWidth = '100%';
    exitBtn.style.whiteSpace = 'nowrap';

    buttons.appendChild(playAgain);
    buttons.appendChild(exitBtn);

    content.appendChild(heroWrap);
    content.appendChild(title);
    content.appendChild(subtitle);
    content.appendChild(buttons);

    overlay.appendChild(content);
    document.body.appendChild(overlay);

    const resolveAndCleanup = (action) => {
      try { window.removeEventListener('keydown', onKey); } catch {}
      overlay.style.opacity = '0';
      content.style.transform = 'translateY(18px)';
      content.style.opacity = '0';
      setTimeout(() => { try { overlay.remove(); } catch {}; resolve({ action }); }, 220);
    };

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        resolveAndCleanup('menu');
      }
    };
    window.addEventListener('keydown', onKey);

    playAgain.addEventListener('click', () => resolveAndCleanup('retry'));
    exitBtn.addEventListener('click', () => resolveAndCleanup('menu'));

    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      requestAnimationFrame(() => {
        content.style.opacity = '1';
        content.style.transform = 'translateY(0)';
      });
    });
  });
}
