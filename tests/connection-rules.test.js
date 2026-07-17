const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const context = { window: { NetLab: {} }, Map, Set };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "state.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "connections.js"), "utf8"), context);

const Connections = context.window.NetLab.Connections;
const pc1 = { id: "pc-1", type: "pc", name: "PC-1", hasNetworkCard: true };
const pc2 = { id: "pc-2", type: "pc", name: "PC-2", hasNetworkCard: true };

test("permite ligação direta entre PCs em anel, malha e modo livre", () => {
  ["ring", "mesh", "free"].forEach((challenge) => {
    assert.equal(Connections.connectionRule(pc1, pc2, challenge).allowed, true, challenge);
  });
});

test("bloqueia ligação direta entre PCs nas demais topologias", () => {
  ["star", "bus", "tree"].forEach((challenge) => {
    const result = Connections.connectionRule(pc1, pc2, challenge);
    assert.equal(result.allowed, false, challenge);
    assert.match(result.message, /Anel e Malha/);
  });
});
