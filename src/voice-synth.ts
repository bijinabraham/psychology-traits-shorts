import type { StructuredScript, SectionTiming, SectionKind } from './types.js';

interface SynthOptions {
  apiKey: string;
  voiceId: string;
}

interface SynthResult {
  audio_data_url: string; // data:audio/mpeg;base64,...
  timings: SectionTiming[];
}

interface ElevenLabsResponse {
  audio_base64: string;
  alignment: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  };
}

const MODEL_ID = 'eleven_turbo_v2_5';

async function synthOneSection(
  voiceText: string,
  apiKey: string,
  voiceId: string,
): Promise<ElevenLabsResponse> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: voiceText,
      model_id: MODEL_ID,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as ElevenLabsResponse;
}

function charsToWords(
  chars: string[],
  startsSec: number[],
  endsSec: number[],
  offsetMs: number,
): { word: string; start_ms: number; end_ms: number }[] {
  const out: { word: string; start_ms: number; end_ms: number }[] = [];
  let buf = '';
  let bufStart = 0;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (/\s/.test(c)) {
      if (buf) {
        out.push({
          word: buf,
          start_ms: Math.round(bufStart * 1000) + offsetMs,
          end_ms: Math.round(endsSec[i - 1] * 1000) + offsetMs,
        });
        buf = '';
      }
    } else {
      if (!buf) bufStart = startsSec[i];
      buf += c;
    }
  }
  if (buf) {
    out.push({
      word: buf,
      start_ms: Math.round(bufStart * 1000) + offsetMs,
      end_ms: Math.round(endsSec[endsSec.length - 1] * 1000) + offsetMs,
    });
  }
  return out;
}

export async function synthesizeScript(
  script: StructuredScript,
  opts: SynthOptions,
): Promise<SynthResult> {
  const audioBuffers: Buffer[] = [];
  const timings: SectionTiming[] = [];
  let cursorMs = 0;

  for (const section of script.sections) {
    const resp = await synthOneSection(section.voice, opts.apiKey, opts.voiceId);
    const audio = Buffer.from(resp.audio_base64, 'base64');
    audioBuffers.push(audio);

    const sectionDurationMs = Math.round(
      resp.alignment.character_end_times_seconds[
        resp.alignment.character_end_times_seconds.length - 1
      ] * 1000,
    );
    const words = charsToWords(
      resp.alignment.characters,
      resp.alignment.character_start_times_seconds,
      resp.alignment.character_end_times_seconds,
      cursorMs,
    );

    timings.push({
      kind: section.kind as SectionKind,
      start_ms: cursorMs,
      end_ms: cursorMs + sectionDurationMs,
      words,
    });
    cursorMs += sectionDurationMs;
  }

  const combined = Buffer.concat(audioBuffers);
  const audio_data_url = `data:audio/mpeg;base64,${combined.toString('base64')}`;

  return { audio_data_url, timings };
}
