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
loadScript("mac-address.js");
const NetLab = context.window.NetLab;
NetLab.History = { record() {} };
NetLab.Storage = { saveNow() {} };
NetLab.NetworkScope = { sanitizeCity(city) { return city === "arapiraca" ? city : "maceio"; } };
NetLab.NetworkBasicsValidator = {
  validate(id) { return { valid: true, topology: id, challengeId: id, hints: [], details: {} }; },
  signature() { return "signature"; }
};
NetLab.NetworkTypesValidator = {
  validate(id) { return { valid: true, topology: id, challengeId: id, hints: [], details: {} }; }
};
NetLab.MacValidator = {
  validate(id) { return { valid: true, topology: id, challengeId: id, hints: [], details: {} }; },
  signature() { return "mac-signature"; }
};
NetLab.TopologyValidator = {
  validate(id) { return { valid: true, topology: id, hints: [], details: {} }; }
};
loadScript("challenges.js");

test("mantém progressões independentes para as quatro trilhas", () => {
  assert.deepEqual(Array.from(NetLab.State.data.progress.unlocked).sort(), ["basic-direct", "mac-identities", "star", "types-lan-ports"]);

  assert.equal(NetLab.Challenges.start("basic-direct"), true);
  const basicResult = NetLab.Challenges.validateCurrent();
  assert.equal(basicResult.valid, true);
  assert.equal(basicResult.nextUnlocked, "basic-switch");
  assert.equal(NetLab.State.data.progress.completed["basic-direct"], true);
  assert.equal(NetLab.Challenges.isUnlocked("basic-switch"), true);
  assert.equal(NetLab.Challenges.isUnlocked("basic-lan"), false);

  assert.equal(NetLab.Challenges.start("types-lan-ports"), true);
  const typesResult = NetLab.Challenges.validateCurrent();
  assert.equal(typesResult.valid, true);
  assert.equal(typesResult.nextUnlocked, "types-switch-capacity");
  assert.equal(NetLab.Challenges.isUnlocked("types-switch-capacity"), true);
  assert.equal(NetLab.Challenges.isUnlocked("types-wan-access"), false);

  assert.equal(NetLab.Challenges.start("mac-identities"), true);
  const macResult = NetLab.Challenges.validateCurrent();
  assert.equal(macResult.valid, true);
  assert.equal(macResult.nextUnlocked, "mac-conflict");
  assert.equal(NetLab.Challenges.isUnlocked("mac-conflict"), true);
  assert.equal(NetLab.Challenges.isUnlocked("mac-destination"), false);

  assert.equal(NetLab.Challenges.start("star"), true);
  const topologyResult = NetLab.Challenges.validateCurrent();
  assert.equal(topologyResult.valid, true);
  assert.equal(topologyResult.nextUnlocked, "bus");
  assert.equal(NetLab.State.data.progress.completed.star, true);
  assert.equal(NetLab.Challenges.isUnlocked("bus"), true);
  assert.equal(NetLab.Challenges.isUnlocked("ring"), false);
});

test("semeia os cenários prontos e avança o quiz de classificação", () => {
  NetLab.State.data.progress.unlocked.push("types-complete");
  assert.equal(NetLab.Challenges.start("types-complete"), true);
  assert.equal(NetLab.State.data.challengeData.quizScenario, 0);
  assert.equal(NetLab.State.data.nodes.length, 4);

  assert.equal(NetLab.Challenges.submitClassificationAnswer("LAN").correct, true);
  assert.equal(NetLab.State.data.challengeData.quizScenario, 1);
  assert.equal(NetLab.State.data.nodes.filter((node) => node.type === "router").length, 2);

  assert.equal(NetLab.Challenges.submitClassificationAnswer("LAN+MAN").correct, true);
  assert.equal(NetLab.State.data.challengeData.quizScenario, 2);
  assert.deepEqual(Array.from(new Set(NetLab.State.data.nodes.filter((node) => node.type === "router").map((node) => node.city))).sort(), ["arapiraca", "maceio"]);

  const result = NetLab.Challenges.submitClassificationAnswer("LAN+WAN");
  assert.equal(result.complete, true);
  assert.equal(NetLab.State.data.challengeData.quizComplete, true);
});

test("semeia os três exercícios simples de endereço MAC", () => {
  if (!NetLab.Challenges.isUnlocked("mac-identities")) NetLab.State.data.progress.unlocked.push("mac-identities");
  assert.equal(NetLab.Challenges.start("mac-identities"), true);
  assert.equal(NetLab.State.data.nodes.length, 2);
  assert.equal(NetLab.State.data.connections.length, 1);
  assert.deepEqual(Array.from(NetLab.State.data.nodes.map((node) => node.macAddress)), ["", ""]);

  if (!NetLab.Challenges.isUnlocked("mac-conflict")) NetLab.State.data.progress.unlocked.push("mac-conflict");
  assert.equal(NetLab.Challenges.start("mac-conflict"), true);
  assert.equal(NetLab.State.data.nodes[0].macAddress, NetLab.State.data.nodes[1].macAddress);

  if (!NetLab.Challenges.isUnlocked("mac-destination")) NetLab.State.data.progress.unlocked.push("mac-destination");
  assert.equal(NetLab.Challenges.start("mac-destination"), true);
  const source = NetLab.State.getNode(NetLab.State.data.challengeData.macSourceId);
  const target = NetLab.State.getNode(NetLab.State.data.challengeData.macTargetId);
  assert.equal(NetLab.Challenges.submitMacDestinationAnswer(source.macAddress).correct, false);
  assert.equal(NetLab.Challenges.submitMacDestinationAnswer(target.macAddress).correct, true);
  assert.equal(NetLab.State.data.challengeData.macQuizComplete, true);
});
