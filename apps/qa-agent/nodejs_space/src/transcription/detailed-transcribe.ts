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

async function callApi(
  audio: Buffer,
  apiKey: string,
  model: string,
): Promise<{ text: string; segments: TranscriptSegment[]; diarized: boolean }> {
  const diarize = model.includes('diarize');
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(audio)], { type: 'audio/mpeg' }), 'call.mp3');
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
