import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const NATIVE_BUNDLE_ID = 'com.taptapdesign.stacktosix.native';
const projectRelative = 'native/standalone/Stack to Six.xcodeproj';

/** Read-only active-target audit. The preserved PWA is a separate product. */
export function auditNativeSource({ project, scheme, storyboard, controller, info, privacy }) {
  const failures = [], require = (ok, message) => { if (!ok) failures.push(message); };
  const objects = project?.objects ?? {}, root = objects[project?.rootObject];
  const apps = (root?.targets ?? []).filter(id => objects[id]?.productType === 'com.apple.product-type.application');
  require(apps.length === 1, 'Native project must have exactly one application target');
  const appID = apps[0], app = objects[appID];
  const configurations = (objects[app?.buildConfigurationList]?.buildConfigurations ?? []).map(id => objects[id]);
  const projectConfigurations = (objects[root?.buildConfigurationList]?.buildConfigurations ?? []).map(id => objects[id]);
  for (const name of ['Debug', 'Release']) {
    const settings = configurations.find(c => c?.name === name)?.buildSettings;
    const defaults = projectConfigurations.find(c => c?.name === name)?.buildSettings ?? {};
    require(settings?.PRODUCT_BUNDLE_IDENTIFIER === NATIVE_BUNDLE_ID, `${name} must use ${NATIVE_BUNDLE_ID}`);
    require(settings?.INFOPLIST_FILE === 'Info.plist', `${name} must use the standalone Info.plist`);
    require(String(settings?.TARGETED_DEVICE_FAMILY) === '1,2', `${name} must retain iPhone/iPad support`);
    require(Number(settings?.IPHONEOS_DEPLOYMENT_TARGET ?? defaults.IPHONEOS_DEPLOYMENT_TARGET) >= 17, `${name} minimum iOS must be at least 17`);
  }
  const groups = (app?.fileSystemSynchronizedGroups ?? []).map(id => objects[id]);
  const main = groups.find(g => g?.path === 'Stack to Six');
  const excluded = (main?.exceptions ?? []).flatMap(id => {
    const exception = objects[id];
    return exception?.target === appID ? exception.membershipExceptions ?? [] : [];
  });
  require(excluded.includes('GameViewController.swift') && excluded.includes('Web.bundle'), 'Archived web controller and Web.bundle must be excluded from the app target');
  require(groups.some(g => g?.path === '../gameplay-app'), 'Native app composition must belong to the application target');
  require(scheme.includes(`BlueprintIdentifier = "${appID}"`), 'Shared scheme must build the actual Native application target');
  const initialID = storyboard.match(/initialViewController="([^"]+)"/)?.[1];
  const initial = [...storyboard.matchAll(/<viewController\b[^>]*>/g)].find(m => m[0].includes(`id="${initialID}"`))?.[0];
  require(initial?.includes('customClass="NativeStandaloneViewController"'), 'Storyboard initial controller must be NativeStandaloneViewController');
  require(controller.includes('NativeBootstrap(') && controller.includes('owner.start(in:self)'), 'Native root must launch the actual Native bootstrap');
  require(controller.includes('forResource:"NativeAssets"'), 'Native root must load NativeAssets.bundle');
  require(!/\bimport\s+(WebKit|JavaScriptCore)\b|\bWKWebView\b|Web\.bundle/.test(controller), 'Native root must not boot a web runtime');
  require(info?.CFBundleDisplayName === 'Stack to Six', 'Standalone display name must remain Stack to Six');
  require(info?.UIMainStoryboardFile === 'Main', 'Standalone app must use its Main storyboard');
  require(info?.ITSAppUsesNonExemptEncryption === false && info?.UIRequiresFullScreen === true, 'Standalone encryption/full-screen declarations must be retained');
  require(info?.UISupportedInterfaceOrientations?.length === 1 && info.UISupportedInterfaceOrientations[0] === 'UIInterfaceOrientationPortrait', 'Native app must retain portrait-only orientation');
  require(info?.NSAppTransportSecurity?.NSAllowsArbitraryLoadsInWebContent !== true, 'Native plist must not allow arbitrary web loads');
  require(privacy?.NSPrivacyTracking === false, 'Native privacy manifest must declare no tracking');
  return failures;
}

export function auditNativeDependencies(output) {
  return /(?:\/|\b)(?:WebKit|JavaScriptCore)\.framework\/|libswift(?:WebKit|JavaScriptCore)\.dylib/.test(output)
    ? ['Native app binary links WebKit or JavaScriptCore'] : [];
}

function readPlist(file) {
  const result = spawnSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', file], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Cannot read plist ${file}: ${result.stderr.trim()}`);
  return JSON.parse(result.stdout);
}
function filesIn(directory, base = directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === '.DS_Store') return [];
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(full, base) : [path.relative(base, full)];
  });
}
function auditAssets(root, bundle) {
  const originals = filesIn(path.join(root, 'assets'));
  if (!originals.length) return ['Original assets directory is empty'];
  const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const missing = [], changed = [];
  for (const relative of originals) {
    const destination = path.join(bundle, 'assets', relative);
    if (!fs.existsSync(destination)) missing.push(relative);
    else if (hash(path.join(root, 'assets', relative)) !== hash(destination)) changed.push(relative);
  }
  return [missing.length && `NativeAssets.bundle is missing ${missing.length} originals; first: ${missing[0]}`,
    changed.length && `NativeAssets.bundle differs from ${changed.length} originals; first: ${changed[0]}`].filter(Boolean);
}

