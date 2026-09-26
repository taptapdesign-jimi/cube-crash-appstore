import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve(process.cwd(), 'src/modules/ui-manager.ts'), 'utf8');

test('every async UIManager gameplay reveal waits for its prepared entry commit', () => {
  const reveals = [...source.matchAll(/this\.showApp\(\);/g)];
  expect(reveals).toHaveLength(4);
  for (const reveal of reveals) {
    const continuation = source.slice((reveal.index ?? 0) + reveal[0].length).trimStart();
    expect(continuation.startsWith('await commitPreparedGameplayEntry();')).toBe(true);
  }

  // showApp remains the single host-visibility signal. Its fire-and-forget
  // call supports synchronous callers, while every async entry above owns and
  // awaits the same idempotent coordinator promise before clearing flags.
  expect(source).toContain('void commitPreparedGameplayEntry();');
});
