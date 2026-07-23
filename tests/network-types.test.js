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

loadScript("port-model.js");
loadScript("network-scope.js");
loadScript("network-types-validator.js");

const NetLab = context.window.NetLab;

function node(id, type, city = "maceio") {
  return { id, type, name: id, city: type === "router" ? city : undefined, hasNetworkCard: type === "pc" ? true : undefined };
}

function cable(id, sourceId, targetId, sourcePortId, targetPortId) {
  return { id, sourceId, targetId, sourcePortId: sourcePortId || null, targetPortId: targetPortId || null, type: "ethernet" };
}

function snapshot(nodes, connections, challengeData) { return { nodes, connections, buses: [], challengeData: challengeData || null }; }

function twoRouterNetwork(secondCity) {
  return snapshot(
    [node("router-a", "router"), node("router-b", "router", secondCity), node("pc-a", "pc"), node("pc-b", "pc")],
    [
      cable("lan-a", "router-a", "pc-a", "lan-1"),
      cable("lan-b", "router-b", "pc-b", "lan-1"),
      cable("link", "router-a", "router-b", "wan", "wan")
    ]
  );
}

test("valida os cinco exercícios progressivos de tipos de redes", () => {
  const lan = snapshot(
    [node("router", "router"), node("switch", "switch"), node("pc-1", "pc"), node("pc-2", "pc")],
    [
      cable("uplink", "router", "switch", "lan-1", "port-1"),
      cable("pc-1-link", "switch", "pc-1", "port-2"),
      cable("pc-2-link", "switch", "pc-2", "port-3")
    ]
  );
  const internetLan = snapshot(
    [node("internet", "internet"), node("router", "router"), node("switch", "switch"), node("pc-1", "pc"), node("pc-2", "pc")],
    [
      cable("wan", "internet", "router", null, "wan"),
      cable("uplink", "router", "switch", "lan-1", "port-1"),
      cable("pc-1-link", "switch", "pc-1", "port-2"),
      cable("pc-2-link", "switch", "pc-2", "port-3")
    ]
  );
  const quiz = twoRouterNetwork("arapiraca");
  quiz.challengeData = { quizScenario: 2, quizComplete: true };

  const cases = [
    ["types-lan-ports", lan],
    ["types-switch-capacity", twoRouterNetwork("maceio")],
    ["types-wan-access", twoRouterNetwork("arapiraca")],
    ["types-man-link", internetLan],
    ["types-complete", quiz]
  ];

  cases.forEach(([challengeId, project]) => {
    const validation = NetLab.NetworkTypesValidator.validate(challengeId, project);
    assert.equal(validation.valid, true, `${challengeId}: ${validation.hints.join(" ")}`);
  });
});

test("reserva três LAN e uma WAN no roteador", () => {
  const router = node("router", "router");
  assert.deepEqual(Array.from(NetLab.PortModel.portsFor(router, "types-lan-ports").map((port) => port.id)), ["wan", "lan-1", "lan-2", "lan-3"]);
});

test("limita o switch a cinco portas e impede reutilização", () => {
  const switchNode = node("switch", "switch");
  const pc = node("pc", "pc");
  assert.equal(NetLab.PortModel.portsFor(switchNode, "types-switch-capacity").length, 5);
  const existing = [cable("used", "switch", "pc", "port-5")];
  const occupied = NetLab.PortModel.validateConnection(switchNode, node("pc-2", "pc"), "port-5", null, "types-switch-capacity", existing);
  assert.equal(occupied.allowed, false);
  assert.match(occupied.message, /ocupada/);
});

test("exige WAN para a entrada da Internet", () => {
  const rule = NetLab.PortModel.validatePairPorts(node("internet", "internet"), node("router", "router"), null, "lan-1", "types-wan-access");
  assert.equal(rule.allowed, false);
  assert.match(rule.message, /WAN/);
});
