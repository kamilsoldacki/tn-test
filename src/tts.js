import { TTS_PRE_VOICE, VOICES, populateTtsVoiceSelect, voiceLabelForId } from "./voices.js";
import { TTS_MODELS } from "./models.js";

const SAMPLE_COUNT = 3;
const ELEVEN_V4_MODEL = "eleven_v4";
const TTS_OUTPUT_FORMAT = "mp3_44100_192";
const TTS_LANGUAGE_CODE = "en";
const TTS_PLACEHOLDER_DEFAULT =
  "Start typing here or paste any text you want to turn into lifelike speech...";
const TTS_PLACEHOLDER_V4 =
  "Type your text with audio tags like [laughs] to turn into expressive speech...";

function updateTtsPlaceholder(textInput, modelId) {
  textInput.placeholder =
    modelId === ELEVEN_V4_MODEL ? TTS_PLACEHOLDER_V4 : TTS_PLACEHOLDER_DEFAULT;
}

function updateTtsPanelForModel(textInput, modelId) {
  updateTtsPlaceholder(textInput, modelId);
  updateVoiceSettingsUi(modelId);
}

function onTtsVoiceChange(voiceSelect, modelSelect, textInput) {
  if (voiceSelect.value === TTS_PRE_VOICE.id) {
    modelSelect.value = ELEVEN_V4_MODEL;
  }
  updateTtsPanelForModel(textInput, modelSelect.value);
}

function onTtsModelChange(voiceSelect, modelSelect, textInput) {
  if (modelSelect.value !== ELEVEN_V4_MODEL && voiceSelect.value === TTS_PRE_VOICE.id) {
    voiceSelect.value = VOICES[0].id;
  }
  updateTtsPanelForModel(textInput, modelSelect.value);
}

function ensurePreUsesV4(voiceSelect, modelSelect, textInput) {
  if (voiceSelect.value === TTS_PRE_VOICE.id && modelSelect.value !== ELEVEN_V4_MODEL) {
    modelSelect.value = ELEVEN_V4_MODEL;
    updateTtsPanelForModel(textInput, modelSelect.value);
  }
}

function prepareTtsText(text, modelId, voiceId) {
  if (modelId !== ELEVEN_V4_MODEL) {
    return text;
  }
  if (voiceId === TTS_PRE_VOICE.id) {
    return `[subtle Lancashire accent] ${text} [pause]`;
  }
  return `${text} [pause]`;
}

function updateVoiceSettingsUi(modelId) {
  const isV4 = modelId === ELEVEN_V4_MODEL;
  const v4Panel = document.getElementById("ttsSettingsV4");
  const standardPanel = document.getElementById("ttsSettingsStandard");
  v4Panel?.classList.toggle("is-active", isV4);
  standardPanel?.classList.toggle("is-active", !isV4);
}

function readVoiceSettings(modelId) {
  if (modelId === ELEVEN_V4_MODEL) {
    return {
      stability: Number(document.getElementById("ttsV4Stability")?.value ?? 0.5),
      speed: Number(document.getElementById("ttsV4Speed")?.value ?? 1),
    };
  }

  return {
    stability: Number(document.getElementById("ttsStability")?.value ?? 0.5),
    similarity_boost: Number(document.getElementById("ttsSimilarity")?.value ?? 0.75),
    style: Number(document.getElementById("ttsStyle")?.value ?? 0),
    speed: Number(document.getElementById("ttsSpeed")?.value ?? 1),
    use_speaker_boost: Boolean(document.getElementById("ttsSpeakerBoost")?.checked),
  };
}

function formatSettingValue(value) {
  return value.toFixed(2);
}

function bindVoiceSettingControls() {
  const bindings = [
    { inputId: "ttsStability", outputId: "ttsStabilityValue" },
    { inputId: "ttsSimilarity", outputId: "ttsSimilarityValue" },
    { inputId: "ttsStyle", outputId: "ttsStyleValue" },
    { inputId: "ttsSpeed", outputId: "ttsSpeedValue" },
    { inputId: "ttsV4Speed", outputId: "ttsV4SpeedValue" },
  ];

  for (const { inputId, outputId } of bindings) {
    const input = document.getElementById(inputId);
    const output = document.getElementById(outputId);
    if (!input || !output) continue;

    const sync = () => {
      output.textContent = formatSettingValue(Number(input.value));
    };

    sync();
    input.addEventListener("input", sync);
  }
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

function buildTtsRequestBody(synthesisText, modelId, voiceSettings) {
  const body = {
    text: synthesisText,
    model_id: modelId,
    voice_settings: voiceSettings,
    apply_text_normalization: "on",
    language_code: TTS_LANGUAGE_CODE,
  };

  // eleven_v4: pass PVC or IVC voice_id directly — API rejects use_pvc_as_ivc on this model.
  // flash / multilingual: use_pvc_as_ivc false keeps PVC1–PVC5 on their PVC clones (PRE is v4-only).
  if (modelId !== ELEVEN_V4_MODEL) {
    body.use_pvc_as_ivc = false;
  }

  return body;
}

function buildTtsApiUrl(voiceId) {
  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`);
  url.searchParams.set("output_format", TTS_OUTPUT_FORMAT);
  return url.toString();
}

function buildTtsPayload(voiceId, synthesisText, modelId, voiceSettings) {
  return {
    voice_id: voiceId,
    output_format: TTS_OUTPUT_FORMAT,
    ...buildTtsRequestBody(synthesisText, modelId, voiceSettings),
  };
}

async function fetchTtsAudio(voiceId, text, modelId, voiceSettings) {
  const synthesisText = prepareTtsText(text, modelId, voiceId);
  const payload = buildTtsPayload(voiceId, synthesisText, modelId, voiceSettings);

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

  const res = await fetch(buildTtsApiUrl(voiceId), {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify(buildTtsRequestBody(synthesisText, modelId, voiceSettings)),
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

  populateTtsVoiceSelect(voiceSelect);
  for (const m of TTS_MODELS) {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.label;
    modelSelect.appendChild(opt);
  }

  updateTtsPanelForModel(textInput, modelSelect.value);

  voiceSelect.addEventListener("change", () => {
    onTtsVoiceChange(voiceSelect, modelSelect, textInput);
  });

  modelSelect.addEventListener("change", () => {
    onTtsModelChange(voiceSelect, modelSelect, textInput);
  });
  bindVoiceSettingControls();

  let revokeFns = [];

  generateBtn.addEventListener("click", async () => {
    ensurePreUsesV4(voiceSelect, modelSelect, textInput);

    const text = textInput.value.trim();
    const voiceId = voiceSelect.value;
    const modelId = modelSelect.value;
    const voiceSettings = readVoiceSettings(modelId);

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
        Array.from({ length: SAMPLE_COUNT }, () =>
          fetchTtsAudio(voiceId, text, modelId, voiceSettings),
        ),
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
