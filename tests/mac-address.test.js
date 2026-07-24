"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const context = { window: { NetLab: {} }, console, Map, Set, Uint8Array, Math };
vm.createContext(context);

function loadScript(name) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", name), "utf8"), context);
}

loadScript("mac-address.js");
loadScript("mac-validator.js");

const { MacAddress, MacValidator } = context.window.NetLab;

function snapshot(firstMac, secondMac) {
  return {
    nodes: [
      { id: "pc-a", type: "pc", name: "PC A", hasNetworkCard: true, macAddress: firstMac },
      { id: "pc-b", type: "pc", name: "PC B", hasNetworkCard: true, macAddress: secondMac }
    ],
    connections: [{ id: "cable", sourceId: "pc-a", targetId: "pc-b", type: "ethernet" }],
    buses: []
  };
}

test("normaliza e valida endereços MAC individuais", () => {
  assert.equal(MacAddress.normalize("02-1a-2b-3c-4d-5e"), "02:1A:2B:3C:4D:5E");
  assert.equal(MacAddress.validate("02:1A:2B:3C:4D:5E").valid, true);
  assert.equal(MacAddress.validate("FF:FF:FF:FF:FF:FF").valid, false);
  assert.equal(MacAddress.validate("01:00:5E:00:00:01").valid, false);
});

test("gera um MAC local, individual e diferente dos já usados", () => {
  const existing = "02:10:20:30:40:50";
  const generated = MacAddress.generate([existing]);
  assert.equal(MacAddress.validate(generated, [existing]).valid, true);
  assert.notEqual(generated, existing);
  assert.equal(parseInt(generated.slice(0, 2), 16) & 3, 2);
});

test("exige dois MACs diferentes e uma comunicação comprovada", () => {
  const missing = snapshot("", "");
  assert.equal(MacValidator.validate("mac-identities", missing, null, null).valid, false);

  const ready = snapshot("02:10:20:30:40:51", "02:10:20:30:40:52");
  const withoutProof = MacValidator.validate("mac-identities", ready, null, null);
  assert.equal(withoutProof.valid, false);
  assert.equal(withoutProof.details.macsReady, true);

  const proof = { challengeId: "mac-identities", sourceId: "pc-a", targetId: "pc-b", signature: MacValidator.signature(ready) };
  assert.equal(MacValidator.validate("mac-identities", ready, proof, null).valid, true);
});

test("bloqueia MAC duplicado e conclui a identificação do destino", () => {
  const duplicate = snapshot("02:10:20:30:40:50", "02:10:20:30:40:50");
  const duplicateProof = { challengeId: "mac-conflict", sourceId: "pc-a", targetId: "pc-b", signature: MacValidator.signature(duplicate) };
  const conflict = MacValidator.validate("mac-conflict", duplicate, duplicateProof, null);
  assert.equal(conflict.valid, false);
  assert.match(Array.from(conflict.hints).join(" "), /mesmo MAC/);

  const ready = snapshot("02:10:20:30:40:51", "02:10:20:30:40:52");
  assert.equal(MacValidator.validate("mac-destination", ready, null, { macQuizComplete: false }).valid, false);
  assert.equal(MacValidator.validate("mac-destination", ready, null, { macQuizComplete: true }).valid, true);
});
