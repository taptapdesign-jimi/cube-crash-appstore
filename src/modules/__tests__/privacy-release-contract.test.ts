import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath: string): string => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('release privacy contract', () => {
  test('does not retain an optional analytics reporting surface', () => {
    expect(read('src/utils/error-boundary.ts')).not.toContain('gtag');
    expect(read('src/types/window.d.ts')).not.toContain('gtag');
  });

  test('keeps on-device motion disclosure and revocation copy aligned', () => {
    const policy = read('src/ui/components/privacy-policy-modal.ts');

    expect(policy).toContain('is not recorded or transmitted');
    expect(policy).toContain('Settings → 3D Motion');
    expect(policy).toContain('does not use accounts, advertising, analytics, or in-app purchases');
  });

  test('ships one deployable public policy and links it from the in-app policy', () => {
    const policy = read('src/ui/components/privacy-policy-modal.ts');
    const publicPolicy = read('release/stacktosix-privacy-policy/index.html');
    const expectedUrl = 'https://taptapdesign.com/stacktosix-privacy-policy/';

    expect(policy).toContain(`href="${expectedUrl}"`);
    expect(policy).toContain('target="_blank"');
    expect(policy).toContain('rel="noopener noreferrer"');
    expect(publicPolicy).toContain(`<link rel="canonical" href="${expectedUrl}">`);
    expect(publicPolicy).toContain(`img-src 'self'`);
    expect(publicPolicy).toContain('src="images/stack-to-six-logo.png"');
    expect(publicPolicy).toContain('width: min(50%, 195px);');
    expect(publicPolicy).not.toContain('class="game-mark"');
    expect(publicPolicy).toContain('does not collect, transmit, sell, rent, or');
    expect(publicPolicy).toContain('independently designed and developed by Igor Jimi Ivankovic');
    expect(publicPolicy).not.toContain('Pojatno');
    expect(publicPolicy).toContain('Settings → 3D Motion');
    expect(publicPolicy).toContain('does not integrate Apple Game Center');
    expect(publicPolicy).toContain('mailto:stacktosix@gmail.com');
    expect(publicPolicy).not.toContain('info@igorivankovic.com');
    expect(publicPolicy).toContain('href="support.html"');
    expect(publicPolicy).toMatch(/<div class="contact-links">\s*<a href="mailto:stacktosix@gmail\.com">[\s\S]*?<a href="support\.html">/);
    expect(publicPolicy).not.toContain('<script');
    expect(fs.existsSync(path.join(root, 'release/stacktosix-privacy-policy/images/stack-to-six-logo.png'))).toBe(true);
  });

  test('ships a dedicated App Store support page with direct contact information', () => {
    const support = read('release/stacktosix-privacy-policy/support.html');
    const supportUrl = 'https://taptapdesign.com/stacktosix-privacy-policy/support.html';

    expect(support).toContain(`<link rel="canonical" href="${supportUrl}">`);
    expect(support).toContain('mailto:stacktosix@gmail.com');
    expect(support).not.toContain('info@igorivankovic.com');
    expect(support).toContain('href="index.html"');
    expect(support).toContain('src="images/stack-to-six-logo.png"');
    expect(support).toContain(`img-src 'self'`);
    expect(support).not.toContain('<script');
    expect(fs.existsSync(path.join(root, 'release/stacktosix-privacy-policy/images/stack-to-six-logo.png'))).toBe(true);
  });
});
