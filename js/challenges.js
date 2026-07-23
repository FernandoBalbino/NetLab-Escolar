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
    types: {
      id: "types",
      name: "Tipos de redes",
      short: "Pratique LAN, MAN, WAN e o uso correto das portas físicas.",
      order: ["types-lan-ports", "types-switch-capacity", "types-wan-access", "types-man-link", "types-complete"]
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
    "types-lan-ports": {
      module: "types",
      step: 1,
      name: "Monte uma LAN",
      short: "Crie uma rede local completa usando as portas LAN.",
      objective: "Monte uma LAN com um roteador, um switch e pelo menos dois computadores. Instale as placas e use somente portas LAN entre os equipamentos.",
      minimum: "Roteador + switch + 2 PCs",
      success: "Você construiu uma LAN válida usando corretamente as portas locais."
    },
    "types-switch-capacity": {
      module: "types",
      step: 2,
      name: "Monte uma MAN",
      short: "Una duas redes locais que ficam na mesma cidade.",
      objective: "Crie dois roteadores em Maceió. Cada roteador precisa ter sua própria LAN com pelo menos um computador. Depois, conecte as portas WAN dos roteadores para formar uma MAN.",
      minimum: "2 roteadores + 2 LANs",
      success: "Parabéns! Você conectou duas redes locais da mesma cidade e criou uma MAN.",
      hints: [
        "Uma MAN conecta redes locais diferentes.",
        "As duas unidades precisam estar na mesma cidade.",
        "Configure os dois roteadores como Maceió e conecte um computador a cada rede."
      ]
    },
    "types-wan-access": {
      module: "types",
      step: 3,
      name: "Transforme MAN em WAN",
      short: "Mude a localização de uma das redes já montadas.",
      objective: "A rede começou como uma MAN em Maceió. Selecione um dos roteadores e altere sua cidade para Arapiraca. A ligação deve passar a ser classificada como WAN, sem MAN.",
      minimum: "Altere a cidade de 1 roteador",
      success: "Ao separar as LANs entre Maceió e Arapiraca, você transformou a MAN em WAN."
    },
    "types-man-link": {
      module: "types",
      step: 4,
      name: "LAN conectada à Internet",
      short: "Use a entrada WAN sem transformar a rede local em MAN.",
      objective: "Monte uma LAN válida e ligue a Internet à porta WAN do roteador. A análise deve identificar LAN e WAN, mas não MAN.",
      minimum: "Internet + LAN completa",
      success: "A LAN chegou à Internet pela porta WAN, sem ser confundida com uma MAN."
    },
    "types-complete": {
      module: "types",
      step: 5,
      name: "Identifique a classificação",
      short: "Leia três redes prontas e reconheça seus alcances.",
      objective: "Observe cada cenário pronto no espaço de trabalho e escolha sua classificação: LAN, LAN + MAN ou LAN + WAN. Acerte os três cenários para concluir.",
      minimum: "Classifique 3 cenários",
      success: "Você reconheceu corretamente LAN, MAN e WAN a partir da estrutura e da localização."
    },
    star: { module: "topologies", name: "Estrela", short: "Um switch no centro conecta os computadores da LAN.", objective: "Conecte três ou mais PCs ao mesmo switch. Se usar Internet, siga Internet → Roteador → Switch central.", minimum: "1 switch + 3 PCs" },
    bus: { module: "topologies", name: "Barramento", short: "Todos os computadores compartilham uma linha principal.", objective: "Adicione um barramento e ligue pelo menos três computadores aos seus pontos.", minimum: "1 barramento + 3 PCs" },
    ring: { module: "topologies", name: "Anel", short: "Cada equipamento possui exatamente dois vizinhos.", objective: "Feche um ciclo com pelo menos três equipamentos. Neste desafio, computadores podem ser ligados diretamente.", minimum: "3 equipamentos" },
    mesh: { module: "topologies", name: "Malha", short: "Cada equipamento se conecta diretamente a todos os outros.", objective: "Ligue diretamente cada equipamento a todos os demais. Computadores podem ser conectados entre si.", minimum: "4 equipamentos + 6 cabos" },
    tree: { module: "topologies", name: "Árvore", short: "Switches organizam a rede em níveis e ramificações.", objective: "Crie um switch raiz, switches secundários e computadores nas pontas, sem ciclos.", minimum: "2 switches + 2 PCs" }
  };
  var order = modules.basics.order.concat(modules.types.order, modules.topologies.order);

  function get(id) { return definitions[id] || null; }
  function list(moduleId) {
    var ids = moduleId && modules[moduleId] ? modules[moduleId].order : order;
    return ids.map(function (id) { return Object.assign({ id: id }, definitions[id]); });
  }
  function listModules() {
    return [modules.basics, modules.types, modules.topologies].map(function (module) {
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
    NetLab.State.data.challengeData = null;
    NetLab.State.data.tool = "select";
  }

  function seedNode(id, type, name, x, y, city) {
    var dimensions = { pc: [142, 158], switch: [154, 124], router: [170, 148], internet: [142, 130] }[type];
    return {
      id: id,
      type: type,
      name: name,
      x: x,
      y: y,
      width: dimensions[0],
      height: dimensions[1],
      status: "disconnected",
      hasNetworkCard: type === "pc" ? true : undefined,
      city: type === "router" ? NetLab.NetworkScope.sanitizeCity(city) : undefined,
      ipv4: type === "pc" ? { address: "", mask: "", gateway: "" } : undefined
    };
  }

  function seedCable(id, sourceId, targetId, sourcePortId, targetPortId) {
    return { id: id, sourceId: sourceId, targetId: targetId, sourcePortId: sourcePortId || null, targetPortId: targetPortId || null, type: "ethernet" };
  }

  function manSeed(firstCity, secondCity) {
    return {
      nodes: [
        seedNode("lesson-router-a", "router", "Roteador A", 610, 300, firstCity),
        seedNode("lesson-router-b", "router", "Roteador B", 1120, 300, secondCity),
        seedNode("lesson-pc-a", "pc", "PC da rede A", 620, 580),
        seedNode("lesson-pc-b", "pc", "PC da rede B", 1140, 580)
      ],
      connections: [
        seedCable("lesson-lan-a", "lesson-router-a", "lesson-pc-a", "lan-1", null),
        seedCable("lesson-lan-b", "lesson-router-b", "lesson-pc-b", "lan-1", null),
        seedCable("lesson-city-link", "lesson-router-a", "lesson-router-b", "wan", "wan")
      ]
    };
  }

  function quizSeed(index) {
    if (index === 1) return manSeed("maceio", "maceio");
    if (index === 2) return manSeed("maceio", "arapiraca");
    return {
      nodes: [
        seedNode("quiz-router", "router", "Roteador da escola", 870, 270, "maceio"),
        seedNode("quiz-switch", "switch", "Switch da sala", 880, 500),
        seedNode("quiz-pc-a", "pc", "PC 1", 650, 720),
        seedNode("quiz-pc-b", "pc", "PC 2", 1100, 720)
      ],
      connections: [
        seedCable("quiz-uplink", "quiz-router", "quiz-switch", "lan-1", "port-1"),
        seedCable("quiz-pc-link-a", "quiz-switch", "quiz-pc-a", "port-2", null),
        seedCable("quiz-pc-link-b", "quiz-switch", "quiz-pc-b", "port-3", null)
      ]
    };
  }

  function installSeed(seed) {
    NetLab.State.data.nodes = seed.nodes;
    NetLab.State.data.connections = seed.connections;
    NetLab.State.data.buses = [];
  }

  function seedChallenge(id) {
    if (id === "types-wan-access") installSeed(manSeed("maceio", "maceio"));
    if (id === "types-complete") {
      NetLab.State.data.challengeData = { quizScenario: 0, quizComplete: false, lastAnswer: null };
      installSeed(quizSeed(0));
    }
  }

  function start(id) {
    if (!definitions[id] || !isUnlocked(id)) return false;
    clearWorkspace();
    NetLab.State.data.challenge = id;
    NetLab.State.data.hintsUsed = 0;
    seedChallenge(id);
    NetLab.History.record("start-challenge");
    NetLab.State.emit("start-challenge");
    return true;
  }

  function restart() {
    var id = NetLab.State.data.challenge;
    clearWorkspace();
    NetLab.State.data.hintsUsed = 0;
    seedChallenge(id);
    NetLab.History.record("restart-challenge");
    NetLab.State.emit("restart-challenge");
  }

  function validate(id, snapshot) {
    var definition = definitions[id];
    if (!definition) return NetLab.TopologyValidator.validate("free", snapshot);
    if (definition.module === "basics") {
      return NetLab.NetworkBasicsValidator.validate(id, snapshot, NetLab.State.data.communicationProof);
    }
    if (definition.module === "types") return NetLab.NetworkTypesValidator.validate(id, snapshot);
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
    var availableHints = (definitions[id].hints && definitions[id].hints.length) ? definitions[id].hints : validation.hints;
    var index = Math.min(NetLab.State.data.hintsUsed, Math.max(0, availableHints.length - 1));
    var message = availableHints[index] || "Observe as conexões e compare com o objetivo do exercício.";
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

  function submitClassificationAnswer(answer) {
    if (NetLab.State.data.challenge !== "types-complete" || !NetLab.State.data.challengeData) {
      return { correct: false, complete: false, message: "Inicie o exercício Identifique a classificação." };
    }
    var data = NetLab.State.data.challengeData;
    var expected = ["LAN", "LAN+MAN", "LAN+WAN"][data.quizScenario];
    data.lastAnswer = answer;
    if (answer !== expected) {
      NetLab.State.emit("classification-answer");
      return { correct: false, complete: false, expected: expected, message: "Observe a cidade dos roteadores e quais redes estão realmente conectadas." };
    }
    if (data.quizScenario < 2) {
      data.quizScenario += 1;
      data.lastAnswer = null;
      installSeed(quizSeed(data.quizScenario));
      NetLab.State.emit("classification-scenario");
      return { correct: true, complete: false, nextScenario: data.quizScenario, message: "Correto! Analise agora o próximo cenário." };
    }
    data.quizComplete = true;
    NetLab.State.emit("classification-answer");
    return { correct: true, complete: true, message: "Os três cenários foram classificados corretamente. Clique em Verificar para concluir." };
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
    submitClassificationAnswer: submitClassificationAnswer,
    recordCommunicationSuccess: recordCommunicationSuccess
  };
}());
