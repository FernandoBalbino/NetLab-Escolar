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
const NetLab = context.window.NetLab;
NetLab.History = { record() {} };
NetLab.Storage = { saveNow() {} };
NetLab.NetworkBasicsValidator = {
  validate(id) { return { valid: true, topology: id, challengeId: id, hints: [], details: {} }; },
  signature() { return "signature"; }
};
NetLab.TopologyValidator = {
  validate(id) { return { valid: true, topology: id, hints: [], details: {} }; }
};
loadScript("challenges.js");

test("mantém progressões independentes para redes básicas e topologias", () => {
  assert.deepEqual(Array.from(NetLab.State.data.progress.unlocked).sort(), ["basic-direct", "star"]);

  assert.equal(NetLab.Challenges.start("basic-direct"), true);
  const basicResult = NetLab.Challenges.validateCurrent();
  assert.equal(basicResult.valid, true);
  assert.equal(basicResult.nextUnlocked, "basic-switch");
  assert.equal(NetLab.State.data.progress.completed["basic-direct"], true);
  assert.equal(NetLab.Challenges.isUnlocked("basic-switch"), true);
  assert.equal(NetLab.Challenges.isUnlocked("basic-lan"), false);

  assert.equal(NetLab.Challenges.start("star"), true);
  const topologyResult = NetLab.Challenges.validateCurrent();
  assert.equal(topologyResult.valid, true);
  assert.equal(topologyResult.nextUnlocked, "bus");
  assert.equal(NetLab.State.data.progress.completed.star, true);
  assert.equal(NetLab.Challenges.isUnlocked("bus"), true);
  assert.equal(NetLab.Challenges.isUnlocked("ring"), false);
});
