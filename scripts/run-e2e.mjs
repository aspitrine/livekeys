import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function fail(message) {
  console.error(message);
  process.exit(1);
}
if (process.platform !== 'darwin') fail('Local native E2E requires macOS and an iOS simulator. See docs/TESTING.md.');

const localJava = join(process.cwd(), '.tools/java/Contents/Home');
const env = { ...process.env };
if (!env.JAVA_HOME && existsSync(join(localJava, 'bin/java'))) env.JAVA_HOME = localJava;
const java = env.JAVA_HOME ? join(env.JAVA_HOME, 'bin/java') : 'java';
const javaCheck = spawnSync(java, ['-version'], { env, encoding: 'utf8' });
if (javaCheck.error || javaCheck.status !== 0) fail('Java 17+ is required for Maestro. See docs/TESTING.md.');
const javaVersion = /version "(\d+)/.exec(javaCheck.stderr);
if (!javaVersion || Number(javaVersion[1]) < 17) fail('Maestro requires Java 17 or newer.');

const candidates = [
  process.env.MAESTRO_BIN,
  join(process.cwd(), '.tools/maestro/bin/maestro'),
  join(homedir(), '.maestro/bin/maestro'),
].filter(Boolean);
const maestro = candidates.find((path) => existsSync(path)) ?? 'maestro';
const maestroCheck = spawnSync(maestro, ['--version'], { env, encoding: 'utf8' });
if (maestroCheck.error || maestroCheck.status !== 0) fail('Maestro is missing or cannot start. See docs/TESTING.md.');

const devices = spawnSync('xcrun', ['simctl', 'list', 'devices', 'booted', '--json'], {
  encoding: 'utf8',
  timeout: 20000,
});
if (devices.error || devices.status !== 0) fail('Cannot list iOS simulators. Start a simulator and rerun the check.');
const booted = Object.values(JSON.parse(devices.stdout).devices)
  .flat()
  .filter((device) => device.state === 'Booted' && device.isAvailable);
const device = env.MAESTRO_DEVICE_UDID
  ? booted.find((device) => device.udid === env.MAESTRO_DEVICE_UDID)
  : booted.length === 1
    ? booted[0]
    : undefined;
if (!device) fail('Select a booted iOS simulator with MAESTRO_DEVICE_UDID. Physical devices are deliberately refused.');

const app = spawnSync('xcrun', ['simctl', 'get_app_container', device.udid, 'net.eliakim.livekeys', 'app'], {
  encoding: 'utf8',
  timeout: 20000,
});
if (app.error || app.status !== 0) fail('Install a current LiveKeys simulator build first. See docs/TESTING.md.');

if (env.MAESTRO_APP_URL) {
  try {
    const serverUrl = new URL(env.MAESTRO_APP_URL).searchParams.get('url');
    if (!serverUrl) fail('MAESTRO_APP_URL must include the Metro server URL. See docs/TESTING.md.');
    const response = await fetch(new URL('/status', serverUrl), { signal: AbortSignal.timeout(5000) });
    if (!response.ok || (await response.text()) !== 'packager-status:running') throw new Error('Metro is not ready');
  } catch {
    fail('Metro is unreachable at the dev-client URL. Use the IPv4 loopback setup in docs/TESTING.md.');
  }
}

console.log(`Running E2E on simulator ${device.name}. Only its LiveKeys test data will be reset.`);
const result = spawnSync(
  maestro,
  [
    '--device',
    device.udid,
    'test',
    '--debug-output',
    '.maestro-results',
    '--format',
    'junit',
    '--output',
    '.maestro-results/results.xml',
    '-e',
    `MAESTRO_APP_URL=${env.MAESTRO_APP_URL ?? ''}`,
    '.maestro/flows',
  ],
  { env, stdio: 'inherit' },
);
if (result.error) fail(result.error.message);
process.exit(result.status ?? 1);
