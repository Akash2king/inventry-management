'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const mode = process.argv[2];

if (mode !== 'dev' && mode !== 'build') {
  console.error('Usage: node scripts/run-tauri.js <dev|build>');
  process.exit(1);
}

if (process.platform === 'win32') {
  const ps1 = path.join(__dirname, 'build-with-msvc.ps1');
  const ps = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, mode],
    { cwd: root, stdio: 'inherit', env: process.env }
  );
  process.exit(ps.status === null ? 1 : ps.status);
}

const tauriJs = path.join(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
const result = spawnSync(process.execPath, [tauriJs, mode], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status === null ? 1 : result.status);
