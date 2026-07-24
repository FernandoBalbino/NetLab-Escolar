const test = require("node:test");
const assert = require("node:assert/strict");

global.window = global;
require("../js/ipv4.js");
require("../js/mac-address.js");

const nodes = new Map([
  ["switch-1", { id: "switch-1", type: "switch", name: "Switch-1" }],
  ["router-1", { id: "router-1", type: "router", name: "Roteador-1" }]
]);

global.NetLab.State = {
  data: { challenge: "free" },
  getNode(id) {
    return nodes.get(id) || null;
  }
};

require("../js/communication-test.js");

function pc(id, name, address, mask = "255.255.255.0") {
  return { id, type: "pc", name, ipv4: { address, mask, gateway: "" } };
}

test("entrega pacote entre PCs da mesma rede através de switch", () => {
  const result = global.NetLab.Communication.logicalResult(
    pc("pc-3", "PC-3", "192.168.1.100"),
    pc("pc-4", "PC-4", "192.168.1.101"),
    { vertices: ["pc-3", "switch-1", "pc-4"], edges: [] }
  );
  assert.equal(result.ok, true);
  assert.match(result.message, /192\.168\.1\.0\/24/);
});

test("bloqueia pacote entre PCs de redes diferentes", () => {
  const result = global.NetLab.Communication.logicalResult(
    pc("pc-3", "PC-3", "192.168.1.100"),
    pc("pc-4", "PC-4", "192.168.2.101"),
    { vertices: ["pc-3", "switch-1", "pc-4"], edges: [] }
  );
  assert.equal(result.ok, false);
  assert.equal(result.title, "Falha na comunicação");
  assert.match(result.message, /192\.168\.1\.0\/24/);
  assert.match(result.message, /192\.168\.2\.0\/24/);
});

test("bloqueia caminho que depende de roteador sem configuração", () => {
  const result = global.NetLab.Communication.logicalResult(
    pc("pc-3", "PC-3", "10.0.0.10"),
    pc("pc-4", "PC-4", "10.0.0.20"),
    { vertices: ["pc-3", "router-1", "pc-4"], edges: [] }
  );
  assert.equal(result.ok, false);
  assert.equal(result.title, "Roteamento não configurado");
});

test("na trilha MAC só comunica quando os dois computadores têm endereços únicos", () => {
  global.NetLab.State.data.challenge = "mac-identities";
  const path = { vertices: ["pc-a", "pc-b"], edges: [] };
  const missing = global.NetLab.Communication.logicalResult(
    { id: "pc-a", name: "PC A", macAddress: "" },
    { id: "pc-b", name: "PC B", macAddress: "02:10:20:30:40:52" },
    path
  );
  assert.equal(missing.ok, false);
  assert.equal(missing.title, "MAC não configurado");

  const conflict = global.NetLab.Communication.logicalResult(
    { id: "pc-a", name: "PC A", macAddress: "02:10:20:30:40:50" },
    { id: "pc-b", name: "PC B", macAddress: "02:10:20:30:40:50" },
    path
  );
  assert.equal(conflict.ok, false);
  assert.equal(conflict.title, "Conflito de endereço MAC");

  const delivered = global.NetLab.Communication.logicalResult(
    { id: "pc-a", name: "PC A", macAddress: "02:10:20:30:40:51" },
    { id: "pc-b", name: "PC B", macAddress: "02:10:20:30:40:52" },
    path
  );
  assert.equal(delivered.ok, true);
  assert.equal(delivered.title, "Quadro entregue!");
  global.NetLab.State.data.challenge = "free";
});
