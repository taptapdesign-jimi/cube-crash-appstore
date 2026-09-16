import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/ui-manager.ts'), 'utf8');

test('Home Play and Arcade starts protect an older Journey completion before clearing its receipt', () => {
  const boundaries = [
    'private async handlePlayClick(event: Event)',
    'async startNewGame(): Promise<void>',
    'async startNewGameWithSavedState(): Promise<void>',
  ];
  for (const boundary of boundaries) {
    const section = source.split(boundary)[1];
    expect(section).toBeDefined();
    const migration = section!.indexOf('migrateJourneyCompletionReceiptBeforeClear();');
    const receiptClear = section!.indexOf("localStorage.removeItem('cc_board_completed');");
    expect(migration).toBeGreaterThanOrEqual(0);
    expect(receiptClear).toBeGreaterThan(migration);
  }
});
