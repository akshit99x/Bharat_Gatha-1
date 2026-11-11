/**
 * A synthetic room, so nothing has to be downloaded: exponentially decaying
 * noise, a little darker in the tail, makes a convincing stone hall or temple
 * courtyard. One convolver is shared by the whole score; each voice sends a
 * different amount to it.
 */
export function buildImpulse(ctx: BaseAudioContext, seconds = 2.8, decay = 3.2): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // The tail gets duller as it decays: high frequencies die first in a real room.
      const k = 0.12 + (1 - t) * 0.55;
      lp += k * ((Math.random() * 2 - 1) - lp);
      data[i] = lp * Math.pow(1 - t, decay) * (ch === 0 ? 1 : 0.94);
    }
  }
  return buf;
}
