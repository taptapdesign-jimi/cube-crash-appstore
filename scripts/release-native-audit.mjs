#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const paths = {
  packageJson: path.join(root, 'package.json'),
  distIndex: path.join(root, 'dist', 'index.html'),
  iosPublicIndex: path.join(root, 'ios', 'App', 'App', 'public', 'index.html'),
  iosPublic: path.join(root, 'ios', 'App', 'App', 'public'),
  capacitorConfig: path.join(root, 'ios', 'App', 'App', 'capacitor.config.json'),
  infoPlist: path.join(root, 'ios', 'App', 'App', 'Info.plist'),
  xcodeProject: path.join(root, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj'),
  privacyManifest: path.join(root, 'ios', 'App', 'App', 'PrivacyInfo.xcprivacy'),
};

function read(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function walk(dir) {
  if (!exists(dir)) return [];

  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function relative(filePath) {
  return path.relative(root, filePath);
}

function extractBundleRefs(html) {
  const refs = new Set();
  const regex = /\b(?:src|href)="\.\/([^"]+\.(?:js|css|webmanifest|ico))"/g;
  let match;
  while ((match = regex.exec(html))) {
    refs.add(decodeURIComponent(match[1]));
  }
  return [...refs].sort();
}

function getPackageVersion() {
  try {
    return JSON.parse(read(paths.packageJson)).version || '';
  } catch {
    return '';
  }
}

function collectNativeBundleFindings() {
  const blockers = [];
  const warnings = [];

  for (const [label, filePath] of Object.entries(paths)) {
    if (label === 'privacyManifest') continue;
    if (!exists(filePath)) blockers.push(`${relative(filePath)} is missing`);
  }

  const capacitorRaw = read(paths.capacitorConfig);
  if (capacitorRaw) {
    try {
      const config = JSON.parse(capacitorRaw);
      if (config.server?.url) {
        blockers.push(`ios/App/App/capacitor.config.json still contains server.url (${config.server.url})`);
      }
      if (config.server?.cleartext === true) {
        blockers.push('ios/App/App/capacitor.config.json still enables server.cleartext');
      }
    } catch {
      blockers.push('ios/App/App/capacitor.config.json is not valid JSON');
    }
  }

  const distRefs = extractBundleRefs(read(paths.distIndex));
  const nativeRefs = extractBundleRefs(read(paths.iosPublicIndex));
  if (distRefs.length && nativeRefs.length && distRefs.join('\n') !== nativeRefs.join('\n')) {
    blockers.push('ios/App/App/public/index.html does not reference the same hashed bundle files as dist/index.html');
    warnings.push(`dist refs: ${distRefs.join(', ')}`);
    warnings.push(`native refs: ${nativeRefs.join(', ')}`);
  }

  const staleFiles = walk(paths.iosPublic)
    .map(relative)
    .filter((file) => /(?:hearts?|lives-manager)/i.test(file));
  for (const staleFile of staleFiles) {
    blockers.push(`stale removed feature file remains in native public bundle: ${staleFile}`);
  }

  const packageVersion = getPackageVersion();
  const projectText = read(paths.xcodeProject);
  const marketingVersions = [...projectText.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map((match) => match[1].trim());
  const buildVersions = [...projectText.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map((match) => match[1].trim());
  const bundleIds = [...projectText.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].map((match) => match[1].trim());

  if (!marketingVersions.length) {
    blockers.push('Xcode MARKETING_VERSION is missing');
  } else if (packageVersion && marketingVersions.some((version) => version !== packageVersion)) {
    blockers.push(`Xcode MARKETING_VERSION (${[...new Set(marketingVersions)].join(', ')}) does not match package.json (${packageVersion})`);
  }

  if (!buildVersions.length || buildVersions.some((version) => !/^\d+$/.test(version))) {
    blockers.push(`Xcode CURRENT_PROJECT_VERSION must be a numeric build number (${[...new Set(buildVersions)].join(', ') || 'missing'})`);
  }

  if (bundleIds.some((bundleId) => bundleId !== 'com.taptapdesign.cubecrash')) {
    blockers.push(`unexpected PRODUCT_BUNDLE_IDENTIFIER (${[...new Set(bundleIds)].join(', ')})`);
  }

  const infoPlist = read(paths.infoPlist);
  if (/<key>NSAllowsArbitraryLoads<\/key>\s*<true\/>/m.test(infoPlist)) {
    blockers.push('Info.plist enables NSAllowsArbitraryLoads=true');
  }
  if (!/<string>UIInterfaceOrientationPortrait<\/string>/.test(infoPlist)) {
    blockers.push('Info.plist must include portrait orientation support');
  }
  if (!/<key>UIRequiresFullScreen<\/key>\s*<true\/>/m.test(infoPlist)) {
    warnings.push('Info.plist does not require full screen');
  }

  if (!exists(paths.privacyManifest)) {
    warnings.push('ios/App/App/PrivacyInfo.xcprivacy is missing; confirm whether current Capacitor/plugins require a privacy manifest before App Store upload');
  }

  return { blockers, warnings };
}

function printList(title, rows) {
  console.log(`\n${title}: ${rows.length}`);
  for (const row of rows) {
    console.log(`  - ${row}`);
  }
}

const { blockers, warnings } = collectNativeBundleFindings();

console.log('=== Cube Crash Native Release Audit ===');
printList('BLOCKERS', blockers);
printList('WARNINGS', warnings);

if (blockers.length) {
  console.log('\nrelease-native-audit: FAIL');
  process.exitCode = 1;
} else {
  console.log('\nrelease-native-audit: PASS');
}
