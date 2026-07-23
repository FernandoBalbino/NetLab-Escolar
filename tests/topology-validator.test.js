"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var vm = require("node:vm");

var context = { window: { NetLab: {} }, Map: Map, Set: Set };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "topology-validator.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "state.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "port-model.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "connections.js"), "utf8"), context);

function node(id, type) {
  return { id: id, type: type, name: id, hasNetworkCard: type === "pc" ? true : undefined };
}

function connection(sourceId, targetId) {
  return { id: sourceId + "-" + targetId, sourceId: sourceId, targetId: targetId };
}

function snapshot(nodes, connections) {
  return { nodes: nodes, connections: connections, buses: [] };
}

function validateStar(nodes, connections) {
  return context.window.NetLab.TopologyValidator.validate("star", snapshot(nodes, connections));
}

var lanNodes = [node("switch", "switch"), node("pc1", "pc"), node("pc2", "pc"), node("pc3", "pc")];
var lanConnections = [connection("switch", "pc1"), connection("switch", "pc2"), connection("switch", "pc3")];

assert.equal(validateStar(lanNodes, lanConnections).valid, true, "uma estrela LAN sem Internet deve ser válida");

var routerNodes = lanNodes.concat([node("router", "router")]);
var routerConnections = lanConnections.concat([connection("router", "switch")]);
var withoutInternet = validateStar(routerNodes, routerConnections);
assert.equal(withoutInternet.valid, true, "roteador sem Internet não deve invalidar a estrela");
assert.equal(withoutInternet.details.internetAvailable, false, "a conectividade deve permanecer separada da topologia");

var completeNodes = routerNodes.concat([node("internet", "internet")]);
var completeConnections = routerConnections.concat([connection("internet", "router")]);
var complete = validateStar(completeNodes, completeConnections);
assert.equal(complete.valid, true, "Internet -> Roteador -> Switch -> PCs deve ser aceita");
assert.equal(complete.details.centerId, "switch");
assert.equal(complete.details.internetAvailable, true);

assert.equal(validateStar(lanNodes, lanConnections.concat([connection("pc1", "pc2")])).valid, false, "PC-PC deve ser rejeitado");

var twoSwitches = lanNodes.concat([node("switch2", "switch")]);
var pcOnOtherSwitch = [connection("switch", "pc1"), connection("switch", "pc2"), connection("switch2", "pc3")];
assert.equal(validateStar(twoSwitches, pcOnOtherSwitch).valid, false, "PC em outro switch deve ser rejeitado");

var internetOnSwitch = routerConnections.concat([connection("internet", "switch")]);
assert.equal(validateStar(completeNodes, internetOnSwitch).valid, false, "Internet ligada ao switch deve ser rejeitada");

var routerOutsideLan = lanConnections.concat([connection("internet", "router")]);
assert.equal(validateStar(completeNodes, routerOutsideLan).valid, false, "roteador fora do switch central deve ser rejeitado");

context.window.NetLab.State.data.nodes = routerNodes;
context.window.NetLab.State.data.connections = routerConnections;
context.window.NetLab.State.data.buses = [];
context.window.NetLab.Connections.recalculateStatuses();
assert.equal(context.window.NetLab.State.data.nodes.find(function (item) { return item.id === "pc1"; }).status, "no-internet", "a estrela sem Internet deve manter o status Sem internet");

context.window.NetLab.State.data.nodes = completeNodes;
context.window.NetLab.State.data.connections = completeConnections;
context.window.NetLab.Connections.recalculateStatuses();
assert.equal(context.window.NetLab.State.data.nodes.every(function (item) { return item.status === "connected"; }), true, "a infraestrutura completa deve propagar o status Conectado");

var ringNodes = [node("ring-pc1", "pc"), node("ring-pc2", "pc"), node("ring-pc3", "pc"), node("ring-pc4", "pc")];
var ringConnections = [
  connection("ring-pc1", "ring-pc2"),
  connection("ring-pc2", "ring-pc3"),
  connection("ring-pc3", "ring-pc4"),
  connection("ring-pc4", "ring-pc1")
];
assert.equal(context.window.NetLab.TopologyValidator.validate("ring", snapshot(ringNodes, ringConnections)).valid, true, "anel formado por PCs deve ser válido");

var meshNodes = [node("mesh-pc1", "pc"), node("mesh-pc2", "pc"), node("mesh-pc3", "pc"), node("mesh-pc4", "pc")];
var meshConnections = [];
for (var meshSource = 0; meshSource < meshNodes.length; meshSource += 1) {
  for (var meshTarget = meshSource + 1; meshTarget < meshNodes.length; meshTarget += 1) {
    meshConnections.push(connection(meshNodes[meshSource].id, meshNodes[meshTarget].id));
  }
}
assert.equal(context.window.NetLab.TopologyValidator.validate("mesh", snapshot(meshNodes, meshConnections)).valid, true, "malha completa formada por PCs deve ser válida");

console.log("STAR_VALIDATOR_OK");
