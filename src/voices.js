/**
 * ElevenLabs voice_id values for the dropdown (Tilly Norwood PVC1, PVC2, PVC4, PVC5).
 */
const IDS = [
  "8PFKHwg70zjSRTfDg4hk",
  "7hDCGMwLtzZG6Zh6ZUVC",
  "vRtxFKWJzHlaYdQSyUqs",
  "Q9404EUgtN8QOJHJpDnw",
];

const LABELS = ["PVC1", "PVC2", "PVC4", "PVC5"];

export const VOICES = IDS.map((id, i) => ({ id, label: LABELS[i] }));

export function populateVoiceSelect(selectEl) {
  for (const v of VOICES) {
    const opt = document.createElement("option");
    opt.value = v.id;
    opt.textContent = v.label;
    selectEl.appendChild(opt);
  }
}
