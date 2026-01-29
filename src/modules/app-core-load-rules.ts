type LoadRulesDeps = {
  boardNumber: number;
  syncSharedState: () => void;
  boardSpecificRules: { setCurrentBoard?: (n: number) => void };
  drawBoardBG: (mode: string) => void;
  devLog: (...args: any[]) => void;
};

export function applyRulesAfterLoad({
  boardNumber,
  syncSharedState,
  boardSpecificRules,
  drawBoardBG,
  devLog,
}: LoadRulesDeps){
  // Sync state BEFORE updating HUD to ensure boardNumber is set correctly
  syncSharedState();
  
  // Update board-specific rules with the restored board number
  if (typeof boardSpecificRules !== 'undefined' && boardSpecificRules.setCurrentBoard) {
    boardSpecificRules.setCurrentBoard(boardNumber);
    devLog('🎯 loadGameState: Set board-specific rules to board', boardNumber);
  }
  
  // Draw ghost placeholders BEFORE HUD update
  drawBoardBG('active+empty');
}
