/**
 * Detailed (timestamped, speaker-labeled) call transcription.
 *
 * Why: plain-text Whisper output gives the analyzer no way to tell "hold music
 * for 3 minutes" from "agent and caller talked for 3 minutes" when the
 * transcript is patchy, which produced false "no live agent / on hold" verdicts.
 * Here we get segments with timestamps + speaker labels and compute hard facts
 * (speakers, turns, speech seconds) that the analyzer and guards rely on.
 *
 * Primary model: gpt-4o-transcribe-diarize (diarized_json). Fallback: whisper-1
 * verbose_json (timestamps, no speakers). Override with QA_TRANSCRIBE_MODEL.
 */

export interface TranscriptSegment {
  start: number;
  end: number;
  speaker: string | null;
  text: string;
}

export interface TranscriptMetrics {
  model: string;
  words: number;
  speakers: number;
  /** Number of speaker changes between consecutive segments (0 if unknown). */
  turns: number;
  /** Seconds covered by speech segments. */
  speechSeconds: number;
  /** Timestamp (s) of the last speech segment end. */
  lastSpeechAt: number;
  diarized: boolean;
}

export interface DetailedTranscript {
  /** Dialogue rendered as "[m:ss] A: text" lines (speaker omitted if unknown). */
  dialogue: string;
  text: string;
  segments: TranscriptSegment[];
  metrics: TranscriptMetrics;
}

const DIARIZE_MODEL = 'gpt-4o-transcribe-diarize';

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** OpenAI's transcription upload limit is 25 MB; stay under it. */
const MAX_UPLOAD = 24 * 1024 * 1024;

/**
 * Name/type the upload by its real format (TrackDrive sends MP3, CallGrid sends WAV).
 * A WAV over the upload limit is cut to its first ~24 MB (about 12 minutes at 16 kHz),
 * with the RIFF and data chunk sizes rewritten so the header stays valid.
 */
export function prepareAudio(audio: Buffer): { buf: Buffer; name: string; type: string } {
  const magic = audio.subarray(0, 4).toString('latin1');
  if (magic === 'RIFF' && audio.subarray(8, 12).toString('latin1') === 'WAVE') {
    let buf = audio;
    if (audio.length > MAX_UPLOAD) {
      let off = 12;
      while (off + 8 <= audio.length) {
        const id = audio.subarray(off, off + 4).toString('latin1');
        const size = audio.readUInt32LE(off + 4);
        if (id === 'data') {
          const keep = Math.max(0, MAX_UPLOAD - (off + 8)) & ~1;
          buf = Buffer.from(audio.subarray(0, off + 8 + keep));
          buf.writeUInt32LE(keep, off + 4);
          buf.writeUInt32LE(buf.length - 8, 4);
          break;
        }
        off += 8 + size + (size & 1);
      }
    }
    return { buf, name: 'call.wav', type: 'audio/wav' };
  }
  if (magic === 'OggS') return { buf: audio, name: 'call.ogg', type: 'audio/ogg' };
  return { buf: audio, name: 'call.mp3', type: 'audio/mpeg' };
}

async function callApi(
  audio: Buffer,
  apiKey: string,
  model: string,
): Promise<{ text: string; segments: TranscriptSegment[]; diarized: boolean }> {
  const diarize = model.includes('diarize');
  const file = prepareAudio(audio);
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(file.buf)], { type: file.type }), file.name);
  fd.append('model', model);
  fd.append('response_format', diarize ? 'diarized_json' : 'verbose_json');
  if (diarize) fd.append('chunking_strategy', 'auto');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Transcription ${model} failed (${res.status}): ${err.slice(0, 200)}`);
  }
  const j: any = await res.json();
  const segments: TranscriptSegment[] = (j.segments || [])
    // whisper verbose_json: drop segments the model itself thinks are not speech
    .filter((s: any) => (s.no_speech_prob ?? 0) < 0.6)
    .map((s: any) => ({
      start: Number(s.start) || 0,
      end: Number(s.end) || 0,
      speaker: s.speaker != null ? String(s.speaker) : null,
      text: String(s.text || '').trim(),
    }))
    .filter((s: TranscriptSegment) => s.text.length > 0);
  return { text: String(j.text || segments.map((s) => s.text).join(' ')), segments, diarized: diarize };
}

export function computeMetrics(
  segments: TranscriptSegment[],
  text: string,
  model: string,
  diarized: boolean,
): TranscriptMetrics {
  let turns = 0;
  for (let i = 1; i < segments.length; i++) {
    if (segments[i].speaker && segments[i].speaker !== segments[i - 1].speaker) turns++;
  }
  return {
    model,
    words: text.split(/\s+/).filter(Boolean).length,
    speakers: new Set(segments.map((s) => s.speaker).filter(Boolean)).size,
    turns,
    speechSeconds: Math.round(segments.reduce((sum, s) => sum + Math.max(0, s.end - s.start), 0)),
    lastSpeechAt: Math.round(segments.length ? segments[segments.length - 1].end : 0),
    diarized,
  };
}

export async function transcribeDetailed(audio: Buffer, apiKey: string): Promise<DetailedTranscript> {
  const preferred = process.env.QA_TRANSCRIBE_MODEL || DIARIZE_MODEL;
  let out: { text: string; segments: TranscriptSegment[]; diarized: boolean };
  let model = preferred;
  try {
    out = await callApi(audio, apiKey, preferred);
  } catch (err) {
    if (preferred === 'whisper-1') throw err;
    model = 'whisper-1';
    out = await callApi(audio, apiKey, model);
  }

  const dialogue = out.segments.length
    ? out.segments
        .map((s) => `[${fmtTime(s.start)}] ${s.speaker ? `Speaker ${s.speaker}: ` : ''}${s.text}`)
        .join('\n')
    : out.text;

  return {
    dialogue,
    text: out.text,
    segments: out.segments,
    metrics: computeMetrics(out.segments, out.text, model, out.diarized),
  };
}
