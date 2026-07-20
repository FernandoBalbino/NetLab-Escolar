(function () {
  "use strict";

  var NetLab = window.NetLab = window.NetLab || {};
  var modules = {
    basics: {
      id: "basics",
      name: "Redes básicas",
      short: "Cinco etapas para sair do primeiro cabo e chegar a uma rede com Internet.",
      order: ["basic-direct", "basic-switch", "basic-lan", "basic-router", "basic-internet"]
    },
    topologies: {
      id: "topologies",
      name: "Topologias",
      short: "Pratique Estrela, Barramento, Anel, Malha e Árvore.",
      order: ["star", "bus", "ring", "mesh", "tree"]
    }
  };
  var definitions = {
    "basic-direct": {
      module: "basics",
      step: 1,
      name: "Primeiro enlace",
      short: "Ligue dois computadores diretamente e faça um pacote chegar ao destino.",
      objective: "Adicione dois PCs, instale as placas, conecte-os por cabo, configure endereços IPv4 diferentes na mesma sub-rede e use Testar comunicação.",
      minimum: "2 PCs + 1 cabo",
      success: "Os dois computadores trocaram dados diretamente na mesma sub-rede."
    },
    "basic-switch": {
      module: "basics",
      step: 2,
      name: "Rede com switch",
      short: "Troque o cabo direto por uma pequena rede local com switch.",
      objective: "Conecte dois PCs ao mesmo switch, configure os dois na mesma sub-rede IPv4 e entregue um pacote entre eles.",
      minimum: "2 PCs + 1 switch",
      success: "O switch encaminhou o pacote dentro da primeira rede local."
    },
    "basic-lan": {
      module: "basics",
      step: 3,
      name: "LAN compartilhada",
      short: "Amplie a rede local para três computadores.",
      objective: "Monte uma LAN com três PCs ligados ao mesmo switch. Todos precisam de placas, endereços únicos na mesma sub-rede e um teste de comunicação bem-sucedido.",
      minimum: "3 PCs + 1 switch",
      success: "A LAN possui três estações configuradas e capazes de se comunicar."
    },
    "basic-router": {
      module: "basics",
      step: 4,
      name: "Roteador na borda",
      short: "Prepare a saída da LAN adicionando um roteador.",
      objective: "Monte PCs → Switch → Roteador, sem Internet ainda. Mantenha os PCs na mesma sub-rede e confirme a comunicação dentro da LAN.",
      minimum: "2 PCs + switch + roteador",
      success: "A rede local está pronta e o roteador ocupa a borda da infraestrutura."
    },
    "basic-internet": {
      module: "basics",
      step: 5,
      name: "Caminho até a Internet",
      short: "Complete a infraestrutura da LAN até a fonte de Internet.",
      objective: "Monte Internet → Roteador → Switch → três PCs. Configure os PCs na mesma sub-rede e finalize com um teste de comunicação.",
      minimum: "Internet + roteador + switch + 3 PCs",
      success: "Você completou o caminho da Internet até uma LAN configurada."
    },
    star: { module: "topologies", name: "Estrela", short: "Um switch no centro conecta os computadores da LAN.", objective: "Conecte três ou mais PCs ao mesmo switch. Se usar Internet, siga Internet → Roteador → Switch central.", minimum: "1 switch + 3 PCs" },
    bus: { module: "topologies", name: "Barramento", short: "Todos os computadores compartilham uma linha principal.", objective: "Adicione um barramento e ligue pelo menos três computadores aos seus pontos.", minimum: "1 barramento + 3 PCs" },
    ring: { module: "topologies", name: "Anel", short: "Cada equipamento possui exatamente dois vizinhos.", objective: "Feche um ciclo com pelo menos três equipamentos. Neste desafio, computadores podem ser ligados diretamente.", minimum: "3 equipamentos" },
    mesh: { module: "topologies", name: "Malha", short: "Cada equipamento se conecta diretamente a todos os outros.", objective: "Ligue diretamente cada equipamento a todos os demais. Computadores podem ser conectados entre si.", minimum: "4 equipamentos + 6 cabos" },
    tree: { module: "topologies", name: "Árvore", short: "Switches organizam a rede em níveis e ramificações.", objective: "Crie um switch raiz, switches secundários e computadores nas pontas, sem ciclos.", minimum: "2 switches + 2 PCs" }
  };
  var order = modules.basics.order.concat(modules.topologies.order);

  function get(id) { return definitions[id] || null; }
  function list(moduleId) {
    var ids = moduleId && modules[moduleId] ? modules[moduleId].order : order;
    return ids.map(function (id) { return Object.assign({ id: id }, definitions[id]); });
  }
  function listModules() {
    return [modules.basics, modules.topologies].map(function (module) {
      return { id: module.id, name: module.name, short: module.short, order: module.order.slice() };
    });
  }
  function moduleFor(id) { return definitions[id] ? definitions[id].module : null; }
  function score() { return Math.max(50, 100 - NetLab.State.data.hintsUsed * 10); }
  function isUnlocked(id) { return NetLab.State.data.progress.unlocked.indexOf(id) >= 0; }

  function clearWorkspace() {
    NetLab.State.data.nodes = [];
    NetLab.State.data.connections = [];
    NetLab.State.data.buses = [];
    NetLab.State.data.selected = null;
    NetLab.State.data.connectionDraft = null;
    NetLab.State.data.communicationDraft = null;
    NetLab.State.data.communicationProof = null;
    NetLab.State.data.tool = "select";
  }

  function start(id) {
    if (!definitions[id] || !isUnlocked(id)) return false;
    clearWorkspace();
    NetLab.State.data.challenge = id;
    NetLab.State.data.hintsUsed = 0;
    NetLab.History.record("start-challenge");
    NetLab.State.emit("start-challenge");
    return true;
  }

  function restart() {
    clearWorkspace();
    NetLab.State.data.hintsUsed = 0;
    NetLab.History.record("restart-challenge");
    NetLab.State.emit("restart-challenge");
  }

  function validate(id, snapshot) {
    var definition = definitions[id];
    if (!definition) return NetLab.TopologyValidator.validate("free", snapshot);
    if (definition.module === "basics") {
      return NetLab.NetworkBasicsValidator.validate(id, snapshot, NetLab.State.data.communicationProof);
    }
    return NetLab.TopologyValidator.validate(id, snapshot);
  }

  function validateCurrent() {
    var id = NetLab.State.data.challenge;
    var snapshot = NetLab.State.captureProject();
    var validation = validate(id, snapshot);
    if (validation.valid && id !== "free") {
      var currentScore = score();
      var progress = NetLab.State.data.progress;
      var moduleId = definitions[id].module;
      var moduleOrder = modules[moduleId].order;
      progress.completed[id] = true;
      progress.bestScores[id] = Math.max(progress.bestScores[id] || 0, currentScore);
      var next = moduleOrder[moduleOrder.indexOf(id) + 1];
      if (next && progress.unlocked.indexOf(next) < 0) progress.unlocked.push(next);
      NetLab.State.emit("challenge-complete");
      NetLab.Storage.saveNow();
      validation.score = currentScore;
      validation.nextUnlocked = next || null;
      validation.moduleId = moduleId;
      validation.moduleComplete = !next;
    }
    return validation;
  }

  function askHint() {
    var id = NetLab.State.data.challenge;
    if (id === "free") return { message: "Escolha um exercício para receber dicas específicas.", score: null };
    var validation = validate(id, NetLab.State.captureProject());
    if (validation.valid) return { message: "Seu exercício parece pronto. Clique em Verificar!", score: score() };
    var index = Math.min(NetLab.State.data.hintsUsed, Math.max(0, validation.hints.length - 1));
    var message = validation.hints[index] || "Observe as conexões e compare com o objetivo do exercício.";
    if (NetLab.State.data.hintsUsed < 5) NetLab.State.data.hintsUsed += 1;
    NetLab.State.emit("hint");
    return { message: message, score: score() };
  }

  function recordCommunicationSuccess(source, target) {
    var id = NetLab.State.data.challenge;
    if (!definitions[id] || definitions[id].module !== "basics") return false;
    NetLab.State.data.communicationProof = {
      challengeId: id,
      sourceId: source.id,
      targetId: target.id,
      signature: NetLab.NetworkBasicsValidator.signature(NetLab.State.captureProject())
    };
    NetLab.State.emit("communication-success");
    return true;
  }

  NetLab.Challenges = {
    order: order,
    modules: listModules,
    moduleFor: moduleFor,
    get: get,
    list: list,
    score: score,
    isUnlocked: isUnlocked,
    start: start,
    restart: restart,
    validateCurrent: validateCurrent,
    askHint: askHint,
    recordCommunicationSuccess: recordCommunicationSuccess
  };
}());
