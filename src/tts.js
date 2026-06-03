import { VOICES, populateVoiceSelect } from "./voices.js";
import { TTS_MODELS } from "./models.js";

const SAMPLE_COUNT = 3;
const ELEVEN_V4_MODEL = "eleven_v4";

function prepareTtsText(text, modelId) {
  if (modelId !== ELEVEN_V4_MODEL) {
    return text;
  }
  return `[subtle Lancashire accent] ${text} [pause]`;
}

function showTtsError(el, msg) {
  if (!el) return;
  if (!msg) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = msg;
}

async function fetchTtsAudio(voiceId, text, modelId) {
  const synthesisText = prepareTtsText(text, modelId);
  const payload = { voice_id: voiceId, text: synthesisText, model_id: modelId };

  const useLocalProxy =
    import.meta.env.DEV && import.meta.env.VITE_DEV_USE_TOKEN_SERVER !== "false";

  if (useLocalProxy) {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let detail = await res.text();
      try {
        const j = JSON.parse(detail);
        detail = j.error || j.detail?.map((d) => d.msg).join("; ") || JSON.stringify(j);
      } catch {
        /* raw text */
      }
      throw new Error(detail || `TTS HTTP ${res.status}`);
    }
    return res.blob();
  }

  const apiKey = import.meta.env.VITE_XI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "TTS needs XI_API_KEY in .env for local dev, or VITE_XI_API_KEY when building for static hosting.",
    );
  }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({ text: synthesisText, model_id: modelId }),
  });

  if (!res.ok) {
    let detail = await res.text();
    try {
      const j = JSON.parse(detail);
      detail = j.detail?.map((d) => d.msg).join("; ") || JSON.stringify(j);
    } catch {
      /* raw text */
    }
    throw new Error(detail || `TTS HTTP ${res.status}`);
  }

  return res.blob();
}

function voiceLabelForId(voiceId) {
  return VOICES.find((v) => v.id === voiceId)?.label?.toLowerCase() || "voice";
}

function buildDownloadName(voiceId, index) {
  return `tilly-${voiceLabelForId(voiceId)}-sample-${index + 1}.mp3`;
}

function renderSampleCard(index, blob, voiceId, resultsEl) {
  const url = URL.createObjectURL(blob);
  const card = document.createElement("article");
  card.className = "tts-sample";

  const title = document.createElement("h3");
  title.className = "tts-sample-title";
  title.textContent = `Sample ${index + 1}`;

  const audio = document.createElement("audio");
  audio.controls = true;
  audio.src = url;
  audio.className = "tts-sample-audio";

  const download = document.createElement("a");
  download.href = url;
  download.download = buildDownloadName(voiceId, index);
  download.className = "btn btn-ghost tts-download";
  download.textContent = "Download";

  card.append(title, audio, download);
  resultsEl.appendChild(card);

  return () => URL.revokeObjectURL(url);
}

function clearResults(resultsEl) {
  resultsEl.querySelectorAll("audio").forEach((audio) => {
    if (audio.src.startsWith("blob:")) {
      URL.revokeObjectURL(audio.src);
    }
  });
  resultsEl.replaceChildren();
}

export function initTtsPanel() {
  const voiceSelect = document.getElementById("ttsVoiceSelect");
  const modelSelect = document.getElementById("ttsModelSelect");
  const textInput = document.getElementById("ttsText");
  const generateBtn = document.getElementById("ttsGenerateBtn");
  const errorBox = document.getElementById("ttsError");
  const resultsEl = document.getElementById("ttsResults");

  if (!voiceSelect || !modelSelect || !textInput || !generateBtn || !resultsEl) {
    return;
  }

  populateVoiceSelect(voiceSelect);
  for (const m of TTS_MODELS) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.label;
    modelSelect.appendChild(opt);
  }

  let revokeFns = [];

  generateBtn.addEventListener("click", async () => {
    const text = textInput.value.trim();
    const voiceId = voiceSelect.value;
    const modelId = modelSelect.value;

    showTtsError(errorBox, null);

    if (!text) {
      showTtsError(errorBox, "Enter some text to synthesise.");
      textInput.focus();
      return;
    }

    revokeFns.forEach((fn) => fn());
    revokeFns = [];
    clearResults(resultsEl);
    resultsEl.hidden = true;

    generateBtn.disabled = true;
    generateBtn.textContent = "Generating…";

    try {
      const blobs = await Promise.all(
        Array.from({ length: SAMPLE_COUNT }, () => fetchTtsAudio(voiceId, text, modelId)),
      );

      blobs.forEach((blob, i) => {
        revokeFns.push(renderSampleCard(i, blob, voiceId, resultsEl));
      });
      resultsEl.hidden = false;
    } catch (e) {
      console.error(e);
      showTtsError(errorBox, e instanceof Error ? e.message : String(e));
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = "Generate 3 samples";
    }
  });
}
