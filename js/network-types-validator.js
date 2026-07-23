(function () {
  "use strict";

  var NetLab = window.NetLab = window.NetLab || {};

  function byType(nodes, type) { return nodes.filter(function (node) { return node.type === type; }); }
  function otherId(connection, nodeId) { return connection.sourceId === nodeId ? connection.targetId : connection.sourceId; }
  function touching(connections, nodeId) {
    return connections.filter(function (connection) { return connection.sourceId === nodeId || connection.targetId === nodeId; });
  }
  function between(connections, firstId, secondId) {
    return connections.find(function (connection) {
      return (connection.sourceId === firstId && connection.targetId === secondId)
        || (connection.sourceId === secondId && connection.targetId === firstId);
    }) || null;
  }
  function portKind(node, connection, challengeId) {
    var port = NetLab.PortModel.findPort(node, NetLab.PortModel.portIdFor(connection, node.id), challengeId);
    return port ? port.kind : null;
  }
  function countMessage(labels, actual, expected) {
    return actual === expected ? "" : "Use exatamente " + expected + " " + (expected === 1 ? labels.one : labels.many) + ".";
  }
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

  function exactInventory(nodes, expected, hints) {
    ["internet", "router", "switch", "pc"].forEach(function (type) {
      var labels = {
        internet: { one: "fonte de Internet", many: "fontes de Internet" },
        router: { one: "roteador", many: "roteadores" },
        switch: { one: "switch", many: "switches" },
        pc: { one: "computador", many: "computadores" }
      }[type];
      push(hints, countMessage(labels, byType(nodes, type).length, expected[type] || 0));
    });
  }

  function directNeighborsAre(node, expectedType, expectedCount, nodes, connections) {
    var nodeById = new Map(nodes.map(function (item) { return [item.id, item]; }));
    var links = touching(connections, node.id);
    return links.length === expectedCount && links.every(function (connection) {
      var neighbor = nodeById.get(otherId(connection, node.id));
      return neighbor && neighbor.type === expectedType;
    });
  }

  function validateLanPorts(challengeId, nodes, connections, hints) {
    exactInventory(nodes, { router: 1, pc: 3 }, hints);
    var router = byType(nodes, "router")[0];
    var pcs = byType(nodes, "pc");
    if (!router || pcs.length !== 3) return;
    if (connections.length !== 3 || !pcs.every(function (pc) { return directNeighborsAre(pc, "router", 1, nodes, connections); })) {
      push(hints, "Ligue cada um dos três computadores diretamente a uma porta LAN diferente do roteador.");
    }
    var routerLinks = touching(connections, router.id);
    if (routerLinks.length !== 3 || routerLinks.some(function (connection) { return portKind(router, connection, challengeId) !== "lan"; })) {
      push(hints, "Neste exercício, ocupe LAN 1, LAN 2 e LAN 3 e deixe a WAN livre.");
    }
  }

  function validateSwitchCapacity(challengeId, nodes, connections, hints) {
    exactInventory(nodes, { router: 1, switch: 1, pc: 4 }, hints);
    var router = byType(nodes, "router")[0];
    var networkSwitch = byType(nodes, "switch")[0];
    var pcs = byType(nodes, "pc");
    if (!router || !networkSwitch || pcs.length !== 4) return;
    var routerSwitch = between(connections, router.id, networkSwitch.id);
    if (!routerSwitch || portKind(router, routerSwitch, challengeId) !== "lan") {
      push(hints, "Use uma porta LAN do roteador como uplink para o switch.");
    }
    if (!pcs.every(function (pc) { return directNeighborsAre(pc, "switch", 1, nodes, connections); })) {
      push(hints, "O roteador só tem três portas LAN: ligue os quatro computadores ao switch.");
    }
    if (touching(connections, networkSwitch.id).length !== 5) {
      push(hints, "O switch tem cinco portas: uma para o roteador e quatro para os computadores.");
    }
  }

  function validateWanAccess(challengeId, nodes, connections, hints) {
    exactInventory(nodes, { internet: 1, router: 1, pc: 2 }, hints);
    var internet = byType(nodes, "internet")[0];
    var router = byType(nodes, "router")[0];
    var pcs = byType(nodes, "pc");
    if (!internet || !router || pcs.length !== 2) return;
    var wanLink = between(connections, internet.id, router.id);
    if (!wanLink || portKind(router, wanLink, challengeId) !== "wan") push(hints, "Ligue a Internet exclusivamente à porta WAN do roteador.");
    if (!pcs.every(function (pc) { return directNeighborsAre(pc, "router", 1, nodes, connections); })) {
      push(hints, "Ligue os dois computadores às portas LAN do roteador.");
    }
    if (connections.length !== 3) push(hints, "A montagem precisa de três cabos: um WAN e dois LAN.");
  }

  function validateManLink(challengeId, nodes, connections, hints) {
    exactInventory(nodes, { router: 2, pc: 2 }, hints);
    var routers = byType(nodes, "router");
    var pcs = byType(nodes, "pc");
    if (routers.length !== 2 || pcs.length !== 2) return;
    var interRouter = between(connections, routers[0].id, routers[1].id);
    if (!interRouter || portKind(routers[0], interRouter, challengeId) !== "wan" || portKind(routers[1], interRouter, challengeId) !== "wan") {
      push(hints, "Represente o enlace MAN ligando a WAN de um roteador à WAN do outro.");
    }
    var eachRouterHasPc = routers.every(function (router) {
      return touching(connections, router.id).some(function (connection) {
        var neighbor = nodes.find(function (node) { return node.id === otherId(connection, router.id); });
        return neighbor && neighbor.type === "pc" && portKind(router, connection, challengeId) === "lan";
      });
    });
    if (!eachRouterHasPc || !pcs.every(function (pc) { return directNeighborsAre(pc, "router", 1, nodes, connections); })) {
      push(hints, "Crie uma LAN em cada lado: um computador na porta LAN de cada roteador.");
    }
    if (connections.length !== 3) push(hints, "Use dois cabos LAN e um enlace WAN ↔ WAN.");
  }

  function validateComplete(challengeId, nodes, connections, hints) {
    exactInventory(nodes, { internet: 1, router: 2, switch: 1, pc: 4 }, hints);
    var internet = byType(nodes, "internet")[0];
    var routers = byType(nodes, "router");
    var networkSwitch = byType(nodes, "switch")[0];
    var pcs = byType(nodes, "pc");
    if (!internet || routers.length !== 2 || !networkSwitch || pcs.length !== 4) return;
    var upstream = routers.find(function (router) {
      var link = between(connections, internet.id, router.id);
      return link && portKind(router, link, challengeId) === "wan";
    });
    if (!upstream) {
      push(hints, "Escolha o roteador principal e ligue a Internet à porta WAN dele.");
      return;
    }
    var downstream = routers.find(function (router) { return router.id !== upstream.id; });
    var cityLink = between(connections, upstream.id, downstream.id);
    if (!cityLink || portKind(upstream, cityLink, challengeId) !== "lan" || portKind(downstream, cityLink, challengeId) !== "wan") {
      push(hints, "Ligue uma LAN do roteador principal à WAN do segundo roteador.");
    }
    var downstreamSwitch = between(connections, downstream.id, networkSwitch.id);
    if (!downstreamSwitch || portKind(downstream, downstreamSwitch, challengeId) !== "lan") {
      push(hints, "Ligue uma porta LAN do segundo roteador ao switch.");
    }
    var upstreamPcs = pcs.filter(function (pc) { return between(connections, upstream.id, pc.id); });
    var switchPcs = pcs.filter(function (pc) { return between(connections, networkSwitch.id, pc.id); });
    if (upstreamPcs.length !== 1 || switchPcs.length !== 3 || !pcs.every(function (pc) { return touching(connections, pc.id).length === 1; })) {
      push(hints, "Deixe um computador na LAN principal e conecte os outros três ao switch da segunda LAN.");
    }
    if (connections.length !== 7) push(hints, "A rede completa usa sete cabos sem ligações extras.");
  }

  var validators = {
    "types-lan-ports": validateLanPorts,
    "types-switch-capacity": validateSwitchCapacity,
    "types-wan-access": validateWanAccess,
    "types-man-link": validateManLink,
    "types-complete": validateComplete
  };

  function validate(challengeId, snapshot) {
    var nodes = snapshot && Array.isArray(snapshot.nodes) ? snapshot.nodes : [];
    var connections = snapshot && Array.isArray(snapshot.connections) ? snapshot.connections : [];
    var buses = snapshot && Array.isArray(snapshot.buses) ? snapshot.buses : [];
    var hints = [];
    if (buses.length) push(hints, "Remova o barramento: nesta trilha, pratique as portas físicas de roteadores e switches.");
    var physicalReady = physicalCheck(challengeId, nodes, connections, hints);
    var validator = validators[challengeId];
    if (validator) validator(challengeId, nodes, connections, hints);
    else push(hints, "Este exercício de tipos de rede não foi reconhecido.");
    return {
      valid: Boolean(validator && physicalReady && !buses.length && hints.length === 0),
      topology: challengeId,
      challengeId: challengeId,
      hints: hints,
      details: {
        physicalPortsReady: physicalReady,
        nodeCount: nodes.length,
        connectionCount: connections.length
      }
    };
  }

  NetLab.NetworkTypesValidator = { validate: validate };
}());
