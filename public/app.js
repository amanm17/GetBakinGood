// GetBakinGood — static conversion tool
const $ = (sel) => document.querySelector(sel);

const state = {
  presets: [],
  rulesByKey: new Map(),
  devices: [],
};

const FACTORS = {
  containers: [
    { name: "Metal (light / shiny)", tempOffsetC: 0,  timeFactor: 1.00, notes: "Baseline." },
    { name: "Metal (dark / non-stick)", tempOffsetC: -5, timeFactor: 0.98, notes: "Browns faster; consider slightly lower temp." },
    { name: "Glass / ceramic", tempOffsetC: -10, timeFactor: 1.05, notes: "Holds heat; often needs lower temp and slightly more time." },
    { name: "Silicone", tempOffsetC: 0, timeFactor: 1.08, notes: "Insulates; may need a little longer." },
    { name: "Wire rack / no pan", tempOffsetC: 0, timeFactor: 0.95, notes: "More airflow; cooks a bit faster." },
    { name: "Air fryer basket", tempOffsetC: 0, timeFactor: 0.90, notes: "Strong airflow; shake/flip." },
  ],
  racks: [
    { name: "Top", tempOffsetC: 0, timeFactor: 1.00, notes: "More browning; watch tops." },
    { name: "Middle", tempOffsetC: 0, timeFactor: 1.00, notes: "Most even for baking/roasting." },
    { name: "Bottom", tempOffsetC: 0, timeFactor: 1.03, notes: "Slower browning on top; good for crisp bases." },
  ],
  modeTypes: [
    { id: "BAKE_DELICATE", label: "Delicate bakes (cakes, sponge, custard)" },
    { id: "BAKE_STANDARD", label: "Standard bakes (cookies, brownies, breads)" },
    { id: "ROAST", label: "Roasting (meat, veggies, casseroles)" },
    { id: "GRILL_TOP", label: "Top heat / broil / grilling" },
    { id: "REHEAT_CRISP", label: "Reheat & crisp (pizza slice, fries, nuggets)" },
  ],
};

function round0(x){ return Math.round(x); }
function clamp(x,min,max){ return Math.max(min, Math.min(max, x)); }

function getRule(device, modeType){
  const key = `${device}|${modeType}`;
  return state.rulesByKey.get(key) || null;
}

function computeRecommendation({
  workflow,
  preset,
  modeType,
  origDevice,
  origTempC,
  origTimeMin,
  targetDevice,
  qtyMult,
  thkMult,
  containerName,
  rackName,
  frozen,
  overcrowd,
  tuning,
}){
  // Inputs
  const mode = workflow === "preset" ? preset.mode_type : modeType;

  const tempIn = workflow === "preset" ? preset.base_temp_c : origTempC;
  const timeIn = workflow === "preset" ? preset.base_time_min : origTimeMin;

  const origDevEff = workflow === "preset" ? "Oven (Conventional)" : origDevice;

  const rOrig = getRule(origDevEff, mode);
  const rTar  = getRule(targetDevice, mode);

  if(!rOrig || !rTar){
    return { error: "Missing conversion rule for selected device/mode." };
  }

  const cont = FACTORS.containers.find(c => c.name === containerName) || FACTORS.containers[0];
  const rack = FACTORS.racks.find(r => r.name === rackName) || FACTORS.racks[1];

  const qtyExp = tuning.qtyExp;
  const thkExp = tuning.thkExp;
  const frozenFac = tuning.frozenFac;
  const overcrowdFac = 1.10;

  const qtyFactor = Math.pow(qtyMult, qtyExp);
  const thkFactor = Math.pow(thkMult, thkExp);
  const frozenFactor = frozen ? frozenFac : 1.0;
  const overFactor = overcrowd ? overcrowdFac : 1.0;

  const baseTempTarget = round0(tempIn + (rTar.temp_offset_c - rOrig.temp_offset_c));
  const baseTimeTarget = timeIn * (rTar.time_factor / rOrig.time_factor);

  const finalTemp = round0(baseTempTarget + cont.tempOffsetC + rack.tempOffsetC);
  const finalTime = round0(baseTimeTarget * cont.timeFactor * rack.timeFactor * qtyFactor * thkFactor * frozenFactor * overFactor);

  const preheat = workflow === "preset"
    ? Math.max(preset.base_preheat_min || 0, rTar.preheat_min || 0)
    : (rTar.preheat_min || 0);

  const notes = [];
  if(workflow === "preset" && preset.notes) notes.push(preset.notes);
  if(rTar.notes) notes.push(`• ${rTar.notes}`);
  if(cont.notes) notes.push(`• ${cont.notes}`);
  if(rack.notes) notes.push(`• ${rack.notes}`);
  if(targetDevice === "Air Fryer (Basket)") notes.push("• Shake/flip half-way; keep a single layer.");

  return {
    finalTempC: finalTemp,
    finalTimeMin: finalTime,
    preheatMin: preheat,
    modeType: mode,
    notes: notes.join("\n"),
  };
}

