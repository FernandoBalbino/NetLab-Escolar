(function () {
  "use strict";

  var NetLab = window.NetLab = window.NetLab || {};
  var listeners = [];
  var challengeIds = [
    "basic-direct", "basic-switch", "basic-lan", "basic-router", "basic-internet",
    "star", "bus", "ring", "mesh", "tree"
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return prefix + "-" + window.crypto.randomUUID();
    }
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function defaultProgress() {
    var completed = {};
    var bestScores = {};
    challengeIds.forEach(function (id) {
      completed[id] = false;
      bestScores[id] = 0;
    });
    return {
      unlocked: ["basic-direct", "star"],
      completed: completed,
      bestScores: bestScores
    };
  }

  var state = {
    tool: "select",
    selected: null,
    nodes: [],
    connections: [],
    buses: [],
    challenge: "free",
    hintsUsed: 0,
    zoom: 1,
    pan: { x: 0, y: 0 },
    connectionDraft: null,
    communicationDraft: null,
    communicationProof: null,
    progress: defaultProgress(),
    preferences: { sidebarCollapsed: false, tutorialHidden: false, tutorialSeen: false }
  };

  function emit(reason) {
    if (NetLab.Connections && typeof NetLab.Connections.recalculateStatuses === "function") NetLab.Connections.recalculateStatuses();
    listeners.slice().forEach(function (listener) {
      try { listener(state, reason || "update"); } catch (error) { console.error("Falha ao atualizar a interface:", error); }
    });
  }

  function subscribe(listener) {
    listeners.push(listener);
    return function () {
      listeners = listeners.filter(function (item) { return item !== listener; });
    };
  }

  function setTool(tool) {
    if (state.tool === tool) return;
    state.tool = tool;
    if (tool !== "cable") state.connectionDraft = null;
    if (tool !== "communication") state.communicationDraft = null;
    emit("tool");
  }

  function select(kind, id) {
    state.selected = kind && id ? { kind: kind, id: id } : null;
    emit("selection");
  }

  function captureProject() {
    if (NetLab.Connections && typeof NetLab.Connections.recalculateStatuses === "function") NetLab.Connections.recalculateStatuses();
    return clone({
      nodes: state.nodes,
      connections: state.connections,
      buses: state.buses,
      challenge: state.challenge,
      hintsUsed: state.hintsUsed,
      zoom: state.zoom,
      pan: state.pan
    });
  }

  function restoreProject(project, reason) {
    state.nodes = clone(project.nodes || []);
    state.connections = clone(project.connections || []);
    state.buses = clone(project.buses || []);
    state.challenge = challengeIds.indexOf(project.challenge) >= 0 ? project.challenge : "free";
    state.hintsUsed = Math.max(0, Number(project.hintsUsed) || 0);
    state.zoom = Math.min(2, Math.max(.4, Number(project.zoom) || 1));
    state.pan = project.pan && Number.isFinite(project.pan.x) && Number.isFinite(project.pan.y)
      ? { x: project.pan.x, y: project.pan.y }
      : { x: 0, y: 0 };
    state.selected = null;
    state.connectionDraft = null;
    state.communicationDraft = null;
    state.communicationProof = null;
    state.tool = "select";
    emit(reason || "restore");
  }

  function mergeProgress(progress) {
    var fresh = defaultProgress();
    if (!progress || typeof progress !== "object") return fresh;
    challengeIds.forEach(function (id) {
      fresh.completed[id] = Boolean(progress.completed && progress.completed[id]);
      fresh.bestScores[id] = Math.max(0, Math.min(100, Number(progress.bestScores && progress.bestScores[id]) || 0));
    });
    var unlocked = Array.isArray(progress.unlocked) ? progress.unlocked.filter(function (id) { return challengeIds.indexOf(id) >= 0; }) : [];
    fresh.unlocked = Array.from(new Set(["basic-direct", "star"].concat(unlocked)));
    return fresh;
  }

  function mergePreferences(preferences) {
    return {
      sidebarCollapsed: Boolean(preferences && preferences.sidebarCollapsed),
      tutorialHidden: Boolean(preferences && preferences.tutorialHidden),
      tutorialSeen: Boolean(preferences && preferences.tutorialSeen)
    };
  }

  function getNode(id) { return state.nodes.find(function (node) { return node.id === id; }) || null; }
  function getBus(id) { return state.buses.find(function (bus) { return bus.id === id; }) || null; }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

  NetLab.State = {
    WORLD_WIDTH: 2400,
    WORLD_HEIGHT: 1400,
    challengeIds: challengeIds,
    data: state,
    clone: clone,
    createId: createId,
    emit: emit,
    subscribe: subscribe,
    setTool: setTool,
    select: select,
    captureProject: captureProject,
    restoreProject: restoreProject,
    mergeProgress: mergeProgress,
    mergePreferences: mergePreferences,
    getNode: getNode,
    getBus: getBus,
    clamp: clamp
  };
}());
