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
loadScript("network-types-validator.js");

const NetLab = context.window.NetLab;

function node(id, type) {
  return { id, type, name: id, hasNetworkCard: type === "pc" ? true : undefined };
}

function cable(id, sourceId, targetId, sourcePortId, targetPortId) {
  return { id, sourceId, targetId, sourcePortId: sourcePortId || null, targetPortId: targetPortId || null, type: "ethernet" };
}

function snapshot(nodes, connections) { return { nodes, connections, buses: [] }; }

test("valida os cinco exercícios progressivos de tipos de redes", () => {
  const router = node("router", "router");
  const switchNode = node("switch", "switch");
  const internet = node("internet", "internet");
  const pcs = [1, 2, 3, 4].map((index) => node(`pc-${index}`, "pc"));

  const cases = [
    ["types-lan-ports", snapshot([router, ...pcs.slice(0, 3)], [
      cable("c1", "router", "pc-1", "lan-1"),
      cable("c2", "router", "pc-2", "lan-2"),
      cable("c3", "router", "pc-3", "lan-3")
    ])],
    ["types-switch-capacity", snapshot([router, switchNode, ...pcs], [
      cable("c1", "router", "switch", "lan-1", "port-1"),
      cable("c2", "switch", "pc-1", "port-2"),
      cable("c3", "switch", "pc-2", "port-3"),
      cable("c4", "switch", "pc-3", "port-4"),
      cable("c5", "switch", "pc-4", "port-5")
    ])],
    ["types-wan-access", snapshot([internet, router, ...pcs.slice(0, 2)], [
      cable("c1", "internet", "router", null, "wan"),
      cable("c2", "router", "pc-1", "lan-1"),
      cable("c3", "router", "pc-2", "lan-2")
    ])],
    ["types-man-link", (() => {
      const secondRouter = node("router-2", "router");
      return snapshot([router, secondRouter, ...pcs.slice(0, 2)], [
        cable("c1", "router", "router-2", "wan", "wan"),
        cable("c2", "router", "pc-1", "lan-1"),
        cable("c3", "router-2", "pc-2", "lan-1")
      ]);
    })()],
    ["types-complete", (() => {
      const secondRouter = node("router-2", "router");
      return snapshot([internet, router, secondRouter, switchNode, ...pcs], [
        cable("c1", "internet", "router", null, "wan"),
        cable("c2", "router", "router-2", "lan-1", "wan"),
        cable("c3", "router", "pc-1", "lan-2"),
        cable("c4", "router-2", "switch", "lan-1", "port-1"),
        cable("c5", "switch", "pc-2", "port-2"),
        cable("c6", "switch", "pc-3", "port-3"),
        cable("c7", "switch", "pc-4", "port-4")
      ]);
    })()]
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
  const rule = NetLab.PortModel.validatePairPorts(
    node("internet", "internet"),
    node("router", "router"),
    null,
    "lan-1",
    "types-wan-access"
  );
  assert.equal(rule.allowed, false);
  assert.match(rule.message, /WAN/);
});
