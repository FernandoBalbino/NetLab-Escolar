(function () {
  "use strict";

  var NetLab = window.NetLab = window.NetLab || {};

  function byType(nodes, type) { return nodes.filter(function (node) { return node.type === type; }); }
  function push(hints, message) { if (message && hints.indexOf(message) < 0) hints.push(message); }

  function physicalCheck(challengeId, nodes, connections, hints) {
    var accepted = [];
    var nodeById = new Map(nodes.map(function (node) { return [node.id, node]; }));
    connections.forEach(function (connection) {
      var source = nodeById.get(connection.sourceId);
      var target = nodeById.get(connection.targetId);
      if (!source || !target) {
        push(hints, "Remova cabos que apontam para equipamentos inexistentes.");
        return;
      }
      var result = NetLab.PortModel.validateConnection(
        source,
        target,
        connection.sourcePortId,
        connection.targetPortId,
        challengeId,
        accepted
      );
      if (!result.allowed) push(hints, result.message);
      else accepted.push(connection);
    });
    byType(nodes, "pc").forEach(function (pc) {
      if (!pc.hasNetworkCard) push(hints, "Instale uma placa de rede em todos os computadores antes de conectar os cabos.");
    });
    return accepted.length === connections.length;
  }

  function allFinalDevicesBelongToValidLan(analysis, nodes) {
    var covered = new Set();
    analysis.validLocalNetworks.forEach(function (network) {
      network.finalDeviceIds.forEach(function (id) { covered.add(id); });
    });
    return byType(nodes, "pc").every(function (pc) { return covered.has(pc.id); });
  }

  function validateLan(nodes, analysis, hints) {
    if (byType(nodes, "router").length !== 1) push(hints, "Use exatamente um roteador para representar a LAN da escola.");
    if (byType(nodes, "switch").length !== 1) push(hints, "Adicione um switch e ligue-o a uma porta LAN do roteador.");
    if (byType(nodes, "pc").length < 2) push(hints, "A LAN precisa de pelo menos dois computadores.");
    if (byType(nodes, "internet").length) push(hints, "Neste primeiro exercício, deixe a Internet fora da montagem.");
    if (!analysis.hasLAN) push(hints, "Conecte o switch e os computadores para formar uma rede local completa.");
    if (analysis.hasMAN || analysis.hasWAN) push(hints, "O resultado deve conter somente uma LAN.");
    if (!allFinalDevicesBelongToValidLan(analysis, nodes)) push(hints, "Todos os computadores precisam pertencer à mesma LAN.");
  }

  function validateMan(nodes, analysis, hints) {
    var routers = byType(nodes, "router");
    if (routers.length !== 2) push(hints, "Use exatamente dois roteadores, um para cada rede local.");
    if (byType(nodes, "pc").length < 2) push(hints, "Conecte pelo menos um computador à LAN de cada roteador.");
    if (routers.some(function (router) { return NetLab.NetworkScope.getRouterCity(router.id, { nodes: nodes, connections: [], buses: [] }) !== "maceio"; })) {
      push(hints, "Mantenha os dois roteadores em Maceió para representar uma MAN.");
    }
    if (analysis.validLocalNetworks.filter(function (network) { return network.routerId; }).length < 2) {
      push(hints, "Antes da MAN, cada roteador precisa possuir sua própria LAN com um computador.");
    }
    if (!analysis.hasMAN) push(hints, "Depois de completar as duas LANs, ligue WAN à WAN entre os roteadores.");
    if (analysis.hasWAN) push(hints, "Uma MAN liga redes da mesma cidade; revise a cidade e as portas usadas.");
  }

  function validateWanTransform(nodes, analysis, hints) {
    var routers = byType(nodes, "router");
    var cities = new Set(routers.map(function (router) { return NetLab.NetworkScope.sanitizeCity(router.city); }));
    if (routers.length !== 2 || analysis.validLocalNetworks.filter(function (network) { return network.routerId; }).length !== 2) {
      push(hints, "Preserve as duas LANs prontas do cenário.");
    }
    if (!(cities.has("maceio") && cities.has("arapiraca"))) push(hints, "Selecione um roteador e altere sua cidade para Arapiraca.");
    if (!analysis.hasWAN) push(hints, "A WAN aparece quando as LANs de Maceió e Arapiraca continuam conectadas.");
    if (analysis.hasMAN) push(hints, "A rede não deve continuar como MAN depois que os roteadores ficam em cidades diferentes.");
  }

  function validateInternetWan(nodes, analysis, hints) {
    if (byType(nodes, "internet").length !== 1) push(hints, "Adicione exatamente uma fonte de Internet.");
    if (!byType(nodes, "router").length) push(hints, "Adicione um roteador para separar a LAN da Internet.");
    if (!analysis.hasLAN) push(hints, "Complete primeiro a LAN com roteador, switch e computadores.");
    if (!analysis.hasWAN) push(hints, "Ligue a Internet à porta WAN do roteador.");
    if (analysis.hasMAN) push(hints, "Uma conexão com a Internet não cria uma MAN.");
  }

  function validateQuiz(snapshot, analysis, hints) {
    var data = snapshot.challengeData;
    if (!data || !data.quizComplete) push(hints, "Classifique corretamente os três cenários antes de verificar.");
    if (!analysis.hasLAN) push(hints, "O cenário atual deve conter pelo menos uma LAN válida para ser analisado.");
  }

  var validators = {
    "types-lan-ports": validateLan,
    "types-switch-capacity": validateMan,
    "types-wan-access": validateWanTransform,
    "types-man-link": validateInternetWan
  };

  function validate(challengeId, snapshot) {
    var safeSnapshot = snapshot || { nodes: [], connections: [], buses: [] };
    var nodes = Array.isArray(safeSnapshot.nodes) ? safeSnapshot.nodes : [];
    var connections = Array.isArray(safeSnapshot.connections) ? safeSnapshot.connections : [];
    var buses = Array.isArray(safeSnapshot.buses) ? safeSnapshot.buses : [];
    var hints = [];
    if (buses.length) push(hints, "Remova o barramento: nesta trilha, pratique as portas físicas de roteadores e switches.");
    var physicalReady = physicalCheck(challengeId, nodes, connections, hints);
    var analysis = NetLab.NetworkScope.classifyNetworkScope(safeSnapshot);
    if (challengeId === "types-complete") validateQuiz(safeSnapshot, analysis, hints);
    else if (validators[challengeId]) validators[challengeId](nodes, analysis, hints);
    else push(hints, "Este exercício de tipos de rede não foi reconhecido.");
    return {
      valid: Boolean(physicalReady && !buses.length && hints.length === 0),
      topology: challengeId,
      challengeId: challengeId,
      hints: hints,
      details: {
        physicalPortsReady: physicalReady,
        nodeCount: nodes.length,
        connectionCount: connections.length,
        classification: analysis.classifications.join(" + ") || "nenhuma",
        analysis: analysis
      }
    };
  }

  NetLab.NetworkTypesValidator = { validate: validate };
}());
