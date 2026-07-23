(function () {
  "use strict";

  var NetLab = window.NetLab = window.NetLab || {};
  var TYPE_PREFIX = "types-";
  var PORTS = {
    router: [
      { id: "wan", kind: "wan", label: "WAN" },
      { id: "lan-1", kind: "lan", label: "LAN 1" },
      { id: "lan-2", kind: "lan", label: "LAN 2" },
      { id: "lan-3", kind: "lan", label: "LAN 3" }
    ],
    switch: [
      { id: "port-1", kind: "lan", label: "1" },
      { id: "port-2", kind: "lan", label: "2" },
      { id: "port-3", kind: "lan", label: "3" },
      { id: "port-4", kind: "lan", label: "4" },
      { id: "port-5", kind: "lan", label: "5" }
    ]
  };

  function isPortChallenge(challenge) {
    return typeof challenge === "string" && challenge.indexOf(TYPE_PREFIX) === 0;
  }

  function portsFor(nodeOrType, challenge) {
    var type = typeof nodeOrType === "string" ? nodeOrType : nodeOrType && nodeOrType.type;
    if (!isPortChallenge(challenge)) return [];
    return (PORTS[type] || []).map(function (port) { return Object.assign({}, port); });
  }

  function findPort(node, portId, challenge) {
    return portsFor(node, challenge).find(function (port) { return port.id === portId; }) || null;
  }

  function portIdFor(connection, nodeId) {
    if (!connection) return null;
    if (connection.sourceId === nodeId) return connection.sourcePortId || null;
    if (connection.targetId === nodeId) return connection.targetPortId || null;
    return null;
  }

  function connectionForPort(connections, nodeId, portId, excludeId) {
    return (connections || []).find(function (connection) {
      if (excludeId && connection.id === excludeId) return false;
      return portIdFor(connection, nodeId) === portId;
    }) || null;
  }

  function endpointPort(node, portId, challenge) {
    var available = portsFor(node, challenge);
    if (!available.length) {
      if (portId) return { valid: false, message: node.name + " não usa uma porta selecionável neste exercício." };
      return { valid: true, port: null };
    }
    if (!portId) return { valid: false, message: "Escolha uma porta física no " + node.name + "." };
    var port = findPort(node, portId, challenge);
    if (!port) return { valid: false, message: "A porta escolhida não existe no " + node.name + "." };
    return { valid: true, port: port };
  }

  function validatePairPorts(source, target, sourcePortId, targetPortId, challenge) {
    if (!isPortChallenge(challenge)) return { allowed: true, message: "" };
    var sourceResult = endpointPort(source, sourcePortId, challenge);
    if (!sourceResult.valid) return { allowed: false, message: sourceResult.message };
    var targetResult = endpointPort(target, targetPortId, challenge);
    if (!targetResult.valid) return { allowed: false, message: targetResult.message };
    var sourcePort = sourceResult.port;
    var targetPort = targetResult.port;
    var pair = [source.type, target.type].sort().join("|");

    if (pair === "internet|router") {
      var internetRouterPort = source.type === "router" ? sourcePort : targetPort;
      return internetRouterPort && internetRouterPort.kind === "wan"
        ? { allowed: true, message: "" }
        : { allowed: false, message: "A Internet deve entrar pela porta WAN do roteador." };
    }
    if (pair === "pc|router" || pair === "router|switch") {
      var routerPort = source.type === "router" ? sourcePort : targetPort;
      return routerPort && routerPort.kind === "lan"
        ? { allowed: true, message: "" }
        : { allowed: false, message: "Computadores e switches devem usar uma porta LAN do roteador." };
    }
    if (pair === "pc|switch" || pair === "switch|switch") return { allowed: true, message: "" };
    if (pair === "router|router") {
      if (!sourcePort || !targetPort || (sourcePort.kind === "lan" && targetPort.kind === "lan")) {
        return { allowed: false, message: "Para ligar roteadores entre redes, use WAN ↔ WAN ou LAN ↔ WAN." };
      }
      return { allowed: true, message: "" };
    }
    return { allowed: false, message: "Essa combinação de equipamentos não aceita conexão direta." };
  }

  function validateConnection(source, target, sourcePortId, targetPortId, challenge, connections, excludeId) {
    var pairRule = validatePairPorts(source, target, sourcePortId, targetPortId, challenge);
    if (!pairRule.allowed) return pairRule;
    if (!isPortChallenge(challenge)) return pairRule;

    if (sourcePortId && connectionForPort(connections, source.id, sourcePortId, excludeId)) {
      return { allowed: false, message: "A porta escolhida no " + source.name + " já está ocupada.", reason: "occupied-port" };
    }
    if (targetPortId && connectionForPort(connections, target.id, targetPortId, excludeId)) {
      return { allowed: false, message: "A porta escolhida no " + target.name + " já está ocupada.", reason: "occupied-port" };
    }
    return { allowed: true, message: "" };
  }

  function endpointPoint(node, portId, challenge) {
    var ports = portsFor(node, challenge);
    var index = ports.findIndex(function (port) { return port.id === portId; });
    if (index < 0) return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
    return {
      x: node.x + node.width + 27,
      y: node.y + node.height * ((index + .5) / ports.length)
    };
  }

  NetLab.PortModel = {
    isPortChallenge: isPortChallenge,
    portsFor: portsFor,
    findPort: findPort,
    portIdFor: portIdFor,
    connectionForPort: connectionForPort,
    validatePairPorts: validatePairPorts,
    validateConnection: validateConnection,
    endpointPoint: endpointPoint
  };
}());
