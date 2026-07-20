"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const context = { window: { NetLab: {} }, Map, Set };
vm.createContext(context);

function loadScript(name) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", name), "utf8"), context);
}

loadScript("ipv4.js");
loadScript("network-basics-validator.js");

const Validator = context.window.NetLab.NetworkBasicsValidator;

function pc(id, host) {
  return {
    id,
    type: "pc",
    name: id.toUpperCase(),
    hasNetworkCard: true,
    status: "connected",
    ipv4: { address: `192.168.10.${host}`, mask: "255.255.255.0", gateway: "" }
  };
}

function node(id, type) {
  return { id, type, name: id, status: "connected" };
}

function cable(first, second) {
  return { id: `${first}-${second}`, sourceId: first, targetId: second, type: "ethernet" };
}

function proof(challengeId, snapshot) {
  return {
    challengeId,
    sourceId: snapshot.nodes[0].id,
    targetId: snapshot.nodes[1].id,
    signature: Validator.signature(snapshot)
  };
}

function directSnapshot() {
  return {
    nodes: [pc("pc-1", 10), pc("pc-2", 11)],
    connections: [cable("pc-1", "pc-2")],
    buses: []
  };
}

function switchedSnapshot(pcCount, includeRouter, includeInternet) {
  const pcs = Array.from({ length: pcCount }, (_, index) => pc(`pc-${index + 1}`, index + 10));
  const nodes = pcs.concat([node("switch-1", "switch")]);
  const connections = pcs.map((item) => cable(item.id, "switch-1"));
  if (includeRouter) {
    nodes.push(node("router-1", "router"));
    connections.push(cable("switch-1", "router-1"));
  }
  if (includeInternet) {
    nodes.push(node("internet-1", "internet"));
    connections.push(cable("router-1", "internet-1"));
  }
  return { nodes, connections, buses: [] };
}

test("valida as cinco etapas da trilha de redes básicas", () => {
  const cases = [
    ["basic-direct", directSnapshot()],
    ["basic-switch", switchedSnapshot(2, false, false)],
    ["basic-lan", switchedSnapshot(3, false, false)],
    ["basic-router", switchedSnapshot(2, true, false)],
    ["basic-internet", switchedSnapshot(3, true, true)]
  ];

  cases.forEach(([challengeId, snapshot]) => {
    const validation = Validator.validate(challengeId, snapshot, proof(challengeId, snapshot));
    assert.equal(validation.valid, true, `${challengeId}: ${validation.hints.join(" ")}`);
  });
});

test("exige que o aluno execute um teste de comunicação bem-sucedido", () => {
  const snapshot = directSnapshot();
  const validation = Validator.validate("basic-direct", snapshot, null);
  assert.equal(validation.valid, false);
  assert.equal(validation.details.communicationReady, false);
  assert.match(validation.hints.join(" "), /Testar comunicação/);
});

test("rejeita computadores em sub-redes IPv4 diferentes", () => {
  const snapshot = directSnapshot();
  snapshot.nodes[1].ipv4.address = "192.168.20.11";
  const validation = Validator.validate("basic-direct", snapshot, proof("basic-direct", snapshot));
  assert.equal(validation.valid, false);
  assert.equal(validation.details.ipv4Ready, false);
  assert.match(validation.hints.join(" "), /mesma sub-rede/);
});

test("invalida a prova de comunicação quando a rede muda", () => {
  const snapshot = switchedSnapshot(2, false, false);
  const previousProof = proof("basic-switch", snapshot);
  snapshot.nodes[1].ipv4.address = "192.168.10.25";
  const validation = Validator.validate("basic-switch", snapshot, previousProof);
  assert.equal(validation.valid, false);
  assert.equal(validation.details.communicationReady, false);
});
