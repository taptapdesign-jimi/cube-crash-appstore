type LoadBootDeps = {
  app: any;
  board: any;
  backgroundLayer: any;
  setBackgroundLayer: (v: any) => void;
  layoutBoard: () => Promise<void>;
  initializeBackgroundLayer: () => void;
  boot: () => Promise<void>;
  devLog: (...args: any[]) => void;
};

export async function ensureAppReadyForLoad({
  app,
  board,
  backgroundLayer,
  setBackgroundLayer,
  layoutBoard,
  initializeBackgroundLayer,
  boot,
  devLog,
}: LoadBootDeps){
  devLog('🔍 LOAD CHECK: app exists?', !!app, 'board exists?', !!board);
  devLog('🔍 LOAD CHECK: backgroundLayer exists?', !!backgroundLayer);

  if (!app || !board) {
    devLog('⚠️ Game not booted, booting before applying saved state');
    await boot();
    devLog('✅ Boot completed, app:', !!app, 'board:', !!board);

    await layoutBoard();
    devLog('✅ Layout completed');

    initializeBackgroundLayer();
    devLog('✅ Background layer initialized for saved game');
    return;
  }

  devLog('✅ App already booted, checking canvas in DOM...');
  const host = document.getElementById('app');
  if (app.canvas && !app.canvas.parentElement) {
    devLog('⚠️ Canvas not in DOM, adding it back...');
    host.appendChild(app.canvas);
    devLog('✅ Canvas added back to DOM');
  }

  const bgInBoard = board.children.find((c: any) => c.label === 'BackgroundLayer');
  devLog('🔍 backgroundLayer in board.children?', !!bgInBoard);

  if (!backgroundLayer || !bgInBoard) {
    devLog('⚠️ backgroundLayer missing or not in board, reinitializing...');
    setBackgroundLayer(null);
    await layoutBoard();
    initializeBackgroundLayer();
    devLog('✅ Background layer reinitialized');
  }
}
