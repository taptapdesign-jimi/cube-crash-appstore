type PopInRunnerDeps = {
  tiles: any[];
  sweetPopIn: (tiles: any[], opts: { onHalf?: () => void }) => Promise<any> | any;
  onHalf: () => void;
  devLog: (...args: any[]) => void;
};

export function createSweetPopInRunner({
  tiles,
  sweetPopIn,
  onHalf,
  devLog,
}: PopInRunnerDeps){
  return () => {
    devLog('🎯 Starting sweetPopIn from app.js with', tiles.length, 'tiles');
    return sweetPopIn(tiles, { onHalf });
  };
}
