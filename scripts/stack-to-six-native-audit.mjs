import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const STACK_ROOT = '/Users/user/Stack to Six';
const PROJECT = path.join(STACK_ROOT, 'Stack to Six.xcodeproj');
const SCHEME = path.join(PROJECT, 'xcshareddata/xcschemes/Stack to Six.xcscheme');
const PBXPROJ = path.join(PROJECT, 'project.pbxproj');
const CONTROLLER = path.join(STACK_ROOT, 'Stack to Six/GameViewController.swift');
const INFO_PLIST = path.join(STACK_ROOT, 'Info.plist');
const PRIVACY_MANIFEST = path.join(STACK_ROOT, 'Stack to Six/PrivacyInfo.xcprivacy');
const WEB_BUNDLE = path.join(STACK_ROOT, 'Stack to Six/Web.bundle');
const EXPECTED_BUNDLE_ID = 'com.taptapdesign.stacktosix.Stack-to-Six';
const EXPECTED_INTRO_CHARACTERS = [
  'lik-board.png',
  'lik-game.png',
  'lik-gitara.png',
  'lik-kauc.png',
  'lik-klizanje.png',
  'lik-lajna.png',
  'lik-pas.png',
  'lik-vrt.png',
];
const sourceOnly = process.argv.includes('--source-only');
const builtAppIndex = process.argv.indexOf('--built-app');
const builtApp = builtAppIndex >= 0 ? process.argv[builtAppIndex + 1] : undefined;

const failures = [];
const needsSync = [];

function requireCondition(condition, message) {
  if (!condition) failures.push(message);
}

function hash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function walkFiles(directory, base = directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '.DS_Store') return [];
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(full, base) : [path.relative(base, full)];
  });
}

function verifyRawAssets(destination, label, { syncable = false } = {}) {
  const source = path.join(ROOT, 'assets');
  const sourceFiles = walkFiles(source);
  requireCondition(sourceFiles.length > 0, 'source assets directory is missing or empty');
  const missing = sourceFiles.filter((relative) => !fs.existsSync(path.join(destination, 'assets', relative)));
  const stale = sourceFiles.filter((relative) => {
    const destinationFile = path.join(destination, 'assets', relative);
    return fs.existsSync(destinationFile) && hash(path.join(source, relative)) !== hash(destinationFile);
  });
  const issues = [];
  if (missing.length) issues.push(`missing ${missing.length} raw asset(s), first: ${missing[0]}`);
  if (stale.length) issues.push(`contains ${stale.length} stale raw asset(s), first: ${stale[0]}`);
  if (!issues.length) return;
  const message = `${label} ${issues.join('; ')}`;
  (syncable ? needsSync : failures).push(message);
}

const packageJson = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8');
const postbuild = fs.readFileSync(path.join(ROOT, 'scripts/postbuild.mjs'), 'utf8');
requireCondition(postbuild.includes('/Users/user/Stack to Six/Stack to Six/Web.bundle'), 'postbuild does not target the authoritative Stack to Six Web.bundle');
requireCondition(!postbuild.includes('Kockice Crash'), 'postbuild contains the forbidden legacy Kockice Crash path');
requireCondition(!packageJson.includes('npx cap sync ios'), 'package scripts still expose unsafe generic Capacitor iOS sync');
requireCondition(!packageJson.includes('CAPACITOR_USE_DEV_SERVER'), 'package scripts still expose legacy Capacitor dev-server mode');
requireCondition(!packageJson.includes('"ios:sync'), 'package scripts still expose generic ios:sync commands');
requireCondition(!packageJson.includes('"ios:build'), 'package scripts still expose generic ios:build commands');

