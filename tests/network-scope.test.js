"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const context = { window: { NetLab: {} }, console, Map, Set };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "network-scope.js"), "utf8"), context);
const Scope = context.window.NetLab.NetworkScope;

function node(id, type, city) { return { id, type, name: id, city: type === "router" ? city : undefined }; }
function cable(id, sourceId, targetId, sourcePortId, targetPortId) {
  return { id, sourceId, targetId, sourcePortId: sourcePortId || null, targetPortId: targetPortId || null };
}
function snapshot(nodes, connections) { return { nodes, connections, buses: [] }; }
function oneLan(city = "maceio") {
  return snapshot(
    [node("router-a", "router", city), node("pc-a", "pc"), node("pc-b", "pc")],
    [cable("a1", "router-a", "pc-a", "lan-1"), cable("a2", "router-a", "pc-b", "lan-2")]
  );
}
function twoLans(cityA = "maceio", cityB = "maceio", linked = true) {
  const result = snapshot(
    [node("router-a", "router", cityA), node("router-b", "router", cityB), node("pc-a", "pc"), node("pc-b", "pc")],
    [cable("lan-a", "router-a", "pc-a", "lan-1"), cable("lan-b", "router-b", "pc-b", "lan-1")]
  );
  if (linked) result.connections.push(cable("routers", "router-a", "router-b", "wan", "wan"));
  return result;
}

test("1. um roteador com dois PCs forma somente LAN", () => {
  const result = Scope.classifyNetworkScope(oneLan());
  assert.deepEqual(Array.from(result.classifications), ["LAN"]);
});

test("2. dois roteadores sem duas LANs válidas não formam MAN", () => {
  const project = oneLan();
  project.nodes.push(node("router-b", "router", "maceio"));
  project.connections.push(cable("routers", "router-a", "router-b", "wan", "wan"));
  const result = Scope.classifyNetworkScope(project);
  assert.equal(result.hasLAN, true);
  assert.equal(result.hasMAN, false);
});

test("3. duas LANs conectadas na mesma cidade formam MAN", () => {
  const result = Scope.classifyNetworkScope(twoLans());
  assert.equal(result.hasLAN, true);
  assert.equal(result.hasMAN, true);
  assert.equal(result.hasWAN, false);
});

test("4. LANs conectadas em cidades diferentes formam WAN", () => {
  const result = Scope.classifyNetworkScope(twoLans("maceio", "arapiraca"));
  assert.equal(result.hasMAN, false);
  assert.equal(result.hasWAN, true);
});

test("5. Internet ligada à WAN de uma LAN forma WAN", () => {
  const project = oneLan();
  project.nodes.push(node("internet", "internet"));
  project.connections.push(cable("internet-link", "internet", "router-a", null, "wan"));
  const result = Scope.classifyNetworkScope(project);
  assert.equal(result.hasLAN, true);
  assert.equal(result.hasWAN, true);
});

test("6. Internet ligada incorretamente à LAN não forma WAN e gera aviso", () => {
  const project = oneLan();
  project.nodes.push(node("internet", "internet"));
  project.connections.push(cable("internet-link", "internet", "router-a", null, "lan-3"));
  const result = Scope.classifyNetworkScope(project);
  assert.equal(result.hasWAN, false);
  assert.match(result.warnings.join(" "), /porta WAN/);
});

test("7. duas LANs na mesma cidade sem enlace não formam MAN", () => {
  assert.equal(Scope.classifyNetworkScope(twoLans("maceio", "maceio", false)).hasMAN, false);
});

test("8. LANs em cidades diferentes sem enlace não formam WAN geográfica", () => {
  assert.equal(Scope.classifyNetworkScope(twoLans("maceio", "arapiraca", false)).hasWAN, false);
});

test("9. switch com vários PCs continua sendo somente LAN", () => {
  const project = snapshot(
    [node("switch", "switch"), node("pc-a", "pc"), node("pc-b", "pc"), node("pc-c", "pc")],
    [cable("a", "switch", "pc-a", "port-1"), cable("b", "switch", "pc-b", "port-2"), cable("c", "switch", "pc-c", "port-3")]
  );
  assert.deepEqual(Array.from(Scope.classifyNetworkScope(project).classifications), ["LAN"]);
});

test("10 e 11. mudar cidade alterna MAN e WAN em tempo real", () => {
  const project = twoLans();
  assert.equal(Scope.classifyNetworkScope(project).hasMAN, true);
  project.nodes.find((item) => item.id === "router-b").city = "arapiraca";
  assert.equal(Scope.classifyNetworkScope(project).hasWAN, true);
  assert.equal(Scope.classifyNetworkScope(project).hasMAN, false);
  project.nodes.find((item) => item.id === "router-b").city = "maceio";
  assert.equal(Scope.classifyNetworkScope(project).hasMAN, true);
  assert.equal(Scope.classifyNetworkScope(project).hasWAN, false);
});

test("12. projeto antigo sem cidade migra para Maceió", () => {
  const legacy = oneLan();
  delete legacy.nodes[0].city;
  const migrated = Scope.migrateLegacyNetworkState(legacy);
  assert.equal(migrated.nodes[0].city, "maceio");
  assert.equal(Scope.getRouterCity("router-a", migrated), "maceio");
});

test("LAN para WAN entre roteadores da mesma cidade não vira MAN automaticamente", () => {
  const project = twoLans();
  project.connections.find((item) => item.id === "routers").sourcePortId = "lan-2";
  const result = Scope.classifyNetworkScope(project);
  assert.equal(result.hasMAN, false);
  assert.equal(result.hasWAN, false);
});

test("uma montagem com três unidades pode identificar LAN, MAN e WAN ao mesmo tempo", () => {
  const project = snapshot(
    [
      node("router-a", "router", "maceio"), node("router-b", "router", "maceio"), node("router-c", "router", "arapiraca"),
      node("pc-a", "pc"), node("pc-b", "pc"), node("pc-c", "pc")
    ],
    [
      cable("lan-a", "router-a", "pc-a", "lan-1"),
      cable("lan-b", "router-b", "pc-b", "lan-1"),
      cable("lan-c", "router-c", "pc-c", "lan-1"),
      cable("man", "router-a", "router-b", "wan", "wan"),
      cable("wan", "router-b", "router-c", "lan-2", "wan")
    ]
  );
  assert.deepEqual(Array.from(Scope.classifyNetworkScope(project).classifications), ["LAN", "MAN", "WAN"]);
});
