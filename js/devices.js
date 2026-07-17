(function () {
  "use strict";

  var NetLab = window.NetLab = window.NetLab || {};
  var definitions = {
    pc: { prefix: "PC", width: 142, height: 158 },
    switch: { prefix: "Switch", width: 154, height: 124 },
    router: { prefix: "Roteador", width: 170, height: 148 },
    internet: { prefix: "Internet", width: 142, height: 130 }
  };

  function nextName(type) {
    var prefix = definitions[type].prefix;
    var highest = NetLab.State.data.nodes.reduce(function (max, node) {
      if (node.type !== type) return max;
      var match = node.name.match(new RegExp("^" + prefix + "-(\\d+)$", "i"));
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return prefix + "-" + (highest + 1);
  }

  function add(type, x, y) {
    if (!definitions[type]) return null;
    var width = definitions[type].width;
    var height = definitions[type].height;
    var node = {
      id: NetLab.State.createId("node"),
      type: type,
      name: nextName(type),
      x: NetLab.State.clamp(Number(x) || 0, 0, NetLab.State.WORLD_WIDTH - width),
      y: NetLab.State.clamp(Number(y) || 0, 0, NetLab.State.WORLD_HEIGHT - height),
      width: width,
      height: height,
      status: "disconnected",
      hasNetworkCard: type === "pc" ? false : undefined
    };
    NetLab.State.data.nodes.push(node);
    NetLab.State.data.selected = { kind: "node", id: node.id };
    NetLab.History.record("add-node");
    NetLab.State.emit("add-node");
    return node;
  }

  function addBus(x, y) {
    var width = 520;
    var index = NetLab.State.data.buses.length + 1;
    var bus = {
      id: NetLab.State.createId("bus"),
      name: index === 1 ? "Barramento principal" : "Barramento " + index,
      x: NetLab.State.clamp(Number(x) || 0, 0, NetLab.State.WORLD_WIDTH - width),
      y: NetLab.State.clamp(Number(y) || 0, 0, NetLab.State.WORLD_HEIGHT - 48),
      width: width,
      attachments: []
    };
    NetLab.State.data.buses.push(bus);
    NetLab.State.data.selected = { kind: "bus", id: bus.id };
    NetLab.History.record("add-bus");
    NetLab.State.emit("add-bus");
    return bus;
  }

  function renameNode(id, name) {
    var node = NetLab.State.getNode(id);
    var clean = String(name || "").trim().replace(/\s+/g, " ").slice(0, 32);
    if (!node || !clean || node.name === clean) return false;
    node.name = clean;
    NetLab.History.record("rename");
    NetLab.State.emit("rename");
    return true;
  }

  function installNetworkCard(id) {
    var node = NetLab.State.getNode(id);
    if (!node || node.type !== "pc" || node.hasNetworkCard) return false;
    node.hasNetworkCard = true;
    NetLab.History.record("install-network-card");
    NetLab.State.emit("install-network-card");
    return true;
  }

  function removeNode(id) {
    var before = NetLab.State.data.nodes.length;
    NetLab.State.data.nodes = NetLab.State.data.nodes.filter(function (node) { return node.id !== id; });
    if (NetLab.State.data.nodes.length === before) return false;
    NetLab.State.data.connections = NetLab.State.data.connections.filter(function (connection) { return connection.sourceId !== id && connection.targetId !== id; });
    NetLab.State.data.buses.forEach(function (bus) { bus.attachments = bus.attachments.filter(function (attachment) { return attachment.nodeId !== id; }); });
    return true;
  }

  function removeBus(id) {
    var before = NetLab.State.data.buses.length;
    NetLab.State.data.buses = NetLab.State.data.buses.filter(function (bus) { return bus.id !== id; });
    return NetLab.State.data.buses.length !== before;
  }

  function removeSelected() {
    var selected = NetLab.State.data.selected;
    if (!selected) return false;
    var removed = false;
    if (selected.kind === "node") removed = removeNode(selected.id);
    if (selected.kind === "bus") removed = removeBus(selected.id);
    if (selected.kind === "connection") {
      var before = NetLab.State.data.connections.length;
      NetLab.State.data.connections = NetLab.State.data.connections.filter(function (connection) { return connection.id !== selected.id; });
      removed = before !== NetLab.State.data.connections.length;
    }
    if (selected.kind === "attachment") {
      NetLab.State.data.buses.forEach(function (bus) {
        var beforeAttachments = bus.attachments.length;
        bus.attachments = bus.attachments.filter(function (attachment) { return attachment.id !== selected.id; });
        if (beforeAttachments !== bus.attachments.length) removed = true;
      });
    }
    if (!removed) return false;
    NetLab.State.data.selected = null;
    NetLab.History.record("delete");
    NetLab.State.emit("delete");
    return true;
  }

  function clearCanvas(keepChallenge) {
    NetLab.State.data.nodes = [];
    NetLab.State.data.connections = [];
    NetLab.State.data.buses = [];
    NetLab.State.data.selected = null;
    NetLab.State.data.connectionDraft = null;
    NetLab.State.data.communicationDraft = null;
    if (!keepChallenge) {
      NetLab.State.data.challenge = "free";
      NetLab.State.data.hintsUsed = 0;
    }
    NetLab.History.record("clear");
    NetLab.State.emit("clear");
  }

  function dimensionsFor(type) {
    var definition = definitions[type];
    return definition ? { width: definition.width, height: definition.height } : null;
  }

  NetLab.Devices = { add: add, addBus: addBus, renameNode: renameNode, installNetworkCard: installNetworkCard, removeNode: removeNode, removeBus: removeBus, removeSelected: removeSelected, clearCanvas: clearCanvas, dimensionsFor: dimensionsFor };
}());