function renderMiniChart(rows){
  // rows: [{device, time}]
  const max = Math.max(...rows.map(r => r.time), 1);
  const width = 520;
  const barH = 18;
  const gap = 10;
  const leftPad = 180;
  const topPad = 10;
  const height = topPad + rows.length * (barH + gap) + 6;

  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  const bars = rows.map((r, i) => {
    const y = topPad + i * (barH + gap);
    const w = Math.round((width - leftPad - 20) * (r.time / max));
    return `
      <text x="0" y="${y + 13}" fill="rgba(232,238,252,.92)" font-size="12">${esc(r.device)}</text>
      <rect x="${leftPad}" y="${y}" width="${w}" height="${barH}" rx="8" fill="rgba(98,160,255,.55)"></rect>
      <text x="${leftPad + w + 8}" y="${y + 13}" fill="rgba(169,183,214,.95)" font-size="12">${r.time}m</text>
    `;
  }).join("");

  $("#miniChart").innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Time comparison chart">
      ${bars}
    </svg>
  `;
}

function update(){
  const workflow = document.querySelector('input[name="workflow"]:checked')?.value || "preset";
  const presetId = $("#dish").value;
  const preset = state.presets.find(p => p.dish_id === presetId) || state.presets[0];

  const input = {
    workflow,
    preset,
    modeType: $("#modeType").value,
    origDevice: $("#origDevice").value,
    origTempC: Number($("#origTemp").value || 0),
    origTimeMin: Number($("#origTime").value || 0),
    targetDevice: $("#targetDevice").value,
    qtyMult: clamp(Number($("#qty").value || 1), 0.25, 5),
    thkMult: clamp(Number($("#thk").value || 1), 0.5, 3),
    containerName: $("#container").value,
    rackName: $("#rack").value,
    frozen: $("#frozen").checked,
    overcrowd: $("#overcrowd").checked,
    tuning: {
      qtyExp: clamp(Number($("#qtyExp").value || 0.65), 0.2, 1.0),
      thkExp: clamp(Number($("#thkExp").value || 0.50), 0.2, 1.0),
      frozenFac: clamp(Number($("#frozenFac").value || 1.15), 1.0, 1.5),
    }
  };

  // UX: show preset hint
  $("#dishHint").textContent = preset
    ? `${preset.category} · ${preset.mode_type} · base ${preset.base_temp_c}°C for ${preset.base_time_min} min`
    : "";

  const res = computeRecommendation(input);
  if(res.error){
    $("#outTemp").textContent = "—";
    $("#outTime").textContent = "—";
    $("#outPreheat").textContent = "—";
    $("#outNotes").textContent = res.error;
    return;
  }

  $("#outTemp").textContent = res.finalTempC;
  $("#outTime").textContent = res.finalTimeMin;
  $("#outPreheat").textContent = res.preheatMin;
  $("#outNotes").textContent = res.notes || "—";

  // comparison rows
  const compare = [
    "Oven (Conventional)",
    "OTG (Conventional)",
    "Oven (Convection/Fan)",
    "Convection Microwave (Convection mode)",
    "Air Fryer (Basket)",
  ].map(device => {
    const r = computeRecommendation({ ...input, targetDevice: device });
    return { device, time: r.error ? 0 : r.finalTimeMin };
  });
  renderMiniChart(compare);
}

function setConvertControlsEnabled(enabled){
  const ids = ["origDevice","modeType","origTemp","origTime"];
  ids.forEach(id => {
    const el = $("#"+id);
    el.disabled = !enabled;
    el.closest(".field")?.classList.toggle("disabled", !enabled);
  });
}

function populateSelect(sel, items, { valueKey="value", labelKey="label"}={}){
  sel.innerHTML = "";
  for(const it of items){
    const opt = document.createElement("option");
    opt.value = it[valueKey];
    opt.textContent = it[labelKey];
    sel.appendChild(opt);
  }
}

async function init(){
  const [presetsRes, rulesRes] = await Promise.all([
    fetch("data/presets.json"),
    fetch("data/conversion_rules.json"),
  ]);
  const presetsJson = await presetsRes.json();
  const rulesJson = await rulesRes.json();

  state.presets = presetsJson.presets;
  state.rulesByKey = new Map(rulesJson.rules.map(r => [r.key, r]));
  // build device list from rules
  const deviceSet = new Set(rulesJson.rules.map(r => r.device));
  state.devices = [...deviceSet].sort((a,b) => a.localeCompare(b));

  // Populate UI
  populateSelect($("#dish"), state.presets.map(p => ({ value: p.dish_id, label: p.dish })));
  populateSelect($("#targetDevice"), state.devices.map(d => ({ value: d, label: d })));
  populateSelect($("#origDevice"), state.devices.map(d => ({ value: d, label: d })));
  populateSelect($("#modeType"), FACTORS.modeTypes.map(m => ({ value: m.id, label: m.label })));
  populateSelect($("#container"), FACTORS.containers.map(c => ({ value: c.name, label: c.name })));
  populateSelect($("#rack"), FACTORS.racks.map(r => ({ value: r.name, label: r.name })));

  // defaults
  $("#targetDevice").value = "Air Fryer (Basket)";
  $("#origDevice").value = "Oven (Conventional)";
  $("#modeType").value = "BAKE_DELICATE";
  $("#container").value = "Metal (light / shiny)";
  $("#rack").value = "Middle";

  // listeners
  document.querySelectorAll("input[name='workflow']").forEach(r => r.addEventListener("change", () => {
    setConvertControlsEnabled(r.value === "convert" && r.checked);
    update();
  }));

  ["dish","targetDevice","origDevice","modeType","origTemp","origTime","qty","thk","container","rack","frozen","overcrowd","qtyExp","thkExp","frozenFac"]
    .forEach(id => $("#"+id).addEventListener("input", update));

  setConvertControlsEnabled(false);
  update();
}

init().catch(err => {
  console.error(err);
  $("#outNotes").textContent = "Failed to load data files. Make sure /data/presets.json and /data/conversion_rules.json exist.";
});
