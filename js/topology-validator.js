(function () {
  "use strict";

  var NetLab = window.NetLab = window.NetLab || {};

  function graphFor(snapshot) {
    var adjacency = new Map();
    snapshot.nodes.forEach(function (node) { adjacency.set(node.id, new Set()); });
    snapshot.connections.forEach(function (connection) {
      if (!adjacency.has(connection.sourceId) || !adjacency.has(connection.targetId)) return;
      var source = snapshot.nodes.find(function (node) { return node.id === connection.sourceId; });
      var target = snapshot.nodes.find(function (node) { return node.id === connection.targetId; });
      if ((source.type === "pc" && !source.hasNetworkCard) || (target.type === "pc" && !target.hasNetworkCard)) return;
      adjacency.get(connection.sourceId).add(connection.targetId);
      adjacency.get(connection.targetId).add(connection.sourceId);
    });
    return adjacency;
  }

  function isConnected(snapshot, graph) {
    if (!snapshot.nodes.length) return false;
    var visited = new Set();
    var queue = [snapshot.nodes[0].id];
    while (queue.length) {
      var current = queue.shift();
      if (visited.has(current)) continue;
      visited.add(current);
      (graph.get(current) || []).forEach(function (neighbor) { if (!visited.has(neighbor)) queue.push(neighbor); });
    }
    return visited.size === snapshot.nodes.length;
  }

  function hasCycle(graph) {
    var visited = new Set();
    function visit(vertex, parent) {
      visited.add(vertex);
      var neighbors = Array.from(graph.get(vertex) || []);
      for (var i = 0; i < neighbors.length; i += 1) {
        if (!visited.has(neighbors[i])) {
          if (visit(neighbors[i], vertex)) return true;
        } else if (neighbors[i] !== parent) return true;
      }
      return false;
    }
    var vertices = Array.from(graph.keys());
    for (var i = 0; i < vertices.length; i += 1) {
      if (!visited.has(vertices[i]) && visit(vertices[i], null)) return true;
    }
    return false;
  }

  function disconnectedNames(snapshot, graph) {
    return snapshot.nodes.filter(function (node) { return (graph.get(node.id) || new Set()).size === 0; }).map(function (node) { return node.name; });
  }

  function result(valid, topology, hints, details) {
    return { valid: valid, topology: topology, hints: Array.from(new Set(hints.filter(Boolean))), details: details || {} };
  }

  function networkCardsReady(snapshot, hints) {
    var missing = snapshot.nodes.find(function (node) { return node.type === "pc" && !node.hasNetworkCard; });
    if (missing) hints.push("Instale uma placa de rede no " + missing.name + ".");
    return !missing;
  }

  function validateStar(snapshot) {
    var graph = graphFor(snapshot);
    var hints = [];
    var switches = snapshot.nodes.filter(function (node) { return node.type === "switch"; });
    var pcs = snapshot.nodes.filter(function (node) { return node.type === "pc"; });
    var routers = snapshot.nodes.filter(function (node) { return node.type === "router"; });
    var internetNodes = snapshot.nodes.filter(function (node) { return node.type === "internet"; });
    var cardsReady = networkCardsReady(snapshot, hints);
    if (snapshot.buses.length) hints.push("Remova o barramento: a estrela usa cabos diretos até um switch central.");
    if (!switches.length) hints.push("Adicione um switch central.");
    if (switches.length > 1) hints.push("Use apenas um switch central para a LAN da topologia em estrela.");
    if (pcs.length < 3) hints.push("Adicione pelo menos três computadores para praticar a estrela.");

    // A infraestrutura Internet -> Roteador não é uma ponta da estrela local.
    // O centro é determinado somente pelas ligações diretas dos computadores.
    var centerCandidates = switches.filter(function (candidate) {
      return pcs.length > 0 && pcs.every(function (pc) {
        return (graph.get(pc.id) || new Set()).has(candidate.id);
      });
    });
    var center = switches.length === 1 ? switches[0] : centerCandidates.length === 1 ? centerCandidates[0] : null;

    var wrongPc = pcs.find(function (pc) {
      var neighbors = graph.get(pc.id) || new Set();
      return !center || neighbors.size !== 1 || !neighbors.has(center.id);
    });
    if (wrongPc) hints.push(wrongPc.name + " deve ser conectado diretamente e somente ao switch central.");

    var pcToPc = snapshot.connections.some(function (connection) {
      var source = snapshot.nodes.find(function (node) { return node.id === connection.sourceId; });
      var target = snapshot.nodes.find(function (node) { return node.id === connection.targetId; });
      return source && target && source.type === "pc" && target.type === "pc";
    });
    if (pcToPc) hints.push("Na estrela, os computadores não devem ser ligados diretamente uns aos outros.");

    var pcToOtherSwitch = snapshot.connections.some(function (connection) {
      var source = snapshot.nodes.find(function (node) { return node.id === connection.sourceId; });
      var target = snapshot.nodes.find(function (node) { return node.id === connection.targetId; });
      if (!source || !target || !center) return false;
      if (source.type === "pc" && target.type === "switch") return target.id !== center.id;
      if (target.type === "pc" && source.type === "switch") return source.id !== center.id;
      return false;
    });
    if (pcToOtherSwitch) hints.push("Na estrela, nenhum computador pode ser ligado a outro switch.");

    var wrongRouter = routers.find(function (router) {
      var neighbors = graph.get(router.id) || new Set();
      return !center || !neighbors.has(center.id);
    });
    if (wrongRouter) hints.push("Conecte " + wrongRouter.name + " diretamente ao switch central.");

    var wrongInternet = internetNodes.find(function (internet) {
      var neighbors = Array.from(graph.get(internet.id) || []);
      return neighbors.length !== 1 || !snapshot.nodes.some(function (node) {
        return node.id === neighbors[0] && node.type === "router";
      });
    });
    if (wrongInternet) hints.push("Conecte " + wrongInternet.name + " diretamente a um roteador, não ao switch central.");

    function allowedStarConnection(connection) {
      var source = snapshot.nodes.find(function (node) { return node.id === connection.sourceId; });
      var target = snapshot.nodes.find(function (node) { return node.id === connection.targetId; });
      if (!source || !target || !center) return false;
      var pc = source.type === "pc" ? source : target.type === "pc" ? target : null;
      var switchNode = source.type === "switch" ? source : target.type === "switch" ? target : null;
      var router = source.type === "router" ? source : target.type === "router" ? target : null;
      var internet = source.type === "internet" ? source : target.type === "internet" ? target : null;
      if (pc && switchNode) return switchNode.id === center.id;
      if (router && switchNode) return switchNode.id === center.id;
      return Boolean(router && internet);
    }

    var invalidConnection = snapshot.connections.some(function (connection) {
      return !allowedStarConnection(connection);
    });
    if (invalidConnection && !pcToPc && !pcToOtherSwitch && !wrongInternet) {
      hints.push("Remova as conexões extras: use PC–Switch central, Roteador–Switch central e Internet–Roteador.");
    }

    var supportedNodes = switches.length + pcs.length + routers.length + internetNodes.length === snapshot.nodes.length;
    var expectedConnections = pcs.length + routers.length + internetNodes.length;
    var valid = cardsReady && !snapshot.buses.length && switches.length === 1 && pcs.length >= 3 && Boolean(center) && !wrongPc && !pcToPc && !pcToOtherSwitch && !wrongRouter && !wrongInternet && !invalidConnection && supportedNodes && snapshot.connections.length === expectedConnections;
    var internetAvailable = valid && internetNodes.length > 0;
    return result(valid, "star", hints, { centerId: center ? center.id : null, internetAvailable: internetAvailable });
  }

  function validateRing(snapshot) {
    var graph = graphFor(snapshot);
    var hints = [];
    var cardsReady = networkCardsReady(snapshot, hints);
    if (snapshot.buses.length) hints.push("Remova o barramento para montar o anel com cabos diretos.");
    if (snapshot.nodes.length < 3) hints.push("O anel precisa de pelo menos três equipamentos.");
    var wrong = snapshot.nodes.filter(function (node) { return (graph.get(node.id) || new Set()).size !== 2; });
    if (wrong.length) hints.push("Em um anel, " + wrong[0].name + " precisa ter exatamente duas conexões.");
    if (snapshot.nodes.length && !isConnected(snapshot, graph)) hints.push("Feche o anel ligando o último equipamento ao primeiro.");
    if (snapshot.connections.length > snapshot.nodes.length) hints.push("Remova conexões extras: um anel simples possui um cabo por equipamento.");
    var valid = cardsReady && !snapshot.buses.length && snapshot.nodes.length >= 3 && isConnected(snapshot, graph) && wrong.length === 0 && snapshot.connections.length === snapshot.nodes.length;
    return result(valid, "ring", hints, {});
  }

  function validateMesh(snapshot) {
    var graph = graphFor(snapshot);
    var hints = [];
    var n = snapshot.nodes.length;
    var expected = n * (n - 1) / 2;
    var missing = Math.max(0, expected - snapshot.connections.length);
    var cardsReady = networkCardsReady(snapshot, hints);
    if (snapshot.buses.length) hints.push("A malha completa usa ligações diretas, sem barramento.");
    if (n < 4) hints.push("A malha completa precisa de pelo menos quatro equipamentos.");
    var incomplete = snapshot.nodes.find(function (node) { return (graph.get(node.id) || new Set()).size !== n - 1; });
    if (incomplete && n >= 2) hints.push(incomplete.name + " ainda não está ligado diretamente a todos os demais.");
    if (missing > 0 && n >= 4) hints.push("A malha completa ainda precisa de " + missing + (missing === 1 ? " cabo." : " cabos."));
    var valid = cardsReady && !snapshot.buses.length && n >= 4 && snapshot.connections.length === expected && !incomplete && isConnected(snapshot, graph);
    return result(valid, "mesh", hints, { expectedEdges: expected, missingEdges: missing, classification: !valid && n >= 4 && snapshot.connections.length ? "malha parcial" : null });
  }

  function levelsFrom(rootId, graph) {
    var levels = new Map();
    var queue = [rootId];
    levels.set(rootId, 0);
    while (queue.length) {
      var current = queue.shift();
      (graph.get(current) || []).forEach(function (neighbor) {
        if (!levels.has(neighbor)) { levels.set(neighbor, levels.get(current) + 1); queue.push(neighbor); }
      });
    }
    return levels;
  }

  function validateTree(snapshot) {
    var graph = graphFor(snapshot);
    var hints = [];
    var switches = snapshot.nodes.filter(function (node) { return node.type === "switch"; });
    var pcs = snapshot.nodes.filter(function (node) { return node.type === "pc"; });
    var cardsReady = networkCardsReady(snapshot, hints);
    var connected = snapshot.nodes.length > 0 && isConnected(snapshot, graph);
    var cycle = hasCycle(graph);
    if (snapshot.buses.length) hints.push("Remova o barramento: a árvore usa ligações hierárquicas por cabos.");
    if (switches.length < 2) hints.push("Adicione um switch raiz e pelo menos um switch secundário.");
    if (pcs.length < 2) hints.push("Adicione pelo menos dois computadores nas ramificações.");
    if (!connected && snapshot.nodes.length) hints.push("Todos os equipamentos da árvore precisam pertencer à mesma rede.");
    if (cycle) hints.push("A topologia em árvore não pode possuir ciclos.");
    if (snapshot.nodes.length && snapshot.connections.length !== snapshot.nodes.length - 1) hints.push("Uma árvore deve possuir exatamente equipamentos menos um cabos.");

    var root = switches.find(function (candidate) {
      var levels = levelsFrom(candidate.id, graph);
      var rootBranches = (graph.get(candidate.id) || new Set()).size >= 2;
      var hasSecondaryBranch = switches.some(function (secondary) {
        if (levels.get(secondary.id) !== 1) return false;
        return Array.from(graph.get(secondary.id) || []).some(function (neighbor) { return levels.get(neighbor) === 2; });
      });
      var maxLevel = Math.max.apply(null, Array.from(levels.values()).concat([0]));
      return rootBranches && hasSecondaryBranch && maxLevel >= 2;
    });
    if (switches.length >= 2 && !root) hints.push("Crie dois níveis: switch principal, switch secundário e computadores nas pontas.");
    var valid = cardsReady && !snapshot.buses.length && switches.length >= 2 && pcs.length >= 2 && connected && !cycle && snapshot.connections.length === snapshot.nodes.length - 1 && Boolean(root);
    return result(valid, "tree", hints, { rootId: root ? root.id : null, hasCycle: cycle });
  }

  function validateBus(snapshot) {
    var hints = [];
    var pcs = snapshot.nodes.filter(function (node) { return node.type === "pc"; });
    var cardsReady = networkCardsReady(snapshot, hints);
    if (snapshot.buses.length !== 1) hints.push(snapshot.buses.length ? "Use exatamente um barramento principal." : "Adicione um barramento principal.");
    if (pcs.length < 3) hints.push("Adicione pelo menos três computadores ao desafio de barramento.");
    if (snapshot.nodes.some(function (node) { return node.type !== "pc"; })) hints.push("Neste desafio, conecte computadores diretamente ao meio compartilhado, sem switches.");
    var bus = snapshot.buses.length === 1 ? snapshot.buses[0] : null;
    if (bus) {
      var attached = new Set(bus.attachments.map(function (attachment) { return attachment.nodeId; }));
      var missing = snapshot.nodes.find(function (node) { return !attached.has(node.id); });
      if (missing) hints.push(missing.name + " ainda não está conectado ao barramento principal.");
    }
    if (snapshot.connections.length) hints.push("Remova os cabos diretos: no barramento, os computadores compartilham a linha principal.");
    var valid = cardsReady && Boolean(bus) && snapshot.buses.length === 1 && pcs.length >= 3 && pcs.length === snapshot.nodes.length && bus.attachments.length === snapshot.nodes.length && snapshot.connections.length === 0;
    return result(valid, "bus", hints, { busId: bus ? bus.id : null });
  }

  var validators = { star: validateStar, bus: validateBus, ring: validateRing, mesh: validateMesh, tree: validateTree };

  function validate(topology, snapshot) {
    var cleanSnapshot = snapshot || NetLab.State.captureProject();
    if (topology === "free") {
      var order = ["bus", "mesh", "ring", "star", "tree"];
      for (var i = 0; i < order.length; i += 1) {
        var detected = validators[order[i]](cleanSnapshot);
        if (detected.valid) return detected;
      }
      return result(false, "free", ["Ainda não reconheci uma topologia completa. Confira os equipamentos e cabos."], {});
    }
    return validators[topology] ? validators[topology](cleanSnapshot) : result(false, topology, ["Escolha um desafio válido."], {});
  }

  NetLab.TopologyValidator = { validate: validate };
}());
