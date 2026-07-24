"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const context = { window: { NetLab: {} }, console, Map, Set };
vm.createContext(context);

function loadScript(name) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", name), "utf8"), context);
}

loadScript("state.js");
loadScript("ipv4.js");
loadScript("mac-address.js");
loadScript("port-model.js");
loadScript("network-scope.js");
loadScript("storage.js");

const NetLab = context.window.NetLab;

function project(connection) {
  return {
    nodes: [
      { id: "router", type: "router", name: "Roteador-1", x: 20, y: 20, width: 170, height: 148, status: "no-internet" },
      { id: "pc", type: "pc", name: "PC-1", x: 250, y: 20, width: 142, height: 158, status: "no-internet", hasNetworkCard: true, macAddress: "02:10:20:30:40:50" }
    ],
    connections: [connection],
    buses: [],
    challenge: "types-lan-ports",
    hintsUsed: 0,
    zoom: 1,
    pan: { x: 0, y: 0 }
  };
}

test("preserva as portas físicas ao sanitizar um projeto", () => {
  const sanitized = NetLab.Storage.sanitizeProject(project({
    id: "cable-1",
    sourceId: "router",
    targetId: "pc",
    sourcePortId: "lan-1",
    targetPortId: null,
    type: "ethernet"
  }));
  assert.equal(sanitized.connections[0].sourcePortId, "lan-1");
  assert.equal(sanitized.connections[0].targetPortId, null);
  assert.equal(sanitized.nodes[0].city, "maceio");
  assert.equal(sanitized.nodes[1].macAddress, "02:10:20:30:40:50");
});

test("rejeita projeto da trilha que não informa a porta do roteador", () => {
  const missingPort = project({ id: "cable-1", sourceId: "router", targetId: "pc", type: "ethernet" });
  assert.throws(() => NetLab.Storage.sanitizeProject(missingPort), /Escolha uma porta física/);
  const recovered = NetLab.Storage.sanitizeProject(missingPort, { strictConnections: false });
  assert.equal(recovered.connections.length, 0);
});

test("preserva os MACs e o quiz da trilha ao salvar", () => {
  const sanitized = NetLab.Storage.sanitizeProject({
    nodes: [
      { id: "pc-a", type: "pc", name: "PC A", x: 20, y: 20, width: 142, height: 174, status: "no-internet", hasNetworkCard: true, macAddress: "02:10:20:30:40:51" },
      { id: "pc-b", type: "pc", name: "PC B", x: 250, y: 20, width: 142, height: 174, status: "no-internet", hasNetworkCard: true, macAddress: "02:10:20:30:40:52" }
    ],
    connections: [{ id: "mac-cable", sourceId: "pc-a", targetId: "pc-b", type: "ethernet" }],
    buses: [],
    challenge: "mac-destination",
    challengeData: { macSourceId: "pc-a", macTargetId: "pc-b", macQuizComplete: true, lastAnswer: "02:10:20:30:40:52" },
    hintsUsed: 0,
    zoom: 1,
    pan: { x: 0, y: 0 }
  });
  assert.equal(sanitized.connections.length, 1);
  assert.equal(sanitized.nodes[0].macAddress, "02:10:20:30:40:51");
  assert.equal(sanitized.challengeData.macTargetId, "pc-b");
  assert.equal(sanitized.challengeData.macQuizComplete, true);
});