if (!sourceOnly) {
  requireCondition(fs.existsSync(PROJECT), `missing authoritative Xcode project: ${PROJECT}`);
  requireCondition(fs.existsSync(SCHEME), `missing shared Stack to Six scheme: ${SCHEME}`);
  requireCondition(fs.existsSync(PBXPROJ), `missing Xcode project file: ${PBXPROJ}`);
  requireCondition(fs.existsSync(CONTROLLER), `missing Stack to Six GameViewController: ${CONTROLLER}`);
  requireCondition(fs.existsSync(INFO_PLIST), `missing Stack to Six Info.plist: ${INFO_PLIST}`);
  requireCondition(fs.existsSync(PRIVACY_MANIFEST), `missing Stack to Six privacy manifest: ${PRIVACY_MANIFEST}`);

  if (fs.existsSync(PBXPROJ)) {
    const projectText = fs.readFileSync(PBXPROJ, 'utf8');
    const configuredBundleIds = [...projectText.matchAll(/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*([^;]+);/g)]
      .map((match) => match[1].trim().replace(/^"|"$/g, ''));
    const allowedBundleIds = new Set([
      EXPECTED_BUNDLE_ID,
      `${EXPECTED_BUNDLE_ID}Tests`,
      `${EXPECTED_BUNDLE_ID}UITests`,
    ]);
    requireCondition(configuredBundleIds.length > 0, 'Xcode project has no PRODUCT_BUNDLE_IDENTIFIER setting');
    requireCondition(configuredBundleIds.includes(EXPECTED_BUNDLE_ID), `Xcode app target must use ${EXPECTED_BUNDLE_ID}`);
    requireCondition(configuredBundleIds.every((bundleId) => allowedBundleIds.has(bundleId)), `Xcode project contains an unexpected bundle ID: ${[...new Set(configuredBundleIds)].join(', ')}`);
    const deploymentTargets = [...projectText.matchAll(/IPHONEOS_DEPLOYMENT_TARGET\s*=\s*([^;]+);/g)]
      .map((match) => match[1].trim());
    const deviceFamilies = [...projectText.matchAll(/TARGETED_DEVICE_FAMILY\s*=\s*([^;]+);/g)]
      .map((match) => match[1].trim().replace(/^"|"$/g, ''));
    const marketingVersions = [...projectText.matchAll(/MARKETING_VERSION\s*=\s*([^;]+);/g)]
      .map((match) => match[1].trim());
    requireCondition(deploymentTargets.length > 0 && deploymentTargets.every((target) => target === '17.0'), 'all explicit iOS deployment targets must be 17.0');
    requireCondition(deviceFamilies.length > 0 && deviceFamilies.every((family) => family === '1'), 'Stack to Six v1 must be iPhone-only (TARGETED_DEVICE_FAMILY = 1)');
    requireCondition(marketingVersions.length > 0 && marketingVersions.every((version) => version === '1.0'), 'Stack to Six v1 marketing version must remain 1.0');

    const appTarget = projectText.match(/([A-F0-9]{24}) \/\* Stack to Six \*\/ = \{\s*isa = PBXNativeTarget;[\s\S]*?productName = "Stack to Six";/);
    requireCondition(Boolean(appTarget), 'could not resolve the Stack to Six PBXNativeTarget');
    if (appTarget && fs.existsSync(SCHEME)) {
      const schemeText = fs.readFileSync(SCHEME, 'utf8');
      const appReferences = [...schemeText.matchAll(/<BuildableReference([\s\S]*?)<\/BuildableReference>/g)]
        .map((match) => match[1])
        .filter((reference) => /BlueprintName\s*=\s*"Stack to Six"/.test(reference));
      requireCondition(appReferences.length >= 3, 'shared scheme must reference the Stack to Six app for build, launch, and profile');
      requireCondition(appReferences.every((reference) => reference.includes(`BlueprintIdentifier = "${appTarget[1]}"`)), 'shared scheme app reference does not match the Stack to Six PBXNativeTarget');
      requireCondition(appReferences.every((reference) => /BuildableName\s*=\s*"Stack to Six\.app"/.test(reference)), 'shared scheme app product must be Stack to Six.app');
      requireCondition(appReferences.every((reference) => /ReferencedContainer\s*=\s*"container:Stack to Six\.xcodeproj"/.test(reference)), 'shared scheme must reference Stack to Six.xcodeproj');
    }
  }
  if (fs.existsSync(CONTROLLER)) {
    const controllerText = fs.readFileSync(CONTROLLER, 'utf8');
    requireCondition(/private static let useDevServer\s*=\s*false/.test(controllerText), 'GameViewController useDevServer must be false for bundled QA');
    requireCondition(controllerText.includes('return .portrait'), 'GameViewController must lock the iPhone-only v1 app to portrait');
    requireCondition(controllerText.includes('decidePolicyFor navigationAction'), 'GameViewController must enforce the native navigation allowlist');
    requireCondition(controllerText.includes('isTrustedGameURL'), 'GameViewController must recognize only the trusted bundled/dev game origin');
    requireCondition(controllerText.includes('UIApplication.shared.open'), 'GameViewController must open explicit external HTTPS links outside the game WebView');
  }
  if (fs.existsSync(INFO_PLIST)) {
    const infoText = fs.readFileSync(INFO_PLIST, 'utf8');
    requireCondition(!infoText.includes('NSAllowsArbitraryLoadsInWebContent'), 'Info.plist must not allow arbitrary network loads inside WKWebView');
    requireCondition(!infoText.includes('UISupportedInterfaceOrientations~ipad'), 'iPhone-only v1 must not declare an iPad orientation surface');
  }
  if (fs.existsSync(PRIVACY_MANIFEST)) {
    const privacyText = fs.readFileSync(PRIVACY_MANIFEST, 'utf8');
    requireCondition(privacyText.includes('NSPrivacyAccessedAPICategoryUserDefaults'), 'privacy manifest must declare UserDefaults required-reason API usage');
    requireCondition(privacyText.includes('<string>CA92.1</string>'), 'privacy manifest must declare app-only UserDefaults reason CA92.1');
    requireCondition(privacyText.includes('<key>NSPrivacyTracking</key>') && privacyText.includes('<false/>'), 'privacy manifest must explicitly disable tracking');
  }

  const distIndex = path.join(ROOT, 'dist/index.html');
  const bundleIndex = path.join(WEB_BUNDLE, 'index.html');
  requireCondition(fs.existsSync(distIndex), 'dist/index.html is missing; run npm run build first');
  requireCondition(fs.existsSync(bundleIndex), 'Stack to Six Web.bundle/index.html is missing');
  if (fs.existsSync(distIndex)) verifyRawAssets(path.join(ROOT, 'dist'), 'dist');
  if (fs.existsSync(bundleIndex)) verifyRawAssets(WEB_BUNDLE, 'Stack to Six Web.bundle', { syncable: true });
  if (fs.existsSync(distIndex) && fs.existsSync(bundleIndex) && hash(distIndex) !== hash(bundleIndex)) {
    needsSync.push('dist and Stack to Six Web.bundle differ; run the explicit approved Stack to Six bundle sync before building the app');
  }

  const introAssets = walkFiles(path.join(ROOT, 'assets/logo addons'));
  requireCondition(introAssets.includes('taplogo.png'), 'intro asset taplogo.png is missing');
  const missingIntroCharacters = EXPECTED_INTRO_CHARACTERS.filter((file) => !introAssets.includes(file));
  requireCondition(!missingIntroCharacters.length, `missing required intro character asset(s): ${missingIntroCharacters.join(', ')}`);
}

if (builtApp) {
  const infoPlist = path.join(builtApp, 'Info.plist');
  const builtPrivacyManifest = path.join(builtApp, 'PrivacyInfo.xcprivacy');
  requireCondition(fs.existsSync(infoPlist), `built app Info.plist is missing: ${infoPlist}`);
  if (fs.existsSync(infoPlist)) {
    const readPlist = (key) => spawnSync('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, infoPlist], { encoding: 'utf8' });
    const bundleId = readPlist('CFBundleIdentifier');
    const marketingVersion = readPlist('CFBundleShortVersionString');
    const minimumOS = readPlist('MinimumOSVersion');
    const deviceFamily = readPlist('UIDeviceFamily');
    const orientations = readPlist('UISupportedInterfaceOrientations');
    const arbitraryWebLoads = readPlist('NSAppTransportSecurity:NSAllowsArbitraryLoadsInWebContent');
    requireCondition(bundleId.status === 0 && bundleId.stdout.trim() === EXPECTED_BUNDLE_ID, `built app bundle ID is not ${EXPECTED_BUNDLE_ID}`);
    requireCondition(marketingVersion.status === 0 && marketingVersion.stdout.trim() === '1.0', 'built app marketing version is not 1.0');
    requireCondition(minimumOS.status === 0 && minimumOS.stdout.trim() === '17.0', 'built app minimum iOS version is not 17.0');
    requireCondition(deviceFamily.status === 0 && /\b1\b/.test(deviceFamily.stdout) && !/\b2\b/.test(deviceFamily.stdout), 'built app is not iPhone-only');
    requireCondition(orientations.status === 0 && orientations.stdout.includes('UIInterfaceOrientationPortrait') && !orientations.stdout.includes('Landscape'), 'built app is not portrait-only');
    requireCondition(arbitraryWebLoads.status !== 0, 'built app still allows arbitrary WKWebView network loads');
  }
  requireCondition(fs.existsSync(builtPrivacyManifest), `built app privacy manifest is missing: ${builtPrivacyManifest}`);
  verifyRawAssets(path.join(builtApp, 'Web.bundle'), 'built Stack to Six app');
}

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL  ${failure}`));
  console.error(`FAIL: ${failures.length} Stack to Six native safety check${failures.length === 1 ? '' : 's'} failed.`);
  process.exit(1);
}

if (needsSync.length) {
  needsSync.forEach((message) => console.warn(`NEEDS SYNC  ${message}`));
  process.exit(2);
}

console.log(sourceOnly
  ? 'PASS: native source guard targets only the authoritative Stack to Six shell.'
  : 'PASS: Stack to Six native project, bundle identity, assets, and bundle freshness are valid.');
