(function () {
  "use strict";

  var NetLab = window.NetLab = window.NetLab || {};

  function pairKey(a, b) { return [a, b].sort().join("|"); }

  function canConnectNode(node) {
    return Boolean(node && (node.type !== "pc" || node.hasNetworkCard));
  }

  function missingCardMessage(node) {
    return "Instale uma placa de rede no " + node.name + " antes de conectar um cabo.";
  }

  function allowsDirectPcConnection(challenge) {
    return ["ring", "mesh", "free", "basic-direct"].indexOf(challenge) >= 0;
  }

  function activeChallenge() {
    return NetLab.State && NetLab.State.data ? NetLab.State.data.challenge : "free";
  }

  function connectionRule(source, target, challenge) {
    if (!source || !target) return { allowed: false, message: "Escolha dois equipamentos válidos." };
    var pair = [source.type, target.type].sort().join("|");
    var topology = typeof challenge === "string" ? challenge : activeChallenge();
    var allowed = ["internet|router", "pc|router", "pc|switch", "router|switch", "switch|switch"].indexOf(pair) >= 0
      || (pair === "router|router" && NetLab.PortModel.isPortChallenge(topology))
      || (pair === "pc|pc" && allowsDirectPcConnection(topology));
    if (allowed) return { allowed: true, message: "" };
    if (source.type === "internet" || target.type === "internet") return { allowed: false, message: "A Internet só pode ser ligada a um Roteador." };
    if (source.type === "pc" && target.type === "pc") return { allowed: false, message: "Conexões diretas entre PCs são permitidas no Primeiro enlace, em Anel, Malha ou Modo livre." };
    if (source.type === "router" && target.type === "router") return { allowed: false, message: "A ligação direta entre roteadores é praticada na trilha Tipos de redes." };
    return { allowed: false, message: "Essa combinação de equipamentos não aceita conexão direta." };
  }

  function isPairAllowed(source, target, challenge) { return connectionRule(source, target, challenge).allowed; }

  function add(sourceId, targetId, sourcePortId, targetPortId) {
    var source = NetLab.State.getNode(sourceId);
    var target = NetLab.State.getNode(targetId);
    if (sourceId === targetId || !source || !target) {
      return { ok: false, message: "Escolha dois equipamentos diferentes." };
    }
    var rule = connectionRule(source, target);
    if (!rule.allowed) return { ok: false, message: rule.message, reason: "invalid-type" };
    var topology = activeChallenge();
    var portRule = NetLab.PortModel.validateConnection(
      source,
      target,
      sourcePortId || null,
      targetPortId || null,
      topology,
      NetLab.State.data.connections
    );
    if (!portRule.allowed) return { ok: false, message: portRule.message, reason: portRule.reason || "invalid-port" };
    if (!canConnectNode(source)) return { ok: false, message: missingCardMessage(source), nodeId: source.id };
    if (!canConnectNode(target)) return { ok: false, message: missingCardMessage(target), nodeId: target.id };
    var key = pairKey(sourceId, targetId);
    var duplicate = NetLab.State.data.connections.some(function (connection) { return pairKey(connection.sourceId, connection.targetId) === key; });
    if (duplicate) return { ok: false, message: "Esses equipamentos já estão conectados." };
    var connection = { id: NetLab.State.createId("cable"), sourceId: sourceId, targetId: targetId, type: "ethernet" };
    if (NetLab.PortModel.isPortChallenge(topology)) {
      connection.sourcePortId = sourcePortId || null;
      connection.targetPortId = targetPortId || null;
    }
    NetLab.State.data.connections.push(connection);
    NetLab.State.data.selected = { kind: "connection", id: connection.id };
    NetLab.History.record("add-cable");
    NetLab.State.emit("add-cable");
    return { ok: true, connection: connection };
  }

  function nearestAnchor(offset, bus) {
    var index = Math.round(NetLab.State.clamp(offset, 0, 1) * 11);
    var used = new Set(bus.attachments.map(function (attachment) { return Math.round(attachment.offset * 11); }));
    if (!used.has(index)) return index / 11;
    for (var distance = 1; distance < 12; distance += 1) {
      var left = index - distance;
      var right = index + distance;
      if (left >= 0 && !used.has(left)) return left / 11;
      if (right <= 11 && !used.has(right)) return right / 11;
    }
    return null;
  }

  function attachToBus(nodeId, busId, requestedOffset) {
    var node = NetLab.State.getNode(nodeId);
    var bus = NetLab.State.getBus(busId);
    if (!node || !bus) return { ok: false, message: "Não foi possível criar a ligação com o barramento." };
    if (NetLab.PortModel.isPortChallenge(activeChallenge())) return { ok: false, message: "A trilha Tipos de redes usa apenas cabos e portas físicas, sem barramento.", reason: "invalid-type" };
    if (node.type === "internet") return { ok: false, message: "A Internet deve ser ligada diretamente a um Roteador.", reason: "invalid-type" };
    if (!canConnectNode(node)) return { ok: false, message: missingCardMessage(node), nodeId: node.id };
    if (bus.attachments.some(function (attachment) { return attachment.nodeId === nodeId; })) return { ok: false, message: node.name + " já está ligado a este barramento." };
    var offset = nearestAnchor(Number(requestedOffset) || 0, bus);
    if (offset === null) return { ok: false, message: "Todos os pontos deste barramento estão ocupados." };
    var attachment = { id: NetLab.State.createId("attachment"), nodeId: nodeId, offset: offset };
    bus.attachments.push(attachment);
    NetLab.State.data.selected = { kind: "attachment", id: attachment.id };
    NetLab.History.record("attach-bus");
    NetLab.State.emit("attach-bus");
    return { ok: true, attachment: attachment };
  }

  function nodeCenter(node) { return { x: node.x + node.width / 2, y: node.y + node.height / 2 }; }
  function endpointPoint(node, portId) {
    return NetLab.PortModel.endpointPoint(node, portId, activeChallenge());
  }
  function busPoint(bus, attachment) { return { x: bus.x + bus.width * attachment.offset, y: bus.y + 24 }; }

  function smoothPath(start, end) {
    var distance = Math.abs(end.x - start.x);
    var bend = Math.max(34, Math.min(140, distance * .34));
    var direction = end.x >= start.x ? 1 : -1;
    return "M " + start.x + " " + start.y + " C " + (start.x + bend * direction) + " " + start.y + ", " + (end.x - bend * direction) + " " + end.y + ", " + end.x + " " + end.y;
  }

  function connectionPath(connection) {
    var source = NetLab.State.getNode(connection.sourceId);
    var target = NetLab.State.getNode(connection.targetId);
    return source && target
      ? smoothPath(endpointPoint(source, connection.sourcePortId), endpointPoint(target, connection.targetPortId))
      : "";
  }

  function storedConnectionAllowed(connection, source, target) {
    if (!isPairAllowed(source, target) || !canConnectNode(source) || !canConnectNode(target)) return false;
    return NetLab.PortModel.validatePairPorts(
      source,
      target,
      connection.sourcePortId,
      connection.targetPortId,
      activeChallenge()
    ).allowed;
  }

  function attachmentPath(bus, attachment) {
    var node = NetLab.State.getNode(attachment.nodeId);
    if (!node) return "";
    var start = nodeCenter(node);
    var end = busPoint(bus, attachment);
    return "M " + start.x + " " + start.y + " L " + start.x + " " + (end.y - 18) + " Q " + start.x + " " + end.y + " " + end.x + " " + end.y;
  }

  function buildGraph() {
    var adjacency = new Map();
    NetLab.State.data.nodes.forEach(function (node) { adjacency.set(node.id, []); });
    NetLab.State.data.buses.forEach(function (bus) { adjacency.set("bus:" + bus.id, []); });
    NetLab.State.data.connections.forEach(function (connection) {
      if (!adjacency.has(connection.sourceId) || !adjacency.has(connection.targetId)) return;
      var source = NetLab.State.getNode(connection.sourceId);
      var target = NetLab.State.getNode(connection.targetId);
      if (!storedConnectionAllowed(connection, source, target)) return;
      adjacency.get(connection.sourceId).push({ id: connection.targetId, edge: { kind: "connection", id: connection.id } });
      adjacency.get(connection.targetId).push({ id: connection.sourceId, edge: { kind: "connection", id: connection.id } });
    });
    NetLab.State.data.buses.forEach(function (bus) {
      var busVertex = "bus:" + bus.id;
      bus.attachments.forEach(function (attachment) {
        if (!adjacency.has(attachment.nodeId)) return;
        if (!canConnectNode(NetLab.State.getNode(attachment.nodeId))) return;
        adjacency.get(attachment.nodeId).push({ id: busVertex, edge: { kind: "attachment", id: attachment.id, busId: bus.id } });
        adjacency.get(busVertex).push({ id: attachment.nodeId, edge: { kind: "attachment", id: attachment.id, busId: bus.id } });
      });
    });
    return adjacency;
  }

  function findPath(sourceId, targetId) {
    var graph = buildGraph();
    if (!graph.has(sourceId) || !graph.has(targetId)) return null;
    var queue = [sourceId];
    var previous = new Map();
    previous.set(sourceId, null);
    while (queue.length) {
      var current = queue.shift();
      if (current === targetId) break;
      graph.get(current).forEach(function (neighbor) {
        if (!previous.has(neighbor.id)) {
          previous.set(neighbor.id, { vertex: current, edge: neighbor.edge });
          queue.push(neighbor.id);
        }
      });
    }
    if (!previous.has(targetId)) return null;
    var vertices = [];
    var edges = [];
    var cursor = targetId;
    while (cursor !== null) {
      vertices.unshift(cursor);
      var step = previous.get(cursor);
      if (step) edges.unshift(step.edge);
      cursor = step ? step.vertex : null;
    }
    return { vertices: vertices, edges: edges };
  }

  function degreeMap() {
    var map = new Map();
    var graph = buildGraph();
    NetLab.State.data.nodes.forEach(function (node) {
      map.set(node.id, (graph.get(node.id) || []).length);
    });
    return map;
  }

  function recalculateStatuses() {
    var graph = buildGraph();
    var onlineRouters = new Set();
    NetLab.State.data.connections.forEach(function (connection) {
      var source = NetLab.State.getNode(connection.sourceId);
      var target = NetLab.State.getNode(connection.targetId);
      if (!source || !target || !storedConnectionAllowed(connection, source, target)) return;
      if (source.type === "internet" && target.type === "router") onlineRouters.add(target.id);
      if (target.type === "internet" && source.type === "router") onlineRouters.add(source.id);
    });

    var reachable = new Set();
    var queue = Array.from(onlineRouters);
    queue.forEach(function (id) { reachable.add(id); });
    while (queue.length) {
      var current = queue.shift();
      (graph.get(current) || []).forEach(function (neighbor) {
        if (reachable.has(neighbor.id)) return;
        reachable.add(neighbor.id);
        queue.push(neighbor.id);
      });
    }

    NetLab.State.data.nodes.forEach(function (node) {
      var physicalLinks = (graph.get(node.id) || []).length;
      if (node.type === "internet") node.status = reachable.has(node.id) ? "connected" : "disconnected";
      else if (!physicalLinks) node.status = "disconnected";
      else node.status = reachable.has(node.id) ? "connected" : "no-internet";
    });
    return { onlineRouters: onlineRouters, reachable: reachable };
  }

  function hasActiveInternet() {
    return NetLab.State.data.nodes.some(function (node) { return node.type === "router" && node.status === "connected"; });
  }

  NetLab.Connections = {
    add: add,
    attachToBus: attachToBus,
    canConnectNode: canConnectNode,
    allowsDirectPcConnection: allowsDirectPcConnection,
    connectionRule: connectionRule,
    isPairAllowed: isPairAllowed,
    nodeCenter: nodeCenter,
    endpointPoint: endpointPoint,
    busPoint: busPoint,
    smoothPath: smoothPath,
    connectionPath: connectionPath,
    attachmentPath: attachmentPath,
    buildGraph: buildGraph,
    findPath: findPath,
    degreeMap: degreeMap,
    recalculateStatuses: recalculateStatuses,
    hasActiveInternet: hasActiveInternet
  };
}());
