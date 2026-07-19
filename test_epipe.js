const { spawn } = require('child_process');
const piper = spawn('yes', [], { stdio: ['ignore', 'pipe', 'ignore'] });
const aplay = spawn('sleep', ['10'], { stdio: ['pipe', 'ignore', 'ignore'] });
piper.stdout.pipe(aplay.stdin);
setTimeout(() => {
  console.log('Killing aplay...');
  aplay.kill();
}, 100);
