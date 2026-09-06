const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const windows = process.platform === 'win32';
const defaultSdk = windows ? path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk')
  : process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Android', 'sdk')
    : path.join(os.homedir(), 'Android', 'Sdk');
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || defaultSdk;
const executable = path.join(sdk, 'emulator', windows ? 'emulator.exe' : 'emulator');

if (!existsSync(executable)) {
  process.stderr.write(`Android Emulator not found: ${executable}\nSet ANDROID_HOME to your Android SDK directory.\n`);
  process.exit(1);
}

// Avoid storing multi-gigabyte RAM snapshots; leave Android user data intact.
const emulator = spawn(executable, ['-avd', process.argv[2] || 'Pixel', '-no-snapshot', '-memory', '3072'], { stdio: 'inherit' });
emulator.on('error', (error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
emulator.on('exit', (code) => { process.exitCode = code ?? 1; });
