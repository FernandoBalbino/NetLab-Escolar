(function () {
  "use strict";

  var NetLab = window.NetLab = window.NetLab || {};
  var feedbackTimer = 0;
  var previousSpaceTool = null;
  var activeExerciseModule = null;
  var exercisePanelOpen = false;
  var toolLabels = {
    select: "Selecionar",
    pan: "Mover espaço",
    "add-internet": "Adicionar Internet",
    "add-router": "Adicionar roteador",
    "add-pc": "Adicionar computador",
    "add-switch": "Adicionar switch",
    cable: "Adicionar cabo",
    "add-bus": "Adicionar barramento",
    communication: "Testar comunicação"
  };
  var topologyNames = { star: "estrela", bus: "barramento", ring: "anel", mesh: "malha completa", tree: "árvore" };

  function hasElements() {
    return NetLab.State.data.nodes.length > 0 || NetLab.State.data.connections.length > 0 || NetLab.State.data.buses.length > 0;
  }

  function feedback(type, title, message) {
    var panel = document.getElementById("feedback");
    panel.className = "feedback is-" + (type || "info");
    document.getElementById("feedback-icon").textContent = type === "success" ? "✓" : type === "error" ? "!" : type === "warning" ? "?" : "i";
    document.getElementById("feedback-title").textContent = title;
    document.getElementById("feedback-message").textContent = message;
    panel.hidden = false;
    window.clearTimeout(feedbackTimer);
    feedbackTimer = window.setTimeout(function () { panel.hidden = true; }, type === "success" ? 6500 : 8000);
  }

  function hideFeedback() {
    window.clearTimeout(feedbackTimer);
    document.getElementById("feedback").hidden = true;
  }

  function makeButton(label, className) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    return button;
  }

  function renderChallengeList(module) {
    var list = document.getElementById(module.id + "-challenge-list");
    var fragment = document.createDocumentFragment();
    var current = NetLab.State.data.challenge;
    var completedCount = 0;
    NetLab.Challenges.list(module.id).forEach(function (challenge) {
      var unlocked = NetLab.Challenges.isUnlocked(challenge.id);
      var completed = NetLab.State.data.progress.completed[challenge.id];
      if (completed) completedCount += 1;
      var card = document.createElement("article");
      card.className = "challenge-card" + (current === challenge.id ? " is-active" : "") + (!unlocked ? " is-locked" : "");
      var head = document.createElement("div");
      head.className = "challenge-card__head";
      var name = document.createElement("strong");
      name.textContent = challenge.step ? "Etapa " + challenge.step + " · " + challenge.name : challenge.name;
      var status = document.createElement("span");
      status.className = "challenge-state" + (completed ? " is-done" : "");
      status.textContent = completed ? "Concluída" : unlocked ? challenge.minimum : "Bloqueada";
      head.appendChild(name);
      head.appendChild(status);
      var description = document.createElement("p");
      description.textContent = challenge.short;
      var button = makeButton(current === challenge.id ? "Desafio ativo" : "Iniciar desafio", current === challenge.id ? "secondary-button" : "add-button");
      button.dataset.challenge = challenge.id;
      button.disabled = !unlocked || current === challenge.id;
      button.setAttribute("aria-label", (current === challenge.id ? "Desafio ativo: " : "Iniciar desafio de ") + challenge.name);
      card.appendChild(head);
      card.appendChild(description);
      card.appendChild(button);
      fragment.appendChild(card);
    });
    list.replaceChildren(fragment);
    document.getElementById(module.id + "-challenge-count").textContent = completedCount + "/" + module.order.length;
  }

  function renderChallenges() {
    var selectedModule = null;
    NetLab.Challenges.modules().forEach(function (module) {
      renderChallengeList(module);
      var section = document.querySelector('[data-learning-module="' + module.id + '"]');
      var list = document.getElementById(module.id + "-challenge-list");
      var toggle = document.querySelector('[data-challenge-module="' + module.id + '"]');
      var isOpen = activeExerciseModule === module.id;
      if (isOpen) selectedModule = module;
      section.classList.toggle("is-open", isOpen);
      list.hidden = !isOpen;
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      toggle.textContent = "Abrir exercícios";
    });

    var popup = document.getElementById("exercise-module-popup");
    var overview = document.querySelector(".exercise-panel__scroll");
    popup.hidden = !selectedModule;
    popup.inert = !selectedModule;
    popup.setAttribute("aria-hidden", selectedModule ? "false" : "true");
    overview.inert = Boolean(selectedModule);
    overview.setAttribute("aria-hidden", selectedModule ? "true" : "false");
    if (!selectedModule) return;

    var moduleCard = document.querySelector('[data-learning-module="' + selectedModule.id + '"]');
    document.getElementById("exercise-module-step").textContent = moduleCard.querySelector(".learning-module__step").textContent;
    document.getElementById("exercise-module-title").textContent = selectedModule.name;
    document.getElementById("exercise-module-description").textContent = selectedModule.short;
    document.getElementById("exercise-module-count").textContent = document.getElementById(selectedModule.id + "-challenge-count").textContent;
  }

  function openExerciseModule(moduleId) {
    activeExerciseModule = moduleId;
    renderChallenges();
    window.setTimeout(function () { document.getElementById("exercise-module-back").focus(); }, 0);
  }

  function closeExerciseModulePopup(restoreFocus) {
    var moduleId = activeExerciseModule;
    activeExerciseModule = null;
    renderChallenges();
    if (restoreFocus && moduleId) {
      window.setTimeout(function () {
        var toggle = document.querySelector('[data-challenge-module="' + moduleId + '"]');
        if (toggle) toggle.focus();
      }, 0);
    }
  }

  function renderProgress() {
    var fragment = document.createDocumentFragment();
    NetLab.Challenges.modules().forEach(function (module) {
      var group = document.createElement("section");
      group.className = "progress-group";
      var heading = document.createElement("strong");
      heading.className = "progress-group__title";
      heading.textContent = module.name;
      group.appendChild(heading);
      NetLab.Challenges.list(module.id).forEach(function (challenge) {
        var completed = NetLab.State.data.progress.completed[challenge.id];
        var score = NetLab.State.data.progress.bestScores[challenge.id] || 0;
        var row = document.createElement("div");
        row.className = "progress-item" + (completed ? " is-done" : "");
        var check = document.createElement("span");
        check.className = "progress-check";
        check.textContent = completed ? "✓" : "·";
        check.setAttribute("aria-hidden", "true");
        var name = document.createElement("span");
        name.textContent = challenge.name + (completed ? " concluída" : " pendente");
        var scoreLabel = document.createElement("span");
        scoreLabel.className = "progress-score";
        scoreLabel.textContent = score ? score + " pts" : "—";
        row.appendChild(check);
        row.appendChild(name);
        row.appendChild(scoreLabel);
        group.appendChild(row);
      });
      fragment.appendChild(group);
    });
    document.getElementById("progress-list").replaceChildren(fragment);
  }

  function selectedDescription() {
    var selected = NetLab.State.data.selected;
    if (!selected) return "Nenhum item selecionado";
    if (selected.kind === "node") {
      var node = NetLab.State.getNode(selected.id);
      return node ? node.name : "Equipamento";
    }
    if (selected.kind === "bus") {
      var bus = NetLab.State.getBus(selected.id);
      return bus ? bus.name : "Barramento";
    }
    return selected.kind === "connection" ? "Cabo selecionado" : "Ligação do barramento";
  }

  function renderInspector() {
    var selected = NetLab.State.data.selected;
    var inspector = document.getElementById("inspector");
    var row = inspector.querySelector(".rename-row");
    var label = document.getElementById("rename-label");
    var input = document.getElementById("rename-input");
    var cityRow = document.getElementById("router-city-row");
    if (!selected) { inspector.hidden = true; cityRow.hidden = true; return; }
    inspector.hidden = false;
    var node = selected.kind === "node" ? NetLab.State.getNode(selected.id) : null;
    row.hidden = !node;
    label.hidden = !node;
    if (node) {
      document.getElementById("inspector-title").textContent = { pc: "Computador", switch: "Switch", router: "Roteador", internet: "Internet" }[node.type] || "Equipamento";
      if (document.activeElement !== input) input.value = node.name;
    } else document.getElementById("inspector-title").textContent = selected.kind === "bus" ? "Barramento" : "Cabo";
    cityRow.hidden = !(node && node.type === "router");
    if (node && node.type === "router") document.getElementById("router-city").value = NetLab.NetworkScope.sanitizeCity(node.city);
  }

  function renderActiveChallenge() {
    var id = NetLab.State.data.challenge;
    var definition = NetLab.Challenges.get(id);
    document.getElementById("active-challenge-title").textContent = definition ? definition.name : "Modo livre";
    document.getElementById("active-challenge-description").textContent = definition ? definition.objective : "Monte qualquer rede e use a verificação para identificar a topologia.";
    document.getElementById("score-badge").textContent = definition ? NetLab.Challenges.score() + " pts" : "—";
    document.getElementById("ask-hint").disabled = !definition;
    document.getElementById("status-challenge").textContent = definition ? "Desafio: " + definition.name : "Modo livre";
    var quiz = document.getElementById("classification-quiz");
    var isQuiz = id === "types-complete" && NetLab.State.data.challengeData;
    quiz.hidden = !isQuiz;
    if (isQuiz) {
      var data = NetLab.State.data.challengeData;
      document.getElementById("classification-scenario").textContent = "Cenário " + ["A", "B", "C"][data.quizScenario] + " de 3";
      document.getElementById("classification-submit").disabled = Boolean(data.quizComplete);
      document.getElementById("classification-answer").disabled = Boolean(data.quizComplete);
      document.getElementById("classification-message").textContent = data.quizComplete
        ? "Três respostas corretas. Clique em Verificar para concluir."
        : "Observe os equipamentos, as portas e as cidades antes de responder.";
    }

    var macQuiz = document.getElementById("mac-destination-quiz");
    var isMacQuiz = id === "mac-destination" && NetLab.State.data.challengeData;
    macQuiz.hidden = !isMacQuiz;
    if (isMacQuiz) {
      var macData = NetLab.State.data.challengeData;
      var source = NetLab.State.getNode(macData.macSourceId);
      var target = NetLab.State.getNode(macData.macTargetId);
      if (!source || !target) { macQuiz.hidden = true; return; }
      document.getElementById("mac-destination-question").textContent = source.name + " enviará um quadro para " + target.name + ". Qual MAC deve ir no campo de destino?";
      var macSelect = document.getElementById("mac-destination-answer");
      var placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Selecione o destinatário";
      var options = [placeholder];
      [source, target].forEach(function (node) {
        var option = document.createElement("option");
        option.value = node.macAddress;
        option.textContent = node.name + " — " + node.macAddress;
        options.push(option);
      });
      macSelect.replaceChildren.apply(macSelect, options);
      macSelect.disabled = Boolean(macData.macQuizComplete);
      document.getElementById("mac-destination-submit").disabled = Boolean(macData.macQuizComplete);
      document.getElementById("mac-destination-message").textContent = macData.macQuizComplete
        ? "Destino identificado. Clique em Verificar para concluir."
        : "O endereço de destino identifica a placa que deve receber o quadro.";
    }
  }

  function setScopeResult(id, active, text) {
    var item = document.getElementById(id);
    item.classList.toggle("is-detected", active);
    item.querySelector("span").textContent = text;
  }

  function shouldShowNetworkAnalysis(challenge) {
    return challenge !== "types-complete" && NetLab.Challenges.moduleFor(challenge) === "types";
  }

  function renderNetworkAnalysis() {
    var section = document.getElementById("network-analysis");
    var visible = shouldShowNetworkAnalysis(NetLab.State.data.challenge);
    section.hidden = !visible;
    if (!visible) return;
    var analysis = NetLab.NetworkScope.classifyNetworkScope(NetLab.State.captureProject());
    var validLans = analysis.validLocalNetworks;
    setScopeResult("scope-lan", analysis.hasLAN, analysis.hasLAN
      ? (validLans.length === 1
        ? validLans[0].deviceIds.length + " dispositivos na rede local" + (validLans[0].routerId ? " do " + NetLab.State.getNode(validLans[0].routerId).name : "")
        : validLans.length + " redes locais válidas")
      : "Conecte um equipamento final a um roteador ou switch");
    setScopeResult("scope-man", analysis.hasMAN, analysis.hasMAN
      ? analysis.metropolitanLinks.map(function (link) { return link.label; }).join(" · ")
      : "Exige duas LANs conectadas na mesma cidade");
    setScopeResult("scope-wan", analysis.hasWAN, analysis.hasWAN
      ? analysis.wideAreaLinks.map(function (link) { return link.label; }).join(" · ")
      : "Exige Internet na WAN ou LANs conectadas entre cidades");
    document.getElementById("network-analysis-summary").textContent = analysis.classifications.join(" + ") || "Nenhuma";
    var warning = document.getElementById("network-analysis-warning");
    warning.hidden = !analysis.warnings.length;
    warning.textContent = analysis.warnings.slice(0, 2).join(" ");
  }

  function renderToolbar() {
    var state = NetLab.State.data;
    document.querySelectorAll("[data-tool]").forEach(function (button) { button.classList.toggle("is-active", button.dataset.tool === state.tool); });
    var undo = document.querySelector('[data-action="undo"]');
    var redo = document.querySelector('[data-action="redo"]');
    undo.disabled = !NetLab.History.canUndo();
    redo.disabled = !NetLab.History.canRedo();
    document.querySelector('[data-action="delete"]').disabled = !state.selected;
    document.getElementById("workspace").dataset.tool = state.tool;
    document.getElementById("status-tool").textContent = toolLabels[state.tool] || "Ferramenta";
    document.getElementById("status-selection").textContent = selectedDescription();
    document.getElementById("status-zoom").textContent = Math.round(state.zoom * 100) + "%";
  }

  function renderSidebarState() {
    var collapsed = NetLab.State.data.preferences.sidebarCollapsed;
    document.getElementById("app").classList.toggle("is-sidebar-collapsed", collapsed);
    var toggle = document.getElementById("sidebar-toggle");
    toggle.setAttribute("aria-label", collapsed ? "Abrir painel lateral" : "Recolher painel lateral");
    toggle.dataset.tooltip = collapsed ? "Abrir painel" : "Recolher painel";
  }

  function setExercisePanel(open, restoreFocus) {
    exercisePanelOpen = Boolean(open);
    if (!exercisePanelOpen && activeExerciseModule) {
      activeExerciseModule = null;
      renderChallenges();
    }
    var panel = document.getElementById("exercise-panel");
    var toggle = document.getElementById("exercise-panel-toggle");
    panel.classList.toggle("is-open", exercisePanelOpen);
    panel.setAttribute("aria-hidden", exercisePanelOpen ? "false" : "true");
    panel.inert = !exercisePanelOpen;
    toggle.setAttribute("aria-expanded", exercisePanelOpen ? "true" : "false");
    toggle.setAttribute("aria-label", exercisePanelOpen ? "Fechar trilhas de exercícios" : "Abrir trilhas de exercícios");
    toggle.dataset.tooltip = exercisePanelOpen ? "Fechar trilhas de exercícios" : "Abrir trilhas de exercícios";
    document.body.classList.toggle("is-exercise-panel-open", exercisePanelOpen);

    if (exercisePanelOpen) {
      if (window.innerWidth <= 760 && !NetLab.State.data.preferences.sidebarCollapsed) {
        NetLab.State.data.preferences.sidebarCollapsed = true;
        NetLab.State.emit("preferences");
      }
      window.setTimeout(function () { document.getElementById("exercise-panel-close").focus(); }, 0);
    } else if (restoreFocus) toggle.focus();
  }

  function renderAll() {
    renderChallenges();
    renderProgress();
    renderInspector();
    renderActiveChallenge();
    renderNetworkAnalysis();
    renderToolbar();
    renderSidebarState();
  }

  function setTool(tool) {
    NetLab.State.setTool(tool);
    var hints = {
      select: "Clique em um item para selecionar e arraste para mover.",
      pan: "Arraste o fundo para mover o espaço de trabalho.",
      "add-internet": "Clique no espaço de trabalho para posicionar a fonte de Internet.",
      "add-router": "Clique no espaço de trabalho para posicionar um roteador.",
      "add-pc": "Clique no espaço de trabalho para posicionar um computador.",
      "add-switch": "Clique no espaço de trabalho para posicionar um switch.",
      cable: NetLab.PortModel.isPortChallenge(NetLab.State.data.challenge)
        ? "Escolha uma porta livre no roteador ou switch. PCs precisam de placa de rede."
        : "Clique no equipamento de origem e depois no destino. PCs precisam de placa de rede.",
      "add-bus": "Clique no espaço de trabalho para criar o barramento."
    };
    if (hints[tool]) NetLab.Workspace.showHint(hints[tool]);
  }

  function verifyTopology() {
    var validation = NetLab.Challenges.validateCurrent();
    if (validation.valid) {
      NetLab.Workspace.celebrate();
      if (NetLab.State.data.challenge === "free") {
        feedback("success", "Topologia reconhecida", "Você criou uma topologia em " + topologyNames[validation.topology] + ".");
      } else {
        var definition = NetLab.Challenges.get(NetLab.State.data.challenge);
        var next = validation.nextUnlocked ? " O próximo exercício foi liberado." : " Você concluiu todos os exercícios desta trilha!";
        var message = definition.success || "Você criou corretamente uma topologia em " + definition.name.toLowerCase() + ".";
        feedback("success", "Parabéns! " + validation.score + " pontos", message + next);
      }
      return;
    }
    var title = validation.details && validation.details.classification === "malha parcial" ? "Malha parcial" : "Ainda não está pronta";
    feedback("warning", title, validation.hints.slice(0, 2).join(" ") || "Revise os equipamentos e conexões.");
  }

  function startChallenge(id) {
    if (hasElements() && !window.confirm("Iniciar este desafio limpará a área de trabalho atual. Deseja continuar?")) return;
    if (NetLab.Challenges.start(id)) {
      var challenge = NetLab.Challenges.get(id);
      feedback("info", "Desafio iniciado", challenge.objective);
      setExercisePanel(false, false);
      if (window.innerWidth <= 760) {
        NetLab.State.data.preferences.sidebarCollapsed = true;
        NetLab.State.emit("preferences");
      }
    }
  }

  function restartChallenge() {
    if (hasElements() && !window.confirm("Reiniciar removerá os elementos atuais, mas manterá seu progresso. Continuar?")) return;
    NetLab.Challenges.restart();
    feedback("info", "Desafio reiniciado", "A área foi limpa. Sua melhor pontuação continua salva.");
  }

  function clearProject() {
    if (!hasElements()) return;
    if (!window.confirm("Remover todos os equipamentos, cabos e barramentos desta área?")) return;
    NetLab.Devices.clearCanvas(true);
    feedback("info", "Área limpa", "O desafio atual e seu progresso foram preservados.");
  }

  function handleAction(action) {
    if (action === "delete") {
      if (!NetLab.Devices.removeSelected()) feedback("warning", "Nada selecionado", "Selecione um equipamento, cabo ou barramento para excluir.");
    }
    if (action === "undo") NetLab.History.undo();
    if (action === "redo") NetLab.History.redo();
    if (action === "zoom-in") NetLab.Workspace.zoomBy(.15);
    if (action === "zoom-out") NetLab.Workspace.zoomBy(-.15);
    if (action === "fit") NetLab.Workspace.fitToScreen();
    if (action === "clear") clearProject();
    if (action === "verify") verifyTopology();
    if (action === "communicate") NetLab.Communication.start();
  }

  function isTyping(event) {
    var target = event.target;
    return target && (target.matches("input, textarea, select") || target.isContentEditable);
  }

  function onKeyDown(event) {
    if (event.key === "Escape" && activeExerciseModule) {
      event.preventDefault();
      closeExerciseModulePopup(true);
      return;
    }
    if (event.key === "Escape" && exercisePanelOpen) {
      event.preventDefault();
      setExercisePanel(false, true);
      return;
    }
    if (isTyping(event)) {
      if (event.key === "Escape") { event.target.blur(); event.preventDefault(); }
      return;
    }
    var key = event.key.toLowerCase();
    if (event.ctrlKey || event.metaKey) {
      if (key === "z" && event.shiftKey) { event.preventDefault(); NetLab.History.redo(); }
      else if (key === "z") { event.preventDefault(); NetLab.History.undo(); }
      else if (key === "y") { event.preventDefault(); NetLab.History.redo(); }
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); NetLab.Devices.removeSelected(); return; }
    if (event.key === "Escape") { event.preventDefault(); NetLab.Workspace.clearDrafts(); hideFeedback(); return; }
    if (event.code === "Space") {
      event.preventDefault();
      if (event.repeat) return;
      previousSpaceTool = NetLab.State.data.tool;
      NetLab.State.setTool("pan");
      return;
    }
    if (key === "v") setTool("select");
    else if (key === "h") setTool("pan");
    else if (key === "i") setTool("add-internet");
    else if (key === "r") setTool("add-router");
    else if (key === "p") setTool("add-pc");
    else if (key === "s") setTool("add-switch");
    else if (key === "c") setTool("cable");
    else if (key === "b") setTool("add-bus");
    else if (event.key === "+" || event.key === "=") NetLab.Workspace.zoomBy(.15);
    else if (event.key === "-") NetLab.Workspace.zoomBy(-.15);
    else if (event.key === "0") NetLab.Workspace.fitToScreen();
  }

  function onKeyUp(event) {
    if (event.code === "Space" && previousSpaceTool !== null) {
      NetLab.State.setTool(previousSpaceTool);
      previousSpaceTool = null;
    }
  }

  function bindEvents() {
    var toolbar = document.getElementById("toolbar");
    toolbar.addEventListener("click", function (event) {
      var button = event.target.closest("button");
      if (!button || button.disabled) return;
      if (button.dataset.tool) setTool(button.dataset.tool);
      else if (button.dataset.action) handleAction(button.dataset.action);
    });
    document.querySelectorAll("[data-add]").forEach(function (button) {
      button.addEventListener("click", function () { NetLab.Workspace.addAtCenter(button.dataset.add); });
    });
    document.getElementById("exercise-panel").addEventListener("click", function (event) {
      var toggle = event.target.closest("[data-challenge-module]");
      if (toggle) {
        openExerciseModule(toggle.dataset.challengeModule);
        return;
      }
      var button = event.target.closest("[data-challenge]");
      if (button && !button.disabled) startChallenge(button.dataset.challenge);
    });
    document.getElementById("exercise-module-back").addEventListener("click", function () {
      closeExerciseModulePopup(true);
    });
    document.getElementById("exercise-panel-toggle").addEventListener("click", function () {
      setExercisePanel(!exercisePanelOpen, true);
    });
    document.getElementById("exercise-panel-close").addEventListener("click", function () {
      setExercisePanel(false, true);
    });
    document.getElementById("sidebar-toggle").addEventListener("click", function () {
      if (window.innerWidth <= 760 && NetLab.State.data.preferences.sidebarCollapsed) setExercisePanel(false, false);
      NetLab.State.data.preferences.sidebarCollapsed = !NetLab.State.data.preferences.sidebarCollapsed;
      NetLab.State.emit("preferences");
    });
    document.getElementById("ask-hint").addEventListener("click", function () {
      var hint = NetLab.Challenges.askHint();
      feedback("info", "Dica", hint.message + (hint.score ? " Pontuação atual: " + hint.score + "." : ""));
    });
    document.getElementById("restart-challenge").addEventListener("click", restartChallenge);
    document.getElementById("verify-challenge").addEventListener("click", verifyTopology);
    document.getElementById("rename-save").addEventListener("click", function () {
      var selected = NetLab.State.data.selected;
      if (selected && selected.kind === "node") NetLab.Devices.renameNode(selected.id, document.getElementById("rename-input").value);
    });
    document.getElementById("rename-input").addEventListener("keydown", function (event) {
      if (event.key === "Enter") { event.preventDefault(); document.getElementById("rename-save").click(); event.currentTarget.blur(); }
    });
    document.getElementById("router-city").addEventListener("change", function (event) {
      var selected = NetLab.State.data.selected;
      if (selected && selected.kind === "node") NetLab.Devices.setRouterCity(selected.id, event.currentTarget.value);
    });
    document.getElementById("classification-submit").addEventListener("click", function () {
      var select = document.getElementById("classification-answer");
      if (!select.value) {
        feedback("warning", "Escolha uma resposta", "Selecione LAN, LAN + MAN ou LAN + WAN.");
        return;
      }
      var result = NetLab.Challenges.submitClassificationAnswer(select.value);
      select.value = "";
      feedback(result.correct ? "success" : "warning", result.correct ? "Classificação correta" : "Revise o cenário", result.message);
    });
    document.getElementById("mac-destination-submit").addEventListener("click", function () {
      var select = document.getElementById("mac-destination-answer");
      if (!select.value) {
        feedback("warning", "Escolha um endereço", "Selecione o MAC do computador que receberá o quadro.");
        return;
      }
      var result = NetLab.Challenges.submitMacDestinationAnswer(select.value);
      feedback(result.correct ? "success" : "warning", result.correct ? "Destino correto" : "Revise o destinatário", result.message);
    });
    document.getElementById("inspector-delete").addEventListener("click", function () { NetLab.Devices.removeSelected(); });
    document.getElementById("feedback-close").addEventListener("click", hideFeedback);
    document.addEventListener("pointerdown", function (event) {
      if (!exercisePanelOpen) return;
      var panel = document.getElementById("exercise-panel");
      var toggle = document.getElementById("exercise-panel-toggle");
      if (!panel.contains(event.target) && !toggle.contains(event.target)) setExercisePanel(false, false);
    });
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    window.addEventListener("beforeunload", NetLab.Storage.saveNow);
  }

  function init() {
    NetLab.Storage.load();
    NetLab.History.initialize();
    NetLab.Workspace.init();
    bindEvents();
    NetLab.State.subscribe(function () { renderAll(); NetLab.Storage.scheduleSave(); });
    renderAll();
    NetLab.Tutorial.init();
  }

  NetLab.App = {
    init: init,
    feedback: feedback,
    verifyTopology: verifyTopology,
    shouldShowNetworkAnalysis: shouldShowNetworkAnalysis
  };
  document.addEventListener("DOMContentLoaded", init, { once: true });
}());
