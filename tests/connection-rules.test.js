"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var vm = require("node:vm");

var context = {
  window: { NetLab: {} },
  console: console,
  Map: Map,
  Set: Set,
  clearTimeout: clearTimeout,
  setTimeout: setTimeout
};
vm.createContext(context);

function loadScript(name) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", name), "utf8"), context);
}

loadScript("topology-validator.js");
loadScript("state.js");
loadScript("connections.js");
loadScript("ipv4.js");
loadScript("storage.js");

var NetLab = context.window.NetLab;
NetLab.History = { record: function () {} };

function node(id) {
  return {
    id: id,
    type: "pc",
    name: id.toUpperCase(),
    x: 20,
    y: 20,
    width: 142,
    height: 158,
    status: "disconnected",
    hasNetworkCard: true
  };
}

function connection(sourceId, targetId) {
  return { id: sourceId + "-" + targetId, sourceId: sourceId, targetId: targetId, type: "ethernet" };
}

function project(challenge) {
  return {
    nodes: [node("pc1"), node("pc2")],
    connections: [connection("pc1", "pc2")],
    buses: [],
    challenge: challenge,
    hintsUsed: 0,
    zoom: 1,
    pan: { x: 0, y: 0 }
  };
}

var pc1 = node("pc1");
var pc2 = node("pc2");

["ring", "mesh", "free"].forEach(function (challenge) {
  NetLab.State.data.challenge = challenge;
  assert.equal(NetLab.Connections.connectionRule(pc1, pc2).allowed, true, "PC-PC deve ser permitido em " + challenge);
  assert.doesNotThrow(function () {
    NetLab.Storage.sanitizeProject(project(challenge), { strictConnections: true });
  }, "um projeto PC-PC deve ser carregado em " + challenge);
});

["star", "bus", "tree"].forEach(function (challenge) {
  NetLab.State.data.challenge = challenge;
  assert.equal(NetLab.Connections.connectionRule(pc1, pc2).allowed, false, "PC-PC deve ser bloqueado em " + challenge);
  assert.throws(function () {
    NetLab.Storage.sanitizeProject(project(challenge), { strictConnections: true });
  }, /tipos de equipamentos incompatíveis/, "um projeto PC-PC deve ser rejeitado em " + challenge);
});

["ring", "mesh", "free"].forEach(function (challenge) {
  NetLab.State.data.challenge = challenge;
  NetLab.State.data.nodes = [pc1, pc2];
  NetLab.State.data.connections = [];
  NetLab.State.data.buses = [];
  assert.equal(NetLab.Connections.add("pc1", "pc2").ok, true, "a criação real do cabo PC-PC deve funcionar em " + challenge);
});

var ringNodes = [node("pc1"), node("pc2"), node("pc3"), node("pc4")];
var ringConnections = [
  connection("pc1", "pc2"),
  connection("pc2", "pc3"),
  connection("pc3", "pc4"),
  connection("pc4", "pc1")
];
assert.equal(NetLab.TopologyValidator.validate("ring", { nodes: ringNodes, connections: ringConnections, buses: [] }).valid, true, "quatro PCs devem formar um Anel válido");

var meshConnections = [];
ringNodes.forEach(function (source, sourceIndex) {
  ringNodes.slice(sourceIndex + 1).forEach(function (target) {
    meshConnections.push(connection(source.id, target.id));
  });
});
assert.equal(NetLab.TopologyValidator.validate("mesh", { nodes: ringNodes, connections: meshConnections, buses: [] }).valid, true, "quatro PCs devem formar uma Malha completa válida");

console.log("CONNECTION_RULES_OK");
