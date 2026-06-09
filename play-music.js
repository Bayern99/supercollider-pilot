import { SclangController } from './dist/runtime/sclang.js';
import { discoverSclangPath } from './dist/runtime/discover.js';

async function main() {
  const sclangPath = discoverSclangPath();
  if (!sclangPath) {
    console.error('sclang not found');
    process.exit(1);
  }

  console.log(`Found sclang at: ${sclangPath}`);
  console.log('Booting sclang...');
  const controller = new SclangController(sclangPath);
  await controller.boot();
  console.log('sclang booted successfully!');

  const scCode = `
s.boot;
s.sync;

SynthDef(\\warmSaw, { |out = 0, freq = 440, amp = 0.2, gate = 1, release = 0.3|
  var env = EnvGen.kr(Env.asr(0.01, 1, release), gate, doneAction: 2);
  var sig = Saw.ar([freq, freq * 1.008]) * env * amp;
  sig = LPF.ar(sig, SinOsc.kr(1).range(freq * 1.5, freq * 4));
  sig = sig + CombN.ar(sig, 0.2, 0.2, 1.0, 0.2);
  Out.ar(out, sig);
}).add;

s.sync;

Pdef(\\arpeggio, Pbind(
  \\instrument, \\warmSaw,
  \\scale, Scale.majorPentatonic,
  \\degree, Pseq([0, 1, 2, 4, 5, 4, 2, 1, 7, 5, 4, 2], inf),
  \\octave, Pseq([5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6], inf),
  \\dur, 0.2,
  \\amp, 0.1,
  \\release, 0.4
)).play;
  `;

  console.log('Sending audio synthesis code to SuperCollider...');
  const result = await controller.execute(scCode);
  if (!result.success) {
    console.error('Execution failed:', result.output);
    await controller.stop();
    process.exit(1);
  }
  console.log('Execution result:', result);

  console.log('Playing sound for 10 seconds...');
  await new Promise((resolve) => setTimeout(resolve, 10000));

  console.log('Stopping sound and shutting down sclang...');
  await controller.stop();
  console.log('Shutdown completed. Done!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
