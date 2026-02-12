(function exposeMinusculeUI(global) {
  "use strict";

  const core = global.MinusculeCore;
  if (!core) {
    throw new Error("MinusculeCore must be loaded before MinusculeUI.");
  }

  const SVG_NS = "http://www.w3.org/2000/svg";
  const OMEGA = "\u03c9";
  const PHI = "\u03c6";
  const EMPTY = "\u2205";

  const state = {
    type: "A",
    n: 4,
    k: 2,
    poset: null,
    currentMask: 0,
    lastAction: null,
    globalReport: null,
    structureAnalysis: null,
    coxeterElements: [],
    nextCoxeterId: 1,
    coxeterFeedback: "No Coxeter elements added yet.",
    coxeterFeedbackWarn: false,
    orbitActionKey: "fon-der-flaass",
    orbitSpeedMs: 750,
    orbitStatus: "No orbit animation yet.",
    orbitStatusWarn: false,
    orbitReport: null,
    orbitPlayback: null,
    orbitTimerId: null,
  };

  const ui = {};

  function init() {
    cacheUi();
    populateTypeOptions();
    syncRankOptions(state.n);
    syncWeightOptions(state.k);
    bindEvents();
    rebuildFromControls();
  }

  function cacheUi() {
    ui.heroTitle = document.getElementById("hero-title");
    ui.heroSubtitle = document.getElementById("hero-subtitle");
    ui.footnote = document.getElementById("representation-footnote");

    ui.lieType = document.getElementById("lie-type");
    ui.rankN = document.getElementById("rank-n");
    ui.weightK = document.getElementById("weight-k");
    ui.rebuild = document.getElementById("rebuild");
    ui.resetIdeal = document.getElementById("reset-ideal");

    ui.rootButtons = document.getElementById("root-buttons");
    ui.applyFonDerFlaass = document.getElementById("apply-fon-der-flaass");

    ui.coxeterOrder = document.getElementById("coxeter-order");
    ui.addCoxeter = document.getElementById("add-coxeter");
    ui.coxeterFeedback = document.getElementById("coxeter-feedback");
    ui.coxeterList = document.getElementById("coxeter-list");

    ui.orbitAction = document.getElementById("orbit-action");
    ui.orbitSpeed = document.getElementById("orbit-speed");
    ui.orbitSpeedValue = document.getElementById("orbit-speed-value");
    ui.playOrbit = document.getElementById("play-orbit");
    ui.stopOrbit = document.getElementById("stop-orbit");
    ui.orbitStatus = document.getElementById("orbit-status");

    ui.verifyAll = document.getElementById("verify-all");
    ui.globalReport = document.getElementById("global-report");

    ui.posetSvg = document.getElementById("poset-svg");
    ui.currentIdeal = document.getElementById("current-ideal");
    ui.currentWeight = document.getElementById("current-weight");
    ui.representationFacts = document.getElementById("representation-facts");
    ui.actionReport = document.getElementById("action-report");
    ui.orbitReport = document.getElementById("orbit-report");
    ui.developerAnalysis = document.getElementById("developer-analysis");
  }

  function bindEvents() {
    ui.lieType.addEventListener("change", () => {
      syncRankOptions(state.n);
      syncWeightOptions(state.k);
    });

    ui.rankN.addEventListener("change", () => {
      syncWeightOptions(state.k);
    });

    ui.rebuild.addEventListener("click", () => {
      rebuildFromControls();
    });

    ui.resetIdeal.addEventListener("click", () => {
      stopOrbitAnimation(null);
      state.currentMask = 0;
      state.lastAction = null;
      invalidateOrbitReport("Orbit report cleared: ideal reset.");
      renderAll();
    });

    ui.applyFonDerFlaass.addEventListener("click", () => {
      applyFonDerFlaassAction();
    });

    ui.addCoxeter.addEventListener("click", () => {
      addCoxeterElement();
    });

    ui.coxeterOrder.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addCoxeterElement();
      }
    });

    ui.orbitAction.addEventListener("change", () => {
      if (state.orbitTimerId !== null) {
        return;
      }
      state.orbitActionKey = ui.orbitAction.value;
      invalidateOrbitReport("Orbit report cleared: action changed.");
      renderOrbitControls();
      renderOrbitReport();
    });

    ui.orbitSpeed.addEventListener("input", () => {
      state.orbitSpeedMs = clampOrbitSpeedMs(Number(ui.orbitSpeed.value));
      renderOrbitControls();
    });

    ui.playOrbit.addEventListener("click", () => {
      playOrbitAnimation();
    });

    ui.stopOrbit.addEventListener("click", () => {
      stopOrbitAnimation("Orbit animation stopped.");
      renderAll();
    });

    ui.verifyAll.addEventListener("click", () => {
      state.globalReport = core.verifyExhaustively(state.poset);
      renderGlobalReport();
      renderDeveloperNotes();
    });
  }

  function populateTypeOptions() {
    ui.lieType.innerHTML = "";
    const options = core.supportedTypes();
    for (const type of options) {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = type;
      if (type === state.type) {
        option.selected = true;
      }
      ui.lieType.appendChild(option);
    }
  }

  function syncRankOptions(preferredN) {
    const type = String(ui.lieType.value || state.type);
    const options = core.supportedRanks(type);
    ui.rankN.innerHTML = "";

    let chosen = Number(preferredN);
    if (!options.includes(chosen)) {
      chosen = options[0];
    }

    for (const n of options) {
      const option = document.createElement("option");
      option.value = String(n);
      option.textContent = String(n);
      option.selected = n === chosen;
      ui.rankN.appendChild(option);
    }
  }

  function syncWeightOptions(preferredK) {
    const type = String(ui.lieType.value || state.type);
    const n = Number(ui.rankN.value);
    const options = core.minusculeWeights(type, n);

    ui.weightK.innerHTML = "";

    let chosen = Number(preferredK);
    if (!options.includes(chosen)) {
      chosen = options[0];
    }

    for (const k of options) {
      const option = document.createElement("option");
      option.value = String(k);
      option.textContent = String(k);
      option.selected = k === chosen;
      ui.weightK.appendChild(option);
    }
  }

  function rebuildFromControls() {
    stopOrbitAnimation(null);

    state.type = String(ui.lieType.value || "A").toUpperCase();
    state.n = Number(ui.rankN.value);
    state.k = Number(ui.weightK.value);

    state.poset = core.buildMinusculePoset(state.type, state.n, state.k);
    state.currentMask = 0;
    state.lastAction = null;
    state.globalReport = null;
    state.structureAnalysis = core.analyzeLabelStructure(state.poset);
    state.coxeterElements = [];
    state.nextCoxeterId = 1;
    state.coxeterFeedback = "No Coxeter elements added yet.";
    state.coxeterFeedbackWarn = false;
    state.orbitActionKey = "fon-der-flaass";
    state.orbitStatus = "No orbit animation yet.";
    state.orbitStatusWarn = false;
    state.orbitReport = null;
    state.orbitPlayback = null;

    ui.coxeterOrder.value = "";
    ui.orbitSpeed.value = String(state.orbitSpeedMs);

    renderAll();
  }

  function renderAll() {
    renderHeader();
    renderRootButtons();
    renderCoxeterControls();
    renderOrbitControls();
    renderPoset();
    renderCurrentState();
    renderActionReport();
    renderOrbitReport();
    renderGlobalReport();
    renderDeveloperNotes();
  }

  function renderHeader() {
    const poset = state.poset;
    if (!poset) {
      return;
    }

    ui.heroTitle.innerHTML = `Minuscule Posets Explorer: ${typeSymbol(poset.type, poset.n)} with ${omegaSymbol(poset.k)}`;
    ui.heroSubtitle.innerHTML = [
      `Representation <span class='formula-inline'>${typesetMathText(poset.representation.model)}</span>;`,
      `bijection <span class='formula-inline'>${PHI}: J(P) &rarr; W&middot;${omegaSymbol(poset.k)}</span>;`,
      `equivariance <span class='formula-inline'>${PHI}(t<sub>i</sub>(I)) = s<sub>i</sub>(${PHI}(I))</span>.`,
    ].join(" ");

    ui.footnote.innerHTML = [
      `Current model: <code>${typeSymbol(poset.type, poset.n)}</code>, `,
      `highest weight <code>${omegaSymbol(poset.k)}</code>, `,
      `expected dimension <code>${poset.expectedIdeals}</code>.`,
    ].join("");
  }

  function renderRootButtons() {
    ui.rootButtons.innerHTML = "";
    const animating = state.orbitTimerId !== null;
    for (let label = 1; label <= state.poset.n; label += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.innerHTML = toggleSymbol(label);
      button.title = `Toggle every element with label ${label}`;
      button.disabled = animating;
      button.addEventListener("click", () => applyRootToggle(label));
      ui.rootButtons.appendChild(button);
    }
  }

  function renderCoxeterControls() {
    const animating = state.orbitTimerId !== null;
    ui.coxeterFeedback.className = state.coxeterFeedbackWarn ? "small warn" : "small muted";
    ui.coxeterFeedback.textContent = state.coxeterFeedback;
    ui.coxeterList.innerHTML = "";

    if (state.coxeterElements.length === 0) {
      const empty = document.createElement("div");
      empty.className = "small muted";
      empty.textContent = "No saved Coxeter elements.";
      ui.coxeterList.appendChild(empty);
      return;
    }

    for (const element of state.coxeterElements) {
      const row = document.createElement("div");
      row.className = "coxeter-item";

      const text = document.createElement("div");
      text.className = "coxeter-word";
      text.innerHTML = `${element.name}: ${wordAsReflectionString(element.word)}`;
      row.appendChild(text);

      const apply = document.createElement("button");
      apply.type = "button";
      apply.textContent = "Apply";
      apply.disabled = animating;
      apply.addEventListener("click", () => {
        applyCoxeterElement(element);
      });
      row.appendChild(apply);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "coxeter-remove";
      remove.textContent = "Remove";
      remove.disabled = animating;
      remove.addEventListener("click", () => {
        removeCoxeterElement(element.id);
      });
      row.appendChild(remove);

      ui.coxeterList.appendChild(row);
    }
  }

  function renderOrbitControls() {
    const animating = state.orbitTimerId !== null;
    const options = getOrbitActionOptions();

    if (!options.some((option) => option.key === state.orbitActionKey)) {
      state.orbitActionKey = options[0].key;
    }

    ui.orbitAction.innerHTML = "";
    for (const option of options) {
      const node = document.createElement("option");
      node.value = option.key;
      node.textContent = option.label;
      node.selected = option.key === state.orbitActionKey;
      ui.orbitAction.appendChild(node);
    }

    const speed = clampOrbitSpeedMs(state.orbitSpeedMs);
    state.orbitSpeedMs = speed;
    ui.orbitSpeed.value = String(speed);
    ui.orbitSpeedValue.textContent = `${speed} ms`;

    ui.orbitAction.disabled = animating;
    ui.orbitSpeed.disabled = animating;
    ui.playOrbit.disabled = animating;
    ui.stopOrbit.disabled = !animating;

    ui.lieType.disabled = animating;
    ui.rankN.disabled = animating;
    ui.weightK.disabled = animating;
    ui.rebuild.disabled = animating;
    ui.resetIdeal.disabled = animating;
    ui.applyFonDerFlaass.disabled = animating;
    ui.coxeterOrder.disabled = animating;
    ui.addCoxeter.disabled = animating;
    ui.verifyAll.disabled = animating;

    ui.orbitStatus.className = state.orbitStatusWarn ? "small warn" : "small muted";
    ui.orbitStatus.textContent = state.orbitStatus;
  }

  function getOrbitActionOptions() {
    const options = [
      {
        key: "fon-der-flaass",
        label: "Fon-Der-Flaass action",
        action: { kind: "fon-der-flaass" },
        actionLabel: "Fon-Der-Flaass action",
      },
    ];

    for (const element of state.coxeterElements) {
      options.push({
        key: `coxeter:${element.id}`,
        label: `${element.name}: ${wordAsPlainReflectionString(element.word)}`,
        action: { kind: "coxeter", word: element.word.slice() },
        actionLabel: `${element.name}: ${wordAsReflectionString(element.word)}`,
      });
    }
    return options;
  }

  function getSelectedOrbitActionOption() {
    const options = getOrbitActionOptions();
    const selected = options.find((option) => option.key === state.orbitActionKey);
    if (selected) {
      return selected;
    }
    state.orbitActionKey = options[0].key;
    return options[0];
  }

  function invalidateOrbitReport(message) {
    state.orbitReport = null;
    state.orbitStatusWarn = false;
    if (message) {
      state.orbitStatus = message;
    }
  }

  function clampOrbitSpeedMs(value) {
    const numeric = Number.isFinite(value) ? value : 750;
    return Math.max(250, Math.min(2000, Math.round(numeric / 50) * 50));
  }

  function playOrbitAnimation() {
    if (state.orbitTimerId !== null) {
      return;
    }

    let selection;
    let orbit;
    let orbitSummary;
    let fixedObserved;
    let homomesy;
    let fixedPredictedEvaluation = null;

    try {
      selection = getSelectedOrbitActionOption();
      orbit = core.orbitFromMask(state.currentMask, selection.action, state.poset);
      orbitSummary = core.summarizeOrbit(orbit.masks, state.poset);
      const ideals = core.enumerateIdeals(state.poset);
      fixedObserved = core.countActionFixedPoints(selection.action, state.poset, ideals);
      homomesy = core.homomesyPredictions(state.poset);

      if (selection.action.kind === "fon-der-flaass" || selection.action.kind === "coxeter") {
        if (state.poset.type === "A") {
          fixedPredictedEvaluation = core.cspFixedPointEvaluationTypeA(state.poset, 1);
        } else {
          fixedPredictedEvaluation = core.cspFixedPointEvaluationFromRankGenerating(state.poset, 1, ideals);
        }
      }
    } catch (error) {
      state.orbitStatusWarn = true;
      state.orbitStatus = `Could not run orbit witness: ${error.message}`;
      renderOrbitControls();
      return;
    }

    state.orbitReport = {
      actionLabel: selection.actionLabel,
      actionKey: selection.key,
      actionKind: selection.action.kind,
      orbit,
      observed: {
        orbitLength: orbit.orbitLength,
        fixedPointsInOrbit: orbit.fixedPointsInOrbit,
        avgSize: orbitSummary.avgSize,
        avgLabelCounts: orbitSummary.avgLabelCounts,
        avgAntichainSize: orbitSummary.avgAntichainSize,
        globalFixedPoints: fixedObserved.fixedPoints,
      },
      predicted: {
        avgSize: homomesy.avgSize,
        avgLabelCounts: homomesy.avgLabelCounts,
        avgAntichainSize: selection.action.kind === "fon-der-flaass"
          ? homomesy.avgAntichainSizeFDF
          : null,
        globalFixedPoints: fixedPredictedEvaluation ? fixedPredictedEvaluation.fixedPoints : null,
      },
      homomesy,
      cspEvaluation: fixedPredictedEvaluation,
    };

    state.orbitPlayback = {
      action: selection,
      orbit,
      stepIndex: 0,
    };
    state.orbitStatusWarn = false;
    state.orbitStatus = `Playing orbit: step 0/${orbit.steps.length}.`;

    const delay = clampOrbitSpeedMs(state.orbitSpeedMs);
    state.orbitTimerId = global.setInterval(() => {
      tickOrbitAnimation();
    }, delay);
    renderAll();
  }

  function tickOrbitAnimation() {
    const playback = state.orbitPlayback;
    if (!playback) {
      stopOrbitAnimation(null);
      return;
    }

    const totalSteps = playback.orbit.steps.length;
    if (playback.stepIndex >= totalSteps) {
      stopOrbitAnimation(`Completed one full orbit (${playback.orbit.orbitLength} ideals).`);
      renderAll();
      return;
    }

    const step = playback.orbit.steps[playback.stepIndex];
    applyOrbitStep(playback.action, step);
    playback.stepIndex += 1;
    state.orbitStatusWarn = false;
    state.orbitStatus = `Playing orbit: step ${playback.stepIndex}/${totalSteps}.`;
    renderAll();

    if (playback.stepIndex >= totalSteps) {
      stopOrbitAnimation(`Completed one full orbit (${playback.orbit.orbitLength} ideals).`);
      renderAll();
    }
  }

  function stopOrbitAnimation(message) {
    if (state.orbitTimerId !== null) {
      global.clearInterval(state.orbitTimerId);
      state.orbitTimerId = null;
    }
    state.orbitPlayback = null;
    if (message) {
      state.orbitStatusWarn = false;
      state.orbitStatus = message;
    }
  }

  function applyOrbitStep(selection, step) {
    const poset = state.poset;
    const beforeMask = step.fromMask;
    const afterMask = step.toMask;
    const beforePhi = core.phi(beforeMask, poset);
    const afterPhi = core.phi(afterMask, poset);
    state.currentMask = afterMask;

    if (selection.action.kind === "fon-der-flaass") {
      const rankOrder = [];
      for (let rank = poset.rankMax; rank >= poset.rankMin; rank -= 1) {
        rankOrder.push(rank);
      }
      state.lastAction = {
        type: "fon-der-flaass",
        changedIndices: step.changedIndices.slice(),
        beforeMask,
        afterMask,
        beforePhi,
        afterPhi,
        rankOrder,
      };
      return;
    }

    if (selection.action.kind === "coxeter") {
      let reflected = beforePhi.weight.slice();
      for (let idx = selection.action.word.length - 1; idx >= 0; idx -= 1) {
        reflected = core.reflect(reflected, selection.action.word[idx], poset.cartan);
      }
      const matches = core.sameArray(afterPhi.weight, reflected);
      state.lastAction = {
        type: "coxeter",
        elementName: selection.actionLabel.split(":")[0],
        word: selection.action.word.slice(),
        changedIndices: step.changedIndices.slice(),
        beforeMask,
        afterMask,
        beforePhi,
        afterPhi,
        reflected,
        matches,
      };
    }
  }

  function applyRootToggle(label) {
    if (state.orbitTimerId !== null) {
      return;
    }

    const poset = state.poset;
    const beforeMask = state.currentMask;
    const beforePhi = core.phi(beforeMask, poset);

    const result = core.toggleByLabel(beforeMask, label, poset);
    const afterMask = result.mask;
    const afterPhi = core.phi(afterMask, poset);
    const reflected = core.reflect(beforePhi.weight, label, poset.cartan);
    const matches = core.sameArray(afterPhi.weight, reflected);

    state.currentMask = afterMask;
    state.lastAction = {
      type: "root-toggle",
      label,
      changedIndices: result.changedIndices,
      beforeMask,
      afterMask,
      beforePhi,
      afterPhi,
      reflected,
      matches,
    };
    invalidateOrbitReport("Orbit report cleared: ideal changed.");
    renderAll();
  }

  function applyFonDerFlaassAction() {
    if (state.orbitTimerId !== null) {
      return;
    }

    const poset = state.poset;
    const beforeMask = state.currentMask;
    const beforePhi = core.phi(beforeMask, poset);
    const result = core.fonDerFlaassAction(beforeMask, poset);
    const afterMask = result.mask;
    const afterPhi = core.phi(afterMask, poset);

    const rankOrder = [];
    for (let rank = poset.rankMax; rank >= poset.rankMin; rank -= 1) {
      rankOrder.push(rank);
    }

    state.currentMask = afterMask;
    state.lastAction = {
      type: "fon-der-flaass",
      changedIndices: result.changedIndices,
      beforeMask,
      afterMask,
      beforePhi,
      afterPhi,
      rankOrder,
    };
    invalidateOrbitReport("Orbit report cleared: ideal changed.");
    renderAll();
  }

  function addCoxeterElement() {
    if (state.orbitTimerId !== null) {
      return;
    }

    const raw = ui.coxeterOrder.value.trim();
    const parsed = parseCoxeterOrder(raw, state.poset.n);
    if (!parsed.ok) {
      state.coxeterFeedbackWarn = true;
      state.coxeterFeedback = parsed.error;
      renderCoxeterControls();
      return;
    }

    const id = state.nextCoxeterId;
    state.nextCoxeterId += 1;
    const name = `c${id}`;
    state.coxeterElements.push({
      id,
      name,
      word: parsed.word,
    });

    ui.coxeterOrder.value = "";
    state.coxeterFeedbackWarn = false;
    state.coxeterFeedback = `Built ${name} with word ${wordAsPlainReflectionString(parsed.word)}.`;
    invalidateOrbitReport("Orbit report cleared: Coxeter list changed.");

    renderCoxeterControls();
    renderOrbitControls();
    renderOrbitReport();
  }

  function removeCoxeterElement(id) {
    if (state.orbitTimerId !== null) {
      return;
    }

    state.coxeterElements = state.coxeterElements.filter((element) => element.id !== id);
    state.coxeterFeedbackWarn = false;
    state.coxeterFeedback = state.coxeterElements.length === 0
      ? "No Coxeter elements added yet."
      : "Removed one Coxeter element.";
    invalidateOrbitReport("Orbit report cleared: Coxeter list changed.");

    renderCoxeterControls();
    renderOrbitControls();
    renderOrbitReport();
  }

  function applyCoxeterElement(element) {
    if (state.orbitTimerId !== null) {
      return;
    }

    const poset = state.poset;
    const beforeMask = state.currentMask;
    const beforePhi = core.phi(beforeMask, poset);
    const result = core.applyCoxeterWord(beforeMask, element.word, poset);
    const afterMask = result.mask;
    const afterPhi = core.phi(afterMask, poset);

    let reflected = beforePhi.weight.slice();
    for (let idx = element.word.length - 1; idx >= 0; idx -= 1) {
      reflected = core.reflect(reflected, element.word[idx], poset.cartan);
    }
    const matches = core.sameArray(afterPhi.weight, reflected);

    state.currentMask = afterMask;
    state.lastAction = {
      type: "coxeter",
      elementName: element.name,
      word: element.word,
      changedIndices: result.changedIndices,
      beforeMask,
      afterMask,
      beforePhi,
      afterPhi,
      reflected,
      matches,
    };
    invalidateOrbitReport("Orbit report cleared: ideal changed.");
    renderAll();
  }

  function applySingleNodeToggle(index) {
    if (state.orbitTimerId !== null) {
      return;
    }

    const beforeMask = state.currentMask;
    const afterMask = core.toggleNode(beforeMask, index, state.poset);
    const node = state.poset.nodes[index];
    const ref = nodeDisplay(node);

    if (afterMask === beforeMask) {
      state.lastAction = {
        type: "single-node",
        text: `Node ${ref} with label ${node.label} is not togglable from this ideal.`,
        changedIndices: [],
      };
      renderAll();
      return;
    }

    state.currentMask = afterMask;
    state.lastAction = {
      type: "single-node",
      text: `Single toggle at ${ref} applied.`,
      changedIndices: [index],
    };
    invalidateOrbitReport("Orbit report cleared: ideal changed.");
    renderAll();
  }

  function renderPoset() {
    const poset = state.poset;
    const svg = ui.posetSvg;
    svg.innerHTML = "";

    const nonTypeASize = poset.nodes.length;
    const isTypeA = poset.type === "A";
    const rankLevels = poset.rankMax - poset.rankMin + 1;
    let xStep;
    let yStep;
    let margin;
    let nodeRadius;
    let nodeFontPx;

    if (isTypeA) {
      xStep = 56;
      yStep = 56;
      margin = 46;
      nodeRadius = 19;
      nodeFontPx = 14;
      svg.style.height = "";
      svg.style.minHeight = "19rem";
    } else if (nonTypeASize >= 24) {
      xStep = 40;
      yStep = 40;
      margin = 34;
      nodeRadius = 12;
      nodeFontPx = 10.5;
    } else if (nonTypeASize >= 16) {
      xStep = 42;
      yStep = 42;
      margin = 34;
      nodeRadius = 13;
      nodeFontPx = 11;
    } else {
      xStep = 44;
      yStep = 44;
      margin = 34;
      nodeRadius = 14;
      nodeFontPx = 12;
    }

    if (!isTypeA) {
      const targetRem = Math.max(28, Math.min(48, 15 + rankLevels * 1.7));
      const targetHeight = `${targetRem.toFixed(1)}rem`;
      svg.style.height = targetHeight;
      svg.style.minHeight = targetHeight;
    }

    const raw = new Map();
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const node of poset.nodes) {
      const baseX = Number.isFinite(node.drawX) ? node.drawX : 0;
      const baseY = Number.isFinite(node.drawY) ? node.drawY : node.rank;
      const x = baseX * xStep;
      const y = baseY * yStep;
      raw.set(node.index, { x, y });
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    const width = margin * 2 + Math.max(1, maxX - minX);
    const height = margin * 2 + Math.max(1, maxY - minY);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const positions = new Map();
    for (const node of poset.nodes) {
      const point = raw.get(node.index);
      const x = margin + (point.x - minX);
      const y = margin + (maxY - point.y);
      positions.set(node.index, { x, y });
    }

    for (const node of poset.nodes) {
      const end = positions.get(node.index);
      for (const pred of node.preds) {
        const start = positions.get(pred);
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("x1", String(start.x));
        line.setAttribute("y1", String(start.y));
        line.setAttribute("x2", String(end.x));
        line.setAttribute("y2", String(end.y));
        line.setAttribute("class", "edge");
        if (!isTypeA) {
          line.setAttribute("stroke-width", "1.6");
        }
        svg.appendChild(line);
      }
    }

    const changed = new Set(state.lastAction?.changedIndices || []);
    const animating = state.orbitTimerId !== null;

    for (const node of poset.nodes) {
      const point = positions.get(node.index);
      const group = document.createElementNS(SVG_NS, "g");
      const classes = ["node"];

      if (core.hasBit(state.currentMask, node.index)) {
        classes.push("in-ideal");
      }
      if (core.canAdd(state.currentMask, node.index, poset)) {
        classes.push("can-add");
      }
      if (core.canRemove(state.currentMask, node.index, poset)) {
        classes.push("can-remove");
      }
      if (changed.has(node.index)) {
        classes.push("recent");
      }
      group.setAttribute("class", classes.join(" "));

      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("cx", String(point.x));
      circle.setAttribute("cy", String(point.y));
      circle.setAttribute("r", String(nodeRadius));
      if (!isTypeA) {
        circle.setAttribute("stroke-width", "1.6");
      }
      group.appendChild(circle);

      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("x", String(point.x));
      text.setAttribute("y", String(point.y + 1));
      text.setAttribute("font-size", String(nodeFontPx));
      text.textContent = String(node.label);
      group.appendChild(text);

      const title = document.createElementNS(SVG_NS, "title");
      title.textContent = `${nodeDisplay(node)}, label ${node.label}`;
      group.appendChild(title);

      const togglable = core.canAdd(state.currentMask, node.index, poset)
        || core.canRemove(state.currentMask, node.index, poset);
      group.style.cursor = (!animating && togglable) ? "pointer" : "not-allowed";
      group.addEventListener("click", () => applySingleNodeToggle(node.index));

      svg.appendChild(group);
    }
  }

  function renderCurrentState() {
    const poset = state.poset;
    const current = core.phi(state.currentMask, poset);

    const idealNodes = poset.nodes.filter((node) => core.hasBit(state.currentMask, node.index));
    const listedIdeal = idealNodes.length === 0
      ? EMPTY
      : idealNodes.map((node) => `${nodeDisplay(node)}[${node.label}]`).join(", ");

    const countsBySimpleRoot = Array(poset.n).fill(0);
    for (const node of idealNodes) {
      countsBySimpleRoot[node.label - 1] += 1;
    }

    const maximalInIdeal = idealNodes.filter((node) =>
      node.succs.every((succ) => !core.hasBit(state.currentMask, succ))
    );

    const sequence = current.order.map((index) => nodeDisplay(poset.nodes[index])).join(" \u2192 ");
    const extensionLabels = current.labels.length === 0 ? "empty" : current.labels.join(", ");
    const reflectionWord = reflectionWordFromLabels(current.labels);

    const idealRows = [
      ["|I|", String(idealNodes.length)],
      ["|max(I)|", String(maximalInIdeal.length)],
    ];
    for (let i = 0; i < countsBySimpleRoot.length; i += 1) {
      idealRows.push([`I<sup>${i + 1}</sup>`, String(countsBySimpleRoot[i])]);
    }

    ui.currentIdeal.innerHTML = [
      "<div class='state-key-title'>Order Ideal</div>",
      `<div class='state-key-main'>I = ${listedIdeal}</div>`,
      mathTable(idealRows),
      "<details class='math-details'>",
      "<summary>Definitions</summary>",
      "<div class='math-details-body'>",
      "<div class='math-line'>I<sup>i</sup> = #{x \u2208 I : label(x)=i}.</div>",
      "<div class='math-line'>max(I) = maximal elements of I in the poset order.</div>",
      "</div>",
      "</details>",
    ].join("");

    const fundamentalExpression = weightAsFundamental(current.weight);
    const weightRows = [
      ["Fundamental form", fundamentalExpression],
      ["[c<sub>1</sub>, ..., c<sub>n</sub>]", vectorString(current.weight)],
      ["Reflection word", `${reflectionWord}(${omegaSymbol(poset.k)})`],
    ];

    if (poset.type === "A") {
      const subset = subsetFromLabels(current.labels, poset.k, poset.n);
      const glWeight = glWeightFromSubset(subset, poset.n);
      const fundamentalFromSubset = fundamentalCoordinatesFromGlWeight(glWeight);
      const coordinatesAgree = core.sameArray(current.weight, fundamentalFromSubset);
      const quotientDelta = basisVectorSum(poset.n + 1);
      const quotientWeight = glWeightAsBasis(subset);
      const quotientClassText = `[${quotientWeight}] \u2208 \u039b`;

      ui.currentWeight.innerHTML = [
        "<div class='state-key-title'>Weight</div>",
        `<div class='state-key-main'>${PHI}(I) = ${quotientWeight}</div>`,
        mathTable(weightRows),
        "<details class='math-details'>",
        "<summary>Technical details</summary>",
        "<div class='math-details-body'>",
        `<div class='math-line'>Weight lattice: ${weightLatticeQuotientText(poset.n)} with \u03b4 = ${quotientDelta}. ${quotientClassText} means class of ${quotientWeight} modulo \u2124\u03b4.</div>`,
        `<div class='math-line'>Linear extension used: ${sequence || "empty sequence"}; labels [${extensionLabels}] (word shown in composition order).</div>`,
        `<div class='math-line'>Fundamental-weight coordinates: if ${PHI}(I) = \u2211 c<sub>i</sub>${omegaSymbol("i")}, then c<sub>i</sub> = \u27e8${PHI}(I), \u03b1<sub>i</sub><sup>\u2228</sup>\u27e9.</div>`,
        `<div class='math-line'>Subset occupancy m = ${vectorString(glWeight)} gives [m<sub>1</sub> - m<sub>2</sub>, ..., m<sub>n</sub> - m<sub>n+1</sub>] = ${vectorString(fundamentalFromSubset)} ${coordinatesAgree ? "<span class='ok'>(matches)</span>" : "<span class='warn'>(mismatch)</span>"}.</div>`,
        "</div>",
        "</details>",
      ].join("");

      const representationRows = [
        ["Representation", `V(${omegaSymbol(poset.k)}) = ${exteriorPowerNotation(poset.k, poset.n + 1)}`],
        ["Highest weight vector", wedgePrefix(poset.k)],
        ["Highest weight", omegaSymbol(poset.k)],
        ["Weight lattice", weightLatticeQuotientText(poset.n)],
        ["Type A subset S(I)", `{${subset.join(", ")}}`],
        ["Weight from S(I)", quotientWeight],
      ];

      ui.representationFacts.innerHTML = [
        "<div class='state-key-title'>Type A Minuscule Model</div>",
        mathTable(representationRows),
        "<div class='state-sub'>Interpretation: in type A, S(I) records chosen basis directions in the wedge basis; each chosen index contributes one e<sub>j</sub> to the weight.</div>",
        "<details class='math-details'>",
        "<summary>Equivalent sum-zero-hyperplane form</summary>",
        `<div class='math-details-body'><div class='math-line'>Inside E = {x \u2208 R<sup>${poset.n + 1}</sup> : \u2211 x<sub>i</sub> = 0}, the same weight is ${slWeightAsBasis(glWeight, poset.k, poset.n)}.</div></div>`,
        "</details>",
      ].join("");
      return;
    }

    ui.currentWeight.innerHTML = [
      "<div class='state-key-title'>Weight</div>",
      `<div class='state-key-main'>${PHI}(I) = ${fundamentalExpression}</div>`,
      mathTable(weightRows),
      "<details class='math-details'>",
      "<summary>Technical details</summary>",
      "<div class='math-details-body'>",
      `<div class='math-line'>Linear extension used: ${sequence || "empty sequence"}; labels [${extensionLabels}] (word shown in composition order).</div>`,
      `<div class='math-line'>Fundamental-weight coordinates: if ${PHI}(I) = \u2211 c<sub>i</sub>${omegaSymbol("i")}, then c<sub>i</sub> = \u27e8${PHI}(I), \u03b1<sub>i</sub><sup>\u2228</sup>\u27e9.</div>`,
      "</div>",
      "</details>",
    ].join("");

    const representation = poset.representation;
    const representationRows = [
      ["Representation", typesetMathText(representation.model)],
      ["Highest weight", typesetMathText(representation.highestWeight)],
      ["Dimension", String(poset.expectedIdeals)],
      ["Root labels", `1, 2, ..., ${poset.n}`],
    ];

    ui.representationFacts.innerHTML = [
      `<div class='state-key-title'>${typeSymbol(poset.type, poset.n)} Minuscule Model</div>`,
      mathTable(representationRows),
      ...representation.notes.map((note) => `<div class='state-sub'>${typesetMathText(note)}</div>`),
    ].join("");
  }

  function renderActionReport() {
    const action = state.lastAction;
    if (!action) {
      ui.actionReport.className = "report muted";
      ui.actionReport.textContent = "No action applied yet.";
      return;
    }

    if (action.type === "single-node") {
      ui.actionReport.className = "report muted";
      ui.actionReport.textContent = action.text;
      return;
    }

    const changedNodes = action.changedIndices.length === 0
      ? "none"
      : action.changedIndices.map((index) => nodeDisplay(state.poset.nodes[index])).join(", ");

    if (action.type === "root-toggle") {
      ui.actionReport.className = "report";
      ui.actionReport.innerHTML = [
        `<strong>Applied ${toggleSymbol(action.label)}</strong>`,
        `Changed nodes: ${changedNodes}`,
        `${PHI}(${toggleSymbol(action.label)}(I)) = ${vectorString(action.afterPhi.weight)}`,
        `${reflectionSymbol(action.label)}(${PHI}(I)) = ${vectorString(action.reflected)}`,
        action.matches
          ? "Result: <span class='ok'>MATCH (equivariant in this step)</span>"
          : "Result: <span class='warn'>MISMATCH</span>",
      ].join("<br>");
      return;
    }

    if (action.type === "fon-der-flaass") {
      ui.actionReport.className = "report";
      ui.actionReport.innerHTML = [
        "<strong>Applied Fon-Der-Flaass Action</strong>",
        `Rank order toggled: ${action.rankOrder.join(" \u2192 ")}`,
        `Changed nodes: ${changedNodes}`,
        `${PHI}(I) before = ${vectorString(action.beforePhi.weight)}`,
        `${PHI}(FDF(I)) = ${vectorString(action.afterPhi.weight)}`,
      ].join("<br>");
      return;
    }

    if (action.type === "coxeter") {
      const reflectionWord = wordAsReflectionString(action.word);
      ui.actionReport.className = "report";
      ui.actionReport.innerHTML = [
        `<strong>Applied ${action.elementName}</strong>`,
        `Coxeter element: ${reflectionWord}`,
        `Changed nodes: ${changedNodes}`,
        `${PHI}(c(I)) = ${vectorString(action.afterPhi.weight)}`,
        `${reflectionWord}(${PHI}(I)) = ${vectorString(action.reflected)}`,
        action.matches
          ? "Result: <span class='ok'>MATCH (equivariant word action)</span>"
          : "Result: <span class='warn'>MISMATCH</span>",
      ].join("<br>");
      return;
    }

    ui.actionReport.className = "report muted";
    ui.actionReport.textContent = "No action details available.";
  }

  function renderOrbitReport() {
    if (!state.orbitReport) {
      ui.orbitReport.className = "report muted";
      ui.orbitReport.textContent = "No orbit run yet.";
      return;
    }

    const report = state.orbitReport;
    const observed = report.observed;
    const predicted = report.predicted;

    const statsRows = [
      ["avg |I|", observed.avgSize, predicted.avgSize],
      ["avg |max(I)|", observed.avgAntichainSize, predicted.avgAntichainSize],
    ];

    for (let i = 0; i < state.poset.n; i += 1) {
      statsRows.push([`avg I<sup>${i + 1}</sup>`, observed.avgLabelCounts[i], predicted.avgLabelCounts[i]]);
    }

    const fixedObserved = observed.globalFixedPoints;
    const fixedPredicted = predicted.globalFixedPoints;
    const hasFixedPrediction = Number.isFinite(fixedPredicted);
    const fixedPass = hasFixedPrediction ? (fixedObserved === fixedPredicted) : null;

    const fixedSummary = [
      ["orbit length", String(observed.orbitLength)],
      ["fixed points in this orbit", String(observed.fixedPointsInOrbit)],
      [
        "global fixed points",
        hasFixedPrediction
          ? `${fixedObserved} (predicted ${fixedPredicted}) ${fixedPass ? "<span class='ok'>MATCH</span>" : "<span class='warn'>MISMATCH</span>"}`
          : `${fixedObserved} (<span class='muted'>no prediction shown for this action/type</span>)`,
      ],
    ];

    ui.orbitReport.className = "report";
    ui.orbitReport.innerHTML = [
      `<div class='state-key-title'>${report.actionLabel}</div>`,
      mathTable(fixedSummary),
      comparisonTable(statsRows),
      "<details class='math-details'>",
      "<summary>Prediction Source (Papers I-II)</summary>",
      "<div class='math-details-body'>",
      predictionSourceHtml({ report, poset: state.poset }),
      "</div>",
      "</details>",
    ].join("");
  }

  function renderGlobalReport() {
    if (!state.globalReport) {
      ui.globalReport.className = "report muted";
      ui.globalReport.textContent = "No global check yet.";
      return;
    }

    const report = state.globalReport;
    const rows = [
      `|J(P)| = ${report.idealsCount} (expected ${report.expectedCount})`,
      `Distinct weights = ${report.distinctWeights}`,
      `Dimension check: ${statusLabel(report.countMatchesDimension)}`,
      `Bijection check: ${statusLabel(report.bijective)}`,
      `Equivariance check: ${statusLabel(report.equivariant)}`,
      `Weight-orbit check: ${statusLabel(report.inOrbit)}`,
      `Cover-property check: ${statusLabel(report.labelStructure.overall.coverPropertyPass)}`,
      `Root-toggle order-independence check: ${statusLabel(report.labelStructure.overall.toggleOrderIndependencePass)}`,
    ];

    if (report.phiExtensionIndependence.ran) {
      rows.push(
        `${PHI} extension-independence check: ${statusLabel(report.phiExtensionIndependence.pass)} `
        + `(sampled up to ${report.phiExtensionIndependence.maxSamplesPerIdeal} extensions/ideal; `
        + `${report.phiExtensionIndependence.samplesChecked} samples checked)`
      );
    } else {
      rows.push(
        `${PHI} extension-independence check: <span class='muted'>SKIPPED</span> `
        + `(${escapeHtml(report.phiExtensionIndependence.skippedReason)})`
      );
    }

    if (report.duplicateWeight) {
      rows.push(
        `Duplicate weight ${vectorString(report.duplicateWeight.weight)} for ideals `
        + `${maskToIdeal(report.duplicateWeight.firstMask, state.poset)} and `
        + `${maskToIdeal(report.duplicateWeight.secondMask, state.poset)}`
      );
    }

    if (report.outOfOrbitWeight) {
      rows.push(
        `Weight out-of-orbit witness at I=${maskToIdeal(report.outOfOrbitWeight.mask, state.poset)}: `
        + `${vectorString(report.outOfOrbitWeight.weight)}`
      );
    }

    if (report.equivarianceFailure) {
      rows.push(
        `First equivariance failure at I=${maskToIdeal(report.equivarianceFailure.mask, state.poset)}, `
        + `i=${report.equivarianceFailure.label}: `
        + `${PHI}(${toggleSymbol(report.equivarianceFailure.label)}(I))=${vectorString(report.equivarianceFailure.lhs)} `
        + `vs ${reflectionSymbol(report.equivarianceFailure.label)}(${PHI}(I))=${vectorString(report.equivarianceFailure.rhs)}`
      );
    }

    if (report.labelStructure.coverCounterexample) {
      const ex = report.labelStructure.coverCounterexample;
      rows.push(
        `Cover-property counterexample for label ${ex.label}: `
        + `${nodeRef(ex.predIndex, state.poset)} -> ${nodeRef(ex.succIndex, state.poset)}`
      );
    }

    if (report.labelStructure.toggleCounterexample) {
      const ex = report.labelStructure.toggleCounterexample;
      rows.push(
        `Toggle-order counterexample for label ${ex.label} on I=${maskToIdeal(ex.idealMask, state.poset)}: `
        + `forward gives ${maskToIdeal(ex.forwardMask, state.poset)}, reverse gives ${maskToIdeal(ex.reverseMask, state.poset)}`
      );
    }

    if (report.phiExtensionIndependence.ran && !report.phiExtensionIndependence.pass) {
      const ex = report.phiExtensionIndependence.counterexample;
      rows.push(
        `${PHI}-independence counterexample on I=${maskToIdeal(ex.mask, state.poset)}: `
        + `base ${orderToNodeSequence(ex.baseOrder, state.poset)} gives ${vectorString(ex.baseWeight)}, `
        + `witness ${orderToNodeSequence(ex.witnessOrder, state.poset)} gives ${vectorString(ex.witnessWeight)}`
      );
    }

    rows.push(
      report.allChecksPass
        ? "<span class='ok'>All checks passed.</span>"
        : "<span class='warn'>Checks failed.</span>"
    );

    ui.globalReport.className = "report";
    ui.globalReport.innerHTML = rows.join("<br>");
  }

  function renderDeveloperNotes() {
    const analysis = state.globalReport?.labelStructure || state.structureAnalysis;
    if (!analysis) {
      ui.developerAnalysis.className = "report muted";
      ui.developerAnalysis.textContent = "No analysis yet.";
      return;
    }

    const poset = state.poset;
    const rows = [
      `<strong>Current parameters:</strong> ${typeSymbol(poset.type, poset.n)}, ${omegaSymbol(poset.k)}; ideals checked: ${analysis.idealsChecked}`,
      poset.type === "A"
        ? `<strong>Type A labeling:</strong> label(r,c) = k-r+c on P<sub>n,k</sub> = [k] × [n+1-k].`
        : "<strong>Construction:</strong> P is extracted as the join-irreducibles of the oriented minuscule weight lattice.",
      `Cover-property (same-label cover edges absent): ${statusLabel(analysis.overall.coverPropertyPass)}`,
      `Root-toggle order-independence (forward vs reverse per label): ${statusLabel(analysis.overall.toggleOrderIndependencePass)}`,
      "<strong>Per-label diagnostics:</strong>",
    ];

    for (const labelReport of analysis.labels) {
      rows.push(
        `label ${labelReport.label}: ${labelReport.nodeCount} node(s), `
        + `cover ${statusWord(labelReport.coverPropertyPass)}, `
        + `toggle-order ${statusWord(labelReport.toggleOrderIndependent)}`
      );
      if (labelReport.coverCounterexample) {
        rows.push(
          `&nbsp;&nbsp;cover witness: ${nodeRef(labelReport.coverCounterexample.predIndex, poset)} -> `
          + `${nodeRef(labelReport.coverCounterexample.succIndex, poset)}`
        );
      }
      if (labelReport.toggleCounterexample) {
        const ex = labelReport.toggleCounterexample;
        rows.push(
          `&nbsp;&nbsp;toggle witness on I=${maskToIdeal(ex.idealMask, poset)}: `
          + `forward ${maskToIdeal(ex.forwardMask, poset)} vs reverse ${maskToIdeal(ex.reverseMask, poset)}`
        );
      }
    }

    ui.developerAnalysis.className = "report";
    ui.developerAnalysis.innerHTML = rows.join("<br>");
  }

  function statusLabel(ok) {
    return ok ? "<span class='ok'>PASS</span>" : "<span class='warn'>FAIL</span>";
  }

  function statusWord(ok) {
    return ok ? "PASS" : "FAIL";
  }

  function typeSymbol(type, n) {
    return `${type}<sub>${n}</sub>`;
  }

  function vectorString(vector) {
    return `[${vector.join(", ")}]`;
  }

  function weightAsFundamental(weight) {
    const parts = [];
    for (let i = 0; i < weight.length; i += 1) {
      const coeff = weight[i];
      if (coeff === 0) {
        continue;
      }
      const basis = omegaSymbol(i + 1);
      const term = Math.abs(coeff) === 1 ? basis : `${Math.abs(coeff)}${basis}`;
      if (parts.length === 0) {
        parts.push(coeff < 0 ? `-${term}` : term);
      } else {
        parts.push(coeff < 0 ? `- ${term}` : `+ ${term}`);
      }
    }
    return parts.length === 0 ? "0" : parts.join(" ");
  }

  function nodeDisplay(node) {
    if (node.display) {
      return node.display;
    }
    if (Number.isInteger(node.row) && Number.isInteger(node.col)) {
      return `(${node.row},${node.col})`;
    }
    return `j${node.index + 1}`;
  }

  function subsetFromLabels(labels, k, n) {
    const present = Array(n + 2).fill(false);
    for (let i = 1; i <= k; i += 1) {
      present[i] = true;
    }
    for (const label of labels) {
      const left = label;
      const right = label + 1;
      const temp = present[left];
      present[left] = present[right];
      present[right] = temp;
    }
    const subset = [];
    for (let i = 1; i <= n + 1; i += 1) {
      if (present[i]) {
        subset.push(i);
      }
    }
    return subset;
  }

  function glWeightFromSubset(subset, n) {
    const entries = Array(n + 1).fill(0);
    for (const index of subset) {
      entries[index - 1] = 1;
    }
    return entries;
  }

  function fundamentalCoordinatesFromGlWeight(glWeight) {
    const coords = [];
    for (let i = 0; i < glWeight.length - 1; i += 1) {
      coords.push(glWeight[i] - glWeight[i + 1]);
    }
    return coords;
  }

  function maskToIdeal(mask, poset) {
    const parts = poset.nodes
      .filter((node) => core.hasBit(mask, node.index))
      .map((node) => nodeDisplay(node));
    return `{${parts.join(", ")}}`;
  }

  function nodeRef(index, poset) {
    const node = poset.nodes[index];
    return `${nodeDisplay(node)}[${node.label}]`;
  }

  function orderToNodeSequence(order, poset) {
    if (order.length === 0) {
      return "empty";
    }
    return order.map((index) => nodeRef(index, poset)).join(" -> ");
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function typesetMathText(text) {
    let out = escapeHtml(text);
    out = out.replace(/ω_([0-9a-z]+)/g, "ω<sub>$1</sub>");
    out = out.replace(/\b([ADE])_([0-9a-z]+)/g, "$1<sub>$2</sub>");
    out = out.replace(/e_([0-9a-z]+)/g, "e<sub>$1</sub>");
    out = out.replace(/∧\^([0-9]+)/g, "&bigwedge;<sup>$1</sup>");
    out = out.replace(/ℂ\^([0-9]+)/g, "ℂ<sup>$1</sup>");
    out = out.replace(/ℤ\^([0-9]+)/g, "ℤ<sup>$1</sup>");
    return out;
  }

  function parseCoxeterOrder(text, n) {
    if (!text) {
      return {
        ok: false,
        error: "Enter a permutation of 1..n (for example: 2 1 3).",
      };
    }

    const pieces = text
      .split(/[\s,>]+/)
      .map((piece) => piece.trim())
      .filter((piece) => piece.length > 0);

    const numbers = pieces.map((piece) => {
      const match = piece.match(/\d+/);
      return match ? Number(match[0]) : NaN;
    });

    if (numbers.some((value) => !Number.isInteger(value))) {
      return {
        ok: false,
        error: "Coxeter ordering must contain indices (for example: 2 1 3 or s2 s1 s3).",
      };
    }

    if (numbers.length !== n) {
      return {
        ok: false,
        error: `Need exactly ${n} entries, each used once.`,
      };
    }

    const used = new Set(numbers);
    if (used.size !== n) {
      return {
        ok: false,
        error: "Each simple reflection index must appear exactly once.",
      };
    }

    for (let i = 1; i <= n; i += 1) {
      if (!used.has(i)) {
        return {
          ok: false,
          error: `Missing index ${i}; expected a permutation of 1..${n}.`,
        };
      }
    }

    return {
      ok: true,
      word: numbers,
    };
  }

  function omegaSymbol(index) {
    return `${OMEGA}<sub>${index}</sub>`;
  }

  function reflectionSymbol(index) {
    return `s<sub>${index}</sub>`;
  }

  function toggleSymbol(index) {
    return `t<sub>${index}</sub>`;
  }

  function wordAsReflectionString(word) {
    if (word.length === 0) {
      return "id";
    }
    return word.map((label) => reflectionSymbol(label)).join(" ");
  }

  function wordAsPlainReflectionString(word) {
    if (word.length === 0) {
      return "id";
    }
    return word.map((label) => `s${label}`).join(" ");
  }

  function reflectionWordFromLabels(labels) {
    if (labels.length === 0) {
      return "id";
    }
    return labels.slice().reverse().map((label) => reflectionSymbol(label)).join(" ");
  }

  function basisVector(index) {
    return `e<sub>${index}</sub>`;
  }

  function wedgePrefix(k) {
    const terms = [];
    for (let i = 1; i <= k; i += 1) {
      terms.push(basisVector(i));
    }
    return terms.join(" \u2227 ");
  }

  function glWeightAsBasis(subset) {
    if (subset.length === 0) {
      return "0";
    }
    return subset.map((index) => basisVector(index)).join(" + ");
  }

  function basisVectorSum(count) {
    const terms = [];
    for (let i = 1; i <= count; i += 1) {
      terms.push(basisVector(i));
    }
    return terms.join(" + ");
  }

  function weightLatticeQuotientText(n) {
    const delta = basisVectorSum(n + 1);
    return `\u039b \u2245 \u2124<sup>${n + 1}</sup>/\u2124(${delta})`;
  }

  function exteriorPowerNotation(k, dim) {
    return `<span class='math-exterior'>&bigwedge;<sup>${k}</sup>(<span class='bb-c'>&Copf;</span><sup>${dim}</sup>)</span>`;
  }

  function comparisonTable(rows) {
    const body = rows.map(([name, observed, predicted]) => {
      const hasPrediction = Number.isFinite(predicted);
      const delta = hasPrediction ? observed - predicted : null;
      const pass = hasPrediction ? nearlyEqual(observed, predicted) : null;
      return [
        "<tr>",
        `<td class='key'>${name}</td>`,
        `<td>${formatNumber(observed)}</td>`,
        `<td>${hasPrediction ? formatNumber(predicted) : "<span class='muted'>N/A</span>"}</td>`,
        `<td>${hasPrediction ? formatSignedNumber(delta) : "<span class='muted'>N/A</span>"}</td>`,
        `<td>${hasPrediction ? (pass ? "<span class='ok'>MATCH</span>" : "<span class='warn'>MISMATCH</span>") : "<span class='muted'>N/A</span>"}</td>`,
        "</tr>",
      ].join("");
    }).join("");

    return [
      "<table class='comparison-table'>",
      "<thead><tr><th>Statistic</th><th>Observed</th><th>Predicted</th><th>&Delta;</th><th>Status</th></tr></thead>",
      `<tbody>${body}</tbody>`,
      "</table>",
    ].join("");
  }

  function predictionSourceHtml(context) {
    const report = context.report;
    const poset = context.poset;

    if (poset.type === "A") {
      return predictionSourceHtmlTypeA(report, poset);
    }
    return predictionSourceHtmlGeneral(report, poset);
  }

  function predictionSourceHtmlTypeA(report, poset) {
    const cspEvaluation = report.cspEvaluation;
    const order = poset.n + 1;
    const avgVector = labelAverageVectorValueHtml(poset.n, poset.k);
    const avgSizeValue = computedValue(exactRationalString(poset.k * (poset.n + 1 - poset.k), 2));
    const antichainValue = computedValue(exactRationalString(poset.k * (poset.n + 1 - poset.k), poset.n + 1));

    const antichainRow = report.actionKind === "fon-der-flaass"
      ? [
        "<tr>",
        "<td class='key'><span class='source-tag'>Paper II</span> avg |max(I)| (FDF)</td>",
        `<td class='formula'>${fractionHtml("k(n+1-k)", "n+1")} = ${antichainValue}</td>`,
        "</tr>",
      ].join("")
      : [
        "<tr>",
        "<td class='key'><span class='source-tag'>Paper II</span> avg |max(I)|</td>",
        "<td class='muted'>N/A for Coxeter motion in this report</td>",
        "</tr>",
      ].join("");

    const fixedPointRows = cspEvaluation
      ? [
        `<tr><td class='key'><span class='source-tag'>Paper I</span> q-binomial coefficient</td><td class='formula'>${qBinomialProductHtml(order, poset.k)}</td></tr>`,
        `<tr><td class='key'><span class='source-tag'>Paper I</span> expanded polynomial</td><td class='formula q-poly'>${qBinomialPolynomialHtml(cspEvaluation.coefficients)}</td></tr>`,
        `<tr><td class='key'><span class='source-tag'>Paper I</span> one-step fixed-point prediction</td><td class='formula'>${cspClosedFormStepHtml(cspEvaluation, poset)}</td></tr>`,
      ].join("")
      : [
        "<tr>",
        "<td class='key'><span class='source-tag'>Paper I</span> one-step fixed-point prediction</td>",
        "<td class='muted'>No fixed-point prediction available for this report.</td>",
        "</tr>",
      ].join("");

    return [
      `<div class='prediction-context'>Recall: <strong>A<sub>${poset.n}</sub></strong> with <strong>k = ${poset.k}</strong> (highest weight ${omegaSymbol(poset.k)}).</div>`,
      "<table class='prediction-table'>",
      "<tbody>",
      `<tr><td class='key'><span class='source-tag'>Paper II</span> avg I<sup>i</sup></td><td class='formula'>(${omegaSymbol(poset.k)}, ${omegaSymbol("i")}) = (C<sup>-1</sup>)<sub>i,k</sub> = ${fractionHtml("min(i,k) · (n+1-max(i,k))", "n+1")}</td></tr>`,
      `<tr><td class='key'><span class='source-tag'>Paper II</span> (avg I<sup>1</sup>,...,avg I<sup>n</sup>)</td><td class='formula'>= ${avgVector}</td></tr>`,
      `<tr><td class='key'><span class='source-tag'>Paper II</span> avg |I|</td><td class='formula'>${fractionHtml("k(n+1-k)", "2")} = ${avgSizeValue}</td></tr>`,
      antichainRow,
      fixedPointRows,
      "</tbody>",
      "</table>",
      "<div class='source-footnote'><strong>Notation:</strong> C is the Cartan matrix, P is the selected minuscule poset, |P| is its number of elements, J(P) is the set of order ideals, and h is the Coxeter number.</div>",
      "<div class='source-footnote'>Type A fixed points are evaluated by the closed-form CSP specialization; the expanded q-polynomial is shown for transparency.</div>",
      citationHtml(),
    ].join("");
  }

  function predictionSourceHtmlGeneral(report, poset) {
    const avgVector = inverseCartanVectorHtml(poset.inverseCartanColumnFractions);
    const avgSize = computedValue(formatRationalFraction(sumFractions(poset.inverseCartanColumnFractions)));
    const antichain = computedValue(formatRational(poset.nodes.length, poset.coxeterNumber));

    const antichainRow = report.actionKind === "fon-der-flaass"
      ? `<tr><td class='key'><span class='source-tag'>Paper II</span> avg |max(I)| (FDF)</td><td class='formula'>|P|/h = ${antichain}</td></tr>`
      : "<tr><td class='key'><span class='source-tag'>Paper II</span> avg |max(I)|</td><td class='muted'>N/A for Coxeter motion in this report</td></tr>";

    const fixedPointRows = report.cspEvaluation
      ? [
        "<tr><td class='key'><span class='source-tag'>Paper I</span> rank-generating polynomial</td><td class='formula'>M<sub>P</sub>(q) = \u2211<sub>I\u2208J(P)</sub> q<sup>|I|</sup></td></tr>",
        `<tr><td class='key'><span class='source-tag'>Paper I</span> expanded M<sub>P</sub>(q)</td><td class='formula q-poly'>${qBinomialPolynomialHtml(report.cspEvaluation.coefficients)}</td></tr>`,
        `<tr><td class='key'><span class='source-tag'>Paper I</span> one-step fixed-point prediction</td><td class='formula'>${cspRankGeneratingStepHtml(report.cspEvaluation, poset)}</td></tr>`,
      ].join("")
      : "<tr><td class='key'><span class='source-tag'>Paper I</span> fixed-point formula</td><td class='muted'>No fixed-point prediction available for this report.</td></tr>";

    return [
      `<div class='prediction-context'>Recall: <strong>${typeSymbol(poset.type, poset.n)}</strong> with <strong>k = ${poset.k}</strong> (highest weight ${omegaSymbol(poset.k)}).</div>`,
      "<table class='prediction-table'>",
      "<tbody>",
      `<tr><td class='key'><span class='source-tag'>Paper II</span> avg I<sup>i</sup></td><td class='formula'>(${omegaSymbol(poset.k)}, ${omegaSymbol("i")}) = (C<sup>-1</sup>)<sub>i,k</sub></td></tr>`,
      `<tr><td class='key'><span class='source-tag'>Paper II</span> (avg I<sup>1</sup>,...,avg I<sup>n</sup>)</td><td class='formula'>= ${avgVector}</td></tr>`,
      `<tr><td class='key'><span class='source-tag'>Paper II</span> avg |I|</td><td class='formula'>\u2211<sub>i</sub>(C<sup>-1</sup>)<sub>i,k</sub> = ${avgSize}</td></tr>`,
      antichainRow,
      fixedPointRows,
      "</tbody>",
      "</table>",
      `<div class='source-footnote'><strong>Notation:</strong> C = Cartan matrix, P = current minuscule poset, |P| = number of poset elements, J(P) = order ideals, h = ${poset.coxeterNumber} (Coxeter number for ${typeSymbol(poset.type, poset.n)}).</div>`,
      "<div class='source-footnote'>For these ADE types, C is symmetric, so (ω<sub>k</sub>,ω<sub>i</sub>) = (C<sup>-1</sup>)<sub>i,k</sub>. Paper I fixed points are computed from M<sub>P</sub>(q) at q = exp(2πi/h).</div>",
      citationHtml(),
    ].join("");
  }

  function citationHtml() {
    return [
      "<div class='citation-title'>Citations</div>",
      "<div class='citation-line'><span class='source-tag'>Paper I</span> D. B. Rush, X. Shi, <em>On Orbits of Order Ideals of Minuscule Posets</em>, <a href='https://arxiv.org/abs/1108.5245' target='_blank' rel='noopener noreferrer'>arXiv:1108.5245</a>.</div>",
      "<div class='citation-line'><span class='source-tag'>Paper II</span> D. B. Rush, K. Wang, <em>On Orbits of Order Ideals of Minuscule Posets II: Homomesy</em>, <a href='https://arxiv.org/abs/1509.08047' target='_blank' rel='noopener noreferrer'>arXiv:1509.08047</a>.</div>",
    ].join("");
  }

  function fractionHtml(numerator, denominator) {
    return [
      "<span class='frac'>",
      `<span class='num'>${numerator}</span>`,
      `<span class='den'>${denominator}</span>`,
      "</span>",
    ].join("");
  }

  function qBinomialProductHtml(order, k) {
    const numeratorFactors = [];
    const denominatorFactors = [];
    for (let j = 1; j <= k; j += 1) {
      numeratorFactors.push(`(1 - ${qPowerHtml(order - k + j)})`);
      denominatorFactors.push(`(1 - ${qPowerHtml(j)})`);
    }
    return [
      "<span class='q-product'>",
      fractionHtml(numeratorFactors.join(" · "), denominatorFactors.join(" · ")),
      "</span>",
    ].join(" ");
  }

  function qPowerHtml(exponent) {
    return exponent === 1 ? "q" : `q<sup>${exponent}</sup>`;
  }

  function qBinomialPolynomialHtml(coefficients) {
    if (!Array.isArray(coefficients) || coefficients.length === 0) {
      return "0";
    }

    const terms = [];
    for (let exp = coefficients.length - 1; exp >= 0; exp -= 1) {
      const coeff = coefficients[exp];
      if (coeff === 0) {
        continue;
      }
      if (exp === 0) {
        terms.push(String(coeff));
        continue;
      }
      const qTerm = exp === 1 ? "q" : `q<sup>${exp}</sup>`;
      terms.push(coeff === 1 ? qTerm : `${coeff}${qTerm}`);
    }
    return terms.join(" + ");
  }

  function labelAverageVectorValueHtml(n, k) {
    const entries = [];
    for (let i = 1; i <= n; i += 1) {
      const numerator = Math.min(i, k) * (n + 1 - Math.max(i, k));
      const denominator = n + 1;
      entries.push(computedValue(exactRationalString(numerator, denominator)));
    }
    return `(${entries.join(", ")})`;
  }

  function inverseCartanVectorHtml(fractions) {
    return `(${fractions.map((frac) => computedValue(formatRationalFraction(frac))).join(", ")})`;
  }

  function sumFractions(fractions) {
    let num = 0;
    let den = 1;
    for (const frac of fractions) {
      num = num * frac.den + frac.num * den;
      den = den * frac.den;
      const g = gcd(Math.abs(num), Math.abs(den));
      num /= g;
      den /= g;
    }
    return { num, den };
  }

  function formatRationalFraction(frac) {
    if (frac.den === 1) {
      return String(frac.num);
    }
    return `${frac.num}/${frac.den}`;
  }

  function formatRational(numerator, denominator) {
    return exactRationalString(numerator, denominator);
  }

  function exactRationalString(numerator, denominator) {
    if (denominator === 0) {
      return "undefined";
    }
    if (numerator === 0) {
      return "0";
    }

    const sign = numerator * denominator < 0 ? "-" : "";
    let top = Math.abs(numerator);
    let bottom = Math.abs(denominator);
    const g = gcd(top, bottom);
    top = top / g;
    bottom = bottom / g;
    if (bottom === 1) {
      return `${sign}${top}`;
    }
    return `${sign}${top}/${bottom}`;
  }

  function computedValue(valueText) {
    return `<span class='computed-value'>${valueText}</span>`;
  }

  function cspClosedFormStepHtml(cspEvaluation, poset) {
    const order = poset.n + 1;
    const power = cspEvaluation.power;
    const d = cspEvaluation.gcdValue;
    const r = cspEvaluation.rootOrder;
    const prefix = `q = exp(2πi/${order})`;

    if (!cspEvaluation.divisible) {
      return `${prefix}: d = gcd(${order}, ${power}) = ${d}, r = ${order}/${d} = ${r}, and r &nmid; k, so ${computedValue(String(cspEvaluation.fixedPoints))}.`;
    }

    const qk = cspEvaluation.quotientK;
    return `${prefix}: d = gcd(${order}, ${power}) = ${d}, r = ${order}/${d} = ${r}, so binomial(d, k/r) = binomial(${d}, ${qk}) = ${computedValue(String(cspEvaluation.fixedPoints))}.`;
  }

  function cspRankGeneratingStepHtml(cspEvaluation, poset) {
    const h = poset.coxeterNumber;
    const power = cspEvaluation.power;
    const exponent = power === 1 ? `2\u03c0i/${h}` : `2\u03c0i\u00b7${power}/${h}`;
    const base = `M<sub>P</sub>(exp(${exponent})) = ${computedValue(String(cspEvaluation.fixedPoints))}`;
    const evalData = cspEvaluation.evaluation;
    if (!evalData || evalData.numericStable) {
      return base;
    }
    return `${base} (numeric eval ${formatNumber(evalData.real)} + ${formatNumber(evalData.imag)}i before rounding)`;
  }

  function mathTable(rows) {
    const body = rows.map(([key, value]) =>
      `<tr><td class='key'>${key}</td><td>${value}</td></tr>`
    ).join("");
    return `<table class='math-table'>${body}</table>`;
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) {
      return String(value);
    }
    if (Number.isInteger(value)) {
      return String(value);
    }
    return value.toFixed(6).replace(/\.?0+$/, "");
  }

  function formatSignedNumber(value) {
    const formatted = formatNumber(Math.abs(value));
    if (value > 0) {
      return `+${formatted}`;
    }
    if (value < 0) {
      return `-${formatted}`;
    }
    return "0";
  }

  function nearlyEqual(a, b, epsilon) {
    const eps = epsilon === undefined ? 1e-9 : epsilon;
    return Math.abs(a - b) <= eps;
  }

  function slWeightAsBasis(glWeight, k, n) {
    const denominator = n + 1;
    const pieces = [];

    for (let i = 0; i < glWeight.length; i += 1) {
      const numerator = glWeight[i] * denominator - k;
      if (numerator === 0) {
        continue;
      }
      pieces.push({
        numerator,
        basis: basisVector(i + 1),
      });
    }

    if (pieces.length === 0) {
      return "0";
    }

    let out = "";
    for (let idx = 0; idx < pieces.length; idx += 1) {
      const piece = pieces[idx];
      const sign = piece.numerator < 0 ? "-" : "+";
      const absNumerator = Math.abs(piece.numerator);
      const gcdValue = gcd(absNumerator, denominator);
      const p = absNumerator / gcdValue;
      const q = denominator / gcdValue;
      const coeff = q === 1 ? String(p) : `${p}/${q}`;
      const coeffText = coeff === "1" ? "" : coeff;
      const term = `${coeffText}${piece.basis}`;

      if (idx === 0) {
        out += sign === "-" ? `-${term}` : term;
      } else {
        out += ` ${sign} ${term}`;
      }
    }

    return out;
  }

  function gcd(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
      const t = x % y;
      x = y;
      y = t;
    }
    return x || 1;
  }

  global.MinusculeUI = {
    init,
  };
})(window);
