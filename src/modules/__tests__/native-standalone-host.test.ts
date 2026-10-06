import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8');
const host = read('native/standalone/Stack to Six/GameViewController.swift');

describe('separate Native app delivery boundary', () => {
  it('uses an independent bundle and visible name', () => {
    const project = read('native/standalone/Stack to Six.xcodeproj/project.pbxproj');
    expect(project).toContain('PRODUCT_BUNDLE_IDENTIFIER = "com.taptapdesign.stacktosix.native";');
    expect(project).not.toContain('PRODUCT_BUNDLE_IDENTIFIER = "com.taptapdesign.stacktosix.Stack-to-Six";');
    expect(read('native/standalone/Info.plist')).toContain('<string>Stack to Six Native</string>');
  });
  it('enables native surfaces on ordinary icon launch, without Simulator flags', () => {
    const gate = host.match(/private static var jimiHomeHubEnabled: Bool \{([^}]+)\}/)?.[1];
    expect(gate).toContain('Bundle.main.bundleIdentifier == "com.taptapdesign.stacktosix.native"');
    expect(gate).not.toMatch(/SIMULATOR_UDID|arguments/);
    expect(host).not.toContain('--jimi-native-music');
    expect(host).toContain('userContentController.addScriptMessageHandler(music, contentWorld: .page, name: "jimiMusic")');
  });
  it('shares canonical Swift sources and retains bundled loading', () => {
    expect(read('native/standalone/Stack to Six.xcodeproj/project.pbxproj')).toContain('path = "../jimi-2026"');
    expect(host).toContain('private static let useDevServer = false');
    expect(read('.gitignore')).toContain('native/standalone/Stack to Six/Web.bundle/');
  });
});
