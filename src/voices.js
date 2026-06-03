/**
 * ElevenLabs voice_id values for the agent and TTS (Tilly Norwood PVC1, PVC2, PVC4, PVC5).
 */
const IDS = [
  "8PFKHwg70zjSRTfDg4hk",
  "7hDCGMwLtzZG6Zh6ZUVC",
  "vRtxFKWJzHlaYdQSyUqs",
  "Q9404EUgtN8QOJHJpDnw",
];

const LABELS = ["PVC1", "PVC2", "PVC4", "PVC5"];

export const VOICES = IDS.map((id, i) => ({ id, label: LABELS[i] }));

/** TTS-only IVC voice (not PVC) — always listed in TTS; generation requires eleven_v4. */
export const TTS_PRE_VOICE = {
  id: "BnrUApbIYjABecF57E6V",
  label: "PRE",
};

export function populateVoiceSelect(selectEl) {
  for (const v of VOICES) {
    const opt = document.createElement("option");
    opt.value = v.id;
    opt.textContent = v.label;
    selectEl.appendChild(opt);
  }
}

export function populateTtsVoiceSelect(selectEl) {
  const previous = selectEl.value;
  selectEl.replaceChildren();

  for (const v of VOICES) {
    const opt = document.createElement("option");
    opt.value = v.id;
    opt.textContent = v.label;
    selectEl.appendChild(opt);
  }

  const preOpt = document.createElement("option");
  preOpt.value = TTS_PRE_VOICE.id;
  preOpt.textContent = TTS_PRE_VOICE.label;
  selectEl.appendChild(preOpt);

  const optionValues = [...selectEl.options].map((o) => o.value);
  if (optionValues.includes(previous)) {
    selectEl.value = previous;
  }
}

export function voiceLabelForId(voiceId) {
  if (voiceId === TTS_PRE_VOICE.id) {
    return TTS_PRE_VOICE.label.toLowerCase();
  }
  return VOICES.find((v) => v.id === voiceId)?.label?.toLowerCase() || "voice";
}
