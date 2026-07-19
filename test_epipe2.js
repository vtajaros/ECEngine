const { spawn } = require('child_process');
const piper = spawn('yes', [], { stdio: ['ignore', 'pipe', 'ignore'] });
const aplay = spawn('sleep', ['10'], { stdio: ['pipe', 'ignore', 'ignore'] });
piper.stdout.pipe(aplay.stdin);
piper.stdout.on('error', () => {
  console.log('Caught EPIPE on piper.stdout!');
});
aplay.stdin.on('error', () => {
  console.log('Caught EPIPE on aplay.stdin!');
});
setTimeout(() => {
  console.log('Killing aplay...');
  aplay.kill();
}, 100);
setTimeout(() => {
  console.log('Exiting cleanly...');
  process.exit(0);
}, 200);
