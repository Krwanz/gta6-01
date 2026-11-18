// Synthesized sound only — WebAudio oscillators and filtered noise, no files.
export function createAudio() {
  let ctx = null, master = null, engineOsc = null, engineGain = null, sirenOn = false;
  let sirenOsc = null, sirenGain = null, sirenLfo = null;
  const audio = {
    ensure() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
        engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 50;
        engineGain = ctx.createGain(); engineGain.gain.value = 0; engineOsc.connect(engineGain);
        engineGain.connect(master); engineOsc.start();
      } catch (e) { ctx = null; }
    },
    engine(speed01, driving) {
      if (!ctx || !engineOsc) return;
      engineGain.gain.value = driving ? 0.05 + speed01 * 0.06 : 0;
      engineOsc.frequency.value = 48 + speed01 * 130;
    },
    setSiren(on) {
      if (!ctx) return;
      if (on === sirenOn) return;
      sirenOn = on;
      if (on) {
        sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 700;
        sirenLfo = ctx.createOscillator(); sirenLfo.type = 'sine'; sirenLfo.frequency.value = 0.6;
        const lfoGain = ctx.createGain(); lfoGain.gain.value = 280;
        sirenLfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
        sirenGain = ctx.createGain(); sirenGain.gain.value = 0.045;
        sirenOsc.connect(sirenGain); sirenGain.connect(master);
        sirenOsc.start(); sirenLfo.start();
      } else if (sirenOsc) {
        try { sirenOsc.stop(); sirenLfo.stop(); } catch (e) {}
        sirenOsc = null; sirenLfo = null;
      }
    },
    blip(freq, dur, type, vol) {
      if (!ctx) return;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (dur || 0.12));
      o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + (dur || 0.12));
    },
    noise(dur, vol, freq) {
      if (!ctx) return;
      const len = Math.floor(ctx.sampleRate * (dur || 0.15));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
      const g = ctx.createGain(); g.gain.value = vol || 0.25;
      src.connect(f); f.connect(g); g.connect(master); src.start();
    },
    shoot() { audio.noise(0.14, 0.3, 2400); audio.blip(180, 0.08, 'square', 0.12); },
    punch() { audio.noise(0.1, 0.3, 500); },
    crash() { audio.noise(0.25, 0.35, 700); },
    pickup() { audio.blip(660, 0.1, 'sine', 0.16); audio.blip(990, 0.16, 'sine', 0.16); },
    cash() { audio.blip(880, 0.09, 'triangle', 0.18); setTimeout(() => audio.blip(1320, 0.14, 'triangle', 0.18), 90); },
    wanted() { audio.blip(220, 0.2, 'square', 0.14); setTimeout(() => audio.blip(165, 0.3, 'square', 0.14), 140); },
    horn() { audio.blip(330, 0.18, 'square', 0.1); },
  };
  return audio;
}
