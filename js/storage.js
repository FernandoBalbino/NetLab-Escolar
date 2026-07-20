(function () {
  "use strict";

  var NetLab = window.NetLab = window.NetLab || {};
  var KEYS = {
    project: "netlabEscolar.project.v1",
    progress: "netlabEscolar.progress.v1",
    preferences: "netlabEscolar.preferences.v1"
  };
  var saveTimer = null;

  function safeGet(key) {
    try { return window.localStorage.getItem(key); } catch (error) { console.warn("Armazenamento local indisponível.", error); return null; }
  }

  function safeSet(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch (error) { console.warn("Não foi possível salvar localmente.", error); return false; }
  }

  function finite(value, fallback) { return Number.isFinite(Number(value)) ? Number(value) : fallback; }

  function pairAllowed(source, target, challenge) {
    var pair = [source.type, target.type].sort().join("|");
    return ["internet|router", "pc|router", "pc|switch", "router|switch", "switch|switch"].indexOf(pair) >= 0
      || (pair === "pc|pc" && ["ring", "mesh", "free", "basic-direct"].indexOf(challenge) >= 0);
  }

  function sanitizeProject(project, options) {
    var strictConnections = !options || options.strictConnections !== false;
    if (!project || typeof project !== "object") throw new Error("O arquivo não contém um projeto válido.");
    if (!Array.isArray(project.nodes) || !Array.isArray(project.connections) || !Array.isArray(project.buses)) {
      throw new Error("A estrutura de equipamentos, cabos ou barramentos é inválida.");
    }
    if (project.nodes.length > 500 || project.connections.length > 2000 || project.buses.length > 50) {
      throw new Error("O projeto excede o limite seguro de elementos.");
    }
    var challenge = NetLab.State.challengeIds.indexOf(project.challenge) >= 0 ? project.challenge : "free";

    var legacyConnectedIds = new Set();
    project.connections.forEach(function (connection) {
      if (connection && typeof connection.sourceId === "string") legacyConnectedIds.add(connection.sourceId);
      if (connection && typeof connection.targetId === "string") legacyConnectedIds.add(connection.targetId);
    });
    project.buses.forEach(function (bus) {
      if (!bus || !Array.isArray(bus.attachments)) return;
      bus.attachments.forEach(function (attachment) {
        if (attachment && typeof attachment.nodeId === "string") legacyConnectedIds.add(attachment.nodeId);
      });
    });

    var ids = new Set();
    var nodes = project.nodes.map(function (node) {
      if (!node || typeof node.id !== "string" || ids.has(node.id) || ["pc", "switch", "router", "internet"].indexOf(node.type) < 0) throw new Error("Existe um equipamento inválido ou duplicado.");
      ids.add(node.id);
      var dimensions = { pc: [142, 158], switch: [154, 124], router: [170, 148], internet: [142, 130] }[node.type];
      var minimumWidth = dimensions[0];
      var minimumHeight = dimensions[1];
      var width = NetLab.State.clamp(finite(node.width, minimumWidth), minimumWidth, 240);
      var height = NetLab.State.clamp(finite(node.height, minimumHeight), minimumHeight, 220);
      var hasNetworkCard = node.type === "pc"
        ? (typeof node.hasNetworkCard === "boolean" ? node.hasNetworkCard : legacyConnectedIds.has(node.id))
        : undefined;
      return {
        id: node.id,
        type: node.type,
        name: String(node.name || ({ pc: "PC", switch: "Switch", router: "Roteador", internet: "Internet" }[node.type])).trim().slice(0, 32) || ({ pc: "PC", switch: "Switch", router: "Roteador", internet: "Internet" }[node.type]),
        x: NetLab.State.clamp(finite(node.x, 20), 0, NetLab.State.WORLD_WIDTH - width),
        y: NetLab.State.clamp(finite(node.y, 20), 0, NetLab.State.WORLD_HEIGHT - height),
        width: width,
        height: height,
        status: ["disconnected", "no-internet", "connected"].indexOf(node.status) >= 0 ? node.status : "disconnected",
        hasNetworkCard: hasNetworkCard,
        ipv4: node.type === "pc" ? NetLab.IPv4.sanitize(node.ipv4) : undefined
      };
    });

    var connectionPairs = new Set();
    var connectionIds = new Set();
    var connections = project.connections.map(function (connection) {
      if (!connection || typeof connection.id !== "string" || connectionIds.has(connection.id) || !ids.has(connection.sourceId) || !ids.has(connection.targetId) || connection.sourceId === connection.targetId) {
        throw new Error("Existe um cabo inválido no arquivo.");
      }
      var pair = [connection.sourceId, connection.targetId].sort().join("|");
      if (connectionPairs.has(pair)) throw new Error("O arquivo contém cabos duplicados.");
      connectionPairs.add(pair);
      connectionIds.add(connection.id);
      return { id: connection.id, sourceId: connection.sourceId, targetId: connection.targetId, type: "ethernet" };
    });

    var busIds = new Set();
    var attachmentIds = new Set();
    var buses = project.buses.map(function (bus) {
      if (!bus || typeof bus.id !== "string" || busIds.has(bus.id) || !Array.isArray(bus.attachments)) throw new Error("Existe um barramento inválido no arquivo.");
      if (bus.attachments.length > 12) throw new Error("Um barramento não pode possuir mais de 12 ligações.");
      busIds.add(bus.id);
      var width = NetLab.State.clamp(finite(bus.width, 520), 260, 1000);
      var attachedNodeIds = new Set();
      var attachments = bus.attachments.map(function (attachment) {
        if (!attachment || typeof attachment.id !== "string" || attachmentIds.has(attachment.id) || !ids.has(attachment.nodeId) || attachedNodeIds.has(attachment.nodeId)) throw new Error("Existe uma ligação de barramento inválida ou duplicada.");
        attachmentIds.add(attachment.id);
        attachedNodeIds.add(attachment.nodeId);
        return { id: attachment.id, nodeId: attachment.nodeId, offset: NetLab.State.clamp(finite(attachment.offset, .5), 0, 1) };
      });
      return {
        id: bus.id,
        name: String(bus.name || "Barramento").trim().slice(0, 32) || "Barramento",
        x: NetLab.State.clamp(finite(bus.x, 80), 0, NetLab.State.WORLD_WIDTH - width),
        y: NetLab.State.clamp(finite(bus.y, 300), 0, NetLab.State.WORLD_HEIGHT - 48),
        width: width,
        attachments: attachments
      };
    });

    var nodeById = new Map(nodes.map(function (node) { return [node.id, node]; }));
    var invalidConnection = connections.find(function (connection) { return !pairAllowed(nodeById.get(connection.sourceId), nodeById.get(connection.targetId), challenge); });
    if (invalidConnection && strictConnections) throw new Error("O arquivo contém uma conexão entre tipos de equipamentos incompatíveis.");
    connections = connections.filter(function (connection) { return pairAllowed(nodeById.get(connection.sourceId), nodeById.get(connection.targetId), challenge); });
    connections.forEach(function (connection) {
      var source = nodeById.get(connection.sourceId);
      var target = nodeById.get(connection.targetId);
      if ((source.type === "pc" && !source.hasNetworkCard) || (target.type === "pc" && !target.hasNetworkCard)) {
        throw new Error("Um computador sem placa de rede não pode possuir cabos.");
      }
    });
    buses.forEach(function (bus) {
      var internetAttachment = bus.attachments.find(function (attachment) { return nodeById.get(attachment.nodeId).type === "internet"; });
      if (internetAttachment && strictConnections) throw new Error("A Internet não pode ser ligada diretamente a um barramento.");
      bus.attachments = bus.attachments.filter(function (attachment) { return nodeById.get(attachment.nodeId).type !== "internet"; });
      bus.attachments.forEach(function (attachment) {
        var node = nodeById.get(attachment.nodeId);
        if (node.type === "pc" && !node.hasNetworkCard) throw new Error("Um computador sem placa de rede não pode estar ligado ao barramento.");
      });
    });

    return {
      nodes: nodes,
      connections: connections,
      buses: buses,
      challenge: challenge,
      hintsUsed: Math.max(0, Math.min(5, finite(project.hintsUsed, 0))),
      zoom: NetLab.State.clamp(finite(project.zoom, 1), .4, 2),
      pan: {
        x: NetLab.State.clamp(finite(project.pan && project.pan.x, 0), -5000, 5000),
        y: NetLab.State.clamp(finite(project.pan && project.pan.y, 0), -5000, 5000)
      }
    };
  }

  function load() {
    var rawProject = safeGet(KEYS.project);
    var rawProgress = safeGet(KEYS.progress);
    var rawPreferences = safeGet(KEYS.preferences);
    if (rawProject) {
      try { NetLab.State.restoreProject(sanitizeProject(JSON.parse(rawProject), { strictConnections: false }), "load"); } catch (error) { console.warn("Projeto salvo ignorado:", error.message); }
    }
    if (rawProgress) {
      try { NetLab.State.data.progress = NetLab.State.mergeProgress(JSON.parse(rawProgress)); } catch (error) { console.warn("Progresso salvo ignorado."); }
    }
    if (rawPreferences) {
      try { NetLab.State.data.preferences = NetLab.State.mergePreferences(JSON.parse(rawPreferences)); } catch (error) { console.warn("Preferências salvas ignoradas."); }
    }
  }

  function saveNow() {
    safeSet(KEYS.project, JSON.stringify(NetLab.State.captureProject()));
    safeSet(KEYS.progress, JSON.stringify(NetLab.State.data.progress));
    safeSet(KEYS.preferences, JSON.stringify(NetLab.State.data.preferences));
  }

  function scheduleSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveNow, 140);
  }

  function exportProject() {
    var payload = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      project: NetLab.State.captureProject(),
      progress: NetLab.State.clone(NetLab.State.data.progress)
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "netlab-escolar-projeto.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file || file.size > 5 * 1024 * 1024) { reject(new Error("Selecione um arquivo JSON de até 5 MB.")); return; }
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var payload = JSON.parse(String(reader.result || ""));
          if (!payload || payload.schemaVersion !== 1 || !payload.project) throw new Error("Este arquivo não foi exportado pelo NetLab Escolar.");
          resolve({ project: sanitizeProject(payload.project, { strictConnections: true }), progress: NetLab.State.mergeProgress(payload.progress) });
        } catch (error) { reject(error); }
      };
      reader.onerror = function () { reject(new Error("Não foi possível ler o arquivo selecionado.")); };
      reader.readAsText(file, "utf-8");
    });
  }

  NetLab.Storage = { KEYS: KEYS, load: load, saveNow: saveNow, scheduleSave: scheduleSave, exportProject: exportProject, readFile: readFile, sanitizeProject: sanitizeProject };
}());
