import fs from 'node:fs';
import path from 'node:path';

describe('player-facing product identity', () => {
  const repositoryRoot = path.resolve(__dirname, '../..');

  it('publishes Stack to Six to WebKit and installed-web-app surfaces', () => {
    const index = fs.readFileSync(path.join(repositoryRoot, 'index.html'), 'utf8');
    const manifest = JSON.parse(
      fs.readFileSync(path.join(repositoryRoot, 'manifest.webmanifest'), 'utf8'),
    ) as { name?: string; short_name?: string };

    expect(index).toContain('<title>Stack to Six</title>');
    expect(index).not.toMatch(/<title>\s*Cube\s*Crash\s*<\/title>/i);
    expect(manifest.name).toBe('Stack to Six');
    expect(manifest.short_name).toBe('Stack to Six');
  });
});
