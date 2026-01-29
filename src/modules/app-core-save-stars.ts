type SaveStarsDeps = {
  StarsCollector: { getStarsCount?: () => number };
  devLog: (...args: any[]) => void;
  devWarn: (...args: any[]) => void;
};

export function getStarsCountForSave({
  StarsCollector,
  devLog,
  devWarn,
}: SaveStarsDeps){
  // 🔥 CRITICAL FIX: Get stars count from stars collector before saving
  let savedStarsCount = 0;
  try {
    if (typeof StarsCollector.getStarsCount === 'function') {
      savedStarsCount = StarsCollector.getStarsCount();
      devLog('💾 Saving stars count:', savedStarsCount);
    } else {
      devWarn('⚠️ StarsCollector.getStarsCount not available, defaulting to 0');
    }
  } catch (error) {
    devWarn('⚠️ Failed to get stars count for save:', error);
  }
  return savedStarsCount;
}
