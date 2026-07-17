(function () {
  "use strict";

  var NetLab = window.NetLab = window.NetLab || {};
  var order = ["star", "bus", "ring", "mesh", "tree"];
  var definitions = {
    star: { name: "Estrela", short: "Um switch no centro conecta os computadores da LAN.", objective: "Conecte três ou mais PCs ao mesmo switch. Se usar Internet, siga Internet → Roteador → Switch central.", minimum: "1 switch + 3 PCs" },
    bus: { name: "Barramento", short: "Todos os computadores compartilham uma linha principal.", objective: "Adicione um barramento e ligue pelo menos três computadores aos seus pontos.", minimum: "1 barramento + 3 PCs" },
    ring: { name: "Anel", short: "Cada equipamento possui exatamente dois vizinhos.", objective: "Feche um ciclo com pelo menos três equipamentos, sem cabos extras.", minimum: "3 equipamentos" },
    mesh: { name: "Malha", short: "Cada equipamento se conecta diretamente a todos os outros.", objective: "Monte uma malha completa com pelo menos quatro equipamentos.", minimum: "4 equipamentos + 6 cabos" },
    tree: { name: "Árvore", short: "Switches organizam a rede em níveis e ramificações.", objective: "Crie um switch raiz, switches secundários e computadores nas pontas, sem ciclos.", minimum: "2 switches + 2 PCs" }
  };

  function get(id) { return definitions[id] || null; }
  function list() { return order.map(function (id) { return Object.assign({ id: id }, definitions[id]); }); }
  function score() { return Math.max(50, 100 - NetLab.State.data.hintsUsed * 10); }
  function isUnlocked(id) { return NetLab.State.data.progress.unlocked.indexOf(id) >= 0; }

  function start(id) {
    if (!definitions[id] || !isUnlocked(id)) return false;
    NetLab.State.data.nodes = [];
    NetLab.State.data.connections = [];
    NetLab.State.data.buses = [];
    NetLab.State.data.selected = null;
    NetLab.State.data.challenge = id;
    NetLab.State.data.hintsUsed = 0;
    NetLab.State.data.connectionDraft = null;
    NetLab.State.data.communicationDraft = null;
    NetLab.State.data.tool = "select";
    NetLab.History.record("start-challenge");
    NetLab.State.emit("start-challenge");
    return true;
  }

  function restart() {
    NetLab.State.data.nodes = [];
    NetLab.State.data.connections = [];
    NetLab.State.data.buses = [];
    NetLab.State.data.selected = null;
    NetLab.State.data.hintsUsed = 0;
    NetLab.State.data.connectionDraft = null;
    NetLab.State.data.communicationDraft = null;
    NetLab.History.record("restart-challenge");
    NetLab.State.emit("restart-challenge");
  }

  function validateCurrent() {
    var id = NetLab.State.data.challenge;
    var validation = NetLab.TopologyValidator.validate(id, NetLab.State.captureProject());
    if (validation.valid && id !== "free") {
      var currentScore = score();
      var progress = NetLab.State.data.progress;
      progress.completed[id] = true;
      progress.bestScores[id] = Math.max(progress.bestScores[id] || 0, currentScore);
      var next = order[order.indexOf(id) + 1];
      if (next && progress.unlocked.indexOf(next) < 0) progress.unlocked.push(next);
      NetLab.State.emit("challenge-complete");
      NetLab.Storage.saveNow();
      validation.score = currentScore;
      validation.nextUnlocked = next || null;
    }
    return validation;
  }

  function askHint() {
    var id = NetLab.State.data.challenge;
    if (id === "free") return { message: "Escolha um desafio para receber dicas específicas.", score: null };
    var validation = NetLab.TopologyValidator.validate(id, NetLab.State.captureProject());
    if (validation.valid) return { message: "Sua topologia parece pronta. Clique em Verificar!", score: score() };
    var index = Math.min(NetLab.State.data.hintsUsed, Math.max(0, validation.hints.length - 1));
    var message = validation.hints[index] || "Observe as conexões e compare com o objetivo do desafio.";
    if (NetLab.State.data.hintsUsed < 5) NetLab.State.data.hintsUsed += 1;
    NetLab.State.emit("hint");
    return { message: message, score: score() };
  }

  NetLab.Challenges = { order: order, get: get, list: list, score: score, isUnlocked: isUnlocked, start: start, restart: restart, validateCurrent: validateCurrent, askHint: askHint };
}());
