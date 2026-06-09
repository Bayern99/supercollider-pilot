import { SclangController } from './dist/runtime/sclang.js';
import { discoverSclangPath } from './dist/runtime/discover.js';
import { renderSession } from './dist/runtime/render.js';
import path from 'path';

const WARM_SAW_CODE = `
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
  \\dur, 0.25,
  \\amp, 0.12,
  \\release, 0.4
)).play;
`;

async function main() {
  const sclangPath = discoverSclangPath();
  if (!sclangPath) {
    console.error('sclang not found');
    process.exit(1);
  }

  const outputWav = path.join(process.cwd(), 'music.wav');
  console.log(`Recording output will be saved to: ${outputWav}`);

  const controller = new SclangController(sclangPath);
  const result = await renderSession(controller, {
    userCode: WARM_SAW_CODE,
    outPath: outputWav,
    durationSec: 10,
  });

  if (!result.success) {
    console.error('Render failed:', result.output);
    console.error(`WAV: ${result.outPath} (${result.bytes} bytes)`);
    process.exit(1);
  }

  console.log(`WAV: ${result.outPath} (${result.bytes} bytes)`);
  if (result.output.trim()) {
    console.log(result.output);
  }
  console.log('Done! Finished recording.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
