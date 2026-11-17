'use strict';

const { execFileSync } = require('node:child_process');
const { mkdirSync } = require('node:fs');
const { join } = require('node:path');

execFileSync(process.platform === 'win32' ? 'cmd.exe' : 'npm',
  process.platform === 'win32' ? ['/d', '/s', '/c', 'npm.cmd run build'] : ['run', 'build'], {
  cwd: join(__dirname, '../../apps/api'), stdio: 'inherit',
});
// Empty static output: every public route must render through the guarded app.
mkdirSync(join(__dirname, 'static'), { recursive: true });