export function runNativeAudit(root, args) {
  const allowed = new Set(['--source-only', '--built-app']);
  for (let i = 0; i < args.length; i++) {
    if (!allowed.has(args[i])) throw new Error(`Unknown argument: ${args[i]}`);
    if (args[i] === '--built-app' && (!args[++i] || args[i].startsWith('--'))) throw new Error('--built-app requires an app path');
  }
  const standalone = path.join(root, 'native/standalone');
  const project = path.join(root, projectRelative);
  const packageText = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
  const postbuild = fs.readFileSync(path.join(root, 'scripts/postbuild.mjs'), 'utf8');
  const failures = auditNativeSource({
    project: readPlist(path.join(project, 'project.pbxproj')),
    scheme: fs.readFileSync(path.join(project, 'xcshareddata/xcschemes/Stack to Six.xcscheme'), 'utf8'),
    storyboard: fs.readFileSync(path.join(standalone, 'Stack to Six/Base.lproj/Main.storyboard'), 'utf8'),
    controller: fs.readFileSync(path.join(root, 'native/gameplay-app/NativeStandaloneViewController.swift'), 'utf8'),
    info: readPlist(path.join(standalone, 'Info.plist')),
    privacy: readPlist(path.join(standalone, 'Stack to Six/PrivacyInfo.xcprivacy')),
  });
  if (/npx cap sync ios|CAPACITOR_USE_DEV_SERVER|"ios:(?:sync|build)/.test(packageText)) failures.push('Generic legacy Capacitor iOS commands must remain disabled');
  if (postbuild.includes('Kockice Crash')) failures.push('Postbuild contains a forbidden legacy Kockice Crash path');
  if (!postbuild.includes("process.env.SKIP_NATIVE_BUNDLE_SYNC === 'true'")) failures.push('Transitional build must retain SKIP_NATIVE_BUNDLE_SYNC=true protection');
  // Refuse wrong target identity before inspecting any optional built package.
  if (failures.length) return failures;
  const builtIndex = args.indexOf('--built-app');
  if (builtIndex >= 0) {
    const app = path.resolve(args[builtIndex + 1]), info = readPlist(path.join(app, 'Info.plist'));
    if (info.CFBundleIdentifier !== NATIVE_BUNDLE_ID) return [`Built app must use ${NATIVE_BUNDLE_ID}`];
    if (fs.existsSync(path.join(app, 'Web.bundle')) || fs.existsSync(path.join(app, 'index.html'))) failures.push('Native app packages a web entry');
    const executable = info.CFBundleExecutable;
    if (typeof executable !== 'string' || !executable || path.basename(executable) !== executable) return ['Built app executable name is invalid'];
    const binaries = [path.join(app, executable), ...fs.readdirSync(app).filter(name => name.endsWith('.dylib')).map(name => path.join(app, name))];
    const frameworks = path.join(app, 'Frameworks');
    if (fs.existsSync(frameworks)) {
      for (const name of fs.readdirSync(frameworks)) {
        if (name.endsWith('.framework')) binaries.push(path.join(frameworks, name, name.slice(0, -10)));
        else if (name.endsWith('.dylib')) binaries.push(path.join(frameworks, name));
      }
    }
    for (const binary of binaries) {
      const result = spawnSync('/usr/bin/otool', ['-L', binary], { encoding: 'utf8' });
      if (result.status !== 0) failures.push(`Cannot inspect Native binary: ${binary}`);
      else failures.push(...auditNativeDependencies(result.stdout));
    }
    if (!fs.existsSync(path.join(app, 'PrivacyInfo.xcprivacy'))) failures.push('Built Native privacy manifest is missing');
    failures.push(...auditAssets(root, path.join(app, 'NativeAssets.bundle')));
  } else if (!args.includes('--source-only')) {
    failures.push(...auditAssets(root, path.join(standalone, 'Stack to Six/NativeAssets.bundle')));
  }
  return failures;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const failures = runNativeAudit(process.cwd(), process.argv.slice(2));
    if (failures.length) {
      failures.forEach(message => console.error(`FAIL  ${message}`));
      process.exitCode = 1;
    } else {
      console.log(`PASS: active Native target ${NATIVE_BUNDLE_ID}; no PWA sync prerequisite.`);
      const args=process.argv.slice(2);
      const scope=args.includes('--built-app') ? 'compiled target, packaged assets and dependencies'
        : args.includes('--source-only') ? 'source target/root/membership' : 'source target/root/membership and original asset bytes';
      console.log(`Scope: ${scope}; Source parity and physical acceptance remain separate.`);
    }
  } catch (error) {
    console.error(`FAIL  ${error.message}`);process.exitCode = 1;
  }
}
