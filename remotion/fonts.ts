import { loadFont as loadInstrumentSerif } from '@remotion/google-fonts/InstrumentSerif';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';

const instrumentSerif = loadInstrumentSerif();
const inter = loadInter('normal', { weights: ['400', '700'] });

export async function ensureFontsLoaded(): Promise<void> {
  await Promise.all([instrumentSerif.waitUntilDone(), inter.waitUntilDone()]);
}
