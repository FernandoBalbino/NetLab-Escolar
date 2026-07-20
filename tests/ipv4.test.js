const test = require("node:test");
const assert = require("node:assert/strict");

global.window = global;
require("../js/ipv4.js");

const IPv4 = global.NetLab.IPv4;

test("aceita configuração IPv4 manual válida", () => {
  const result = IPv4.validate({ address: "192.168.1.10", mask: "255.255.255.0", gateway: "192.168.1.1" });
  assert.equal(result.valid, true);
  assert.equal(result.prefix, 24);
  assert.deepEqual(result.value, { address: "192.168.1.10", mask: "255.255.255.0", gateway: "192.168.1.1" });
});

test("rejeita máscara não contígua", () => {
  const result = IPv4.validate({ address: "192.168.1.10", mask: "255.0.255.0", gateway: "" });
  assert.equal(result.valid, false);
  assert.equal(result.field, "mask");
});

test("rejeita endereço de rede e broadcast", () => {
  assert.equal(IPv4.validate({ address: "192.168.1.0", mask: "255.255.255.0", gateway: "" }).valid, false);
  assert.equal(IPv4.validate({ address: "192.168.1.255", mask: "255.255.255.0", gateway: "" }).valid, false);
});

test("rejeita gateway fora da sub-rede", () => {
  const result = IPv4.validate({ address: "192.168.1.10", mask: "255.255.255.0", gateway: "192.168.2.1" });
  assert.equal(result.valid, false);
  assert.equal(result.field, "gateway");
});

test("rejeita endereço duplicado", () => {
  const result = IPv4.validate({ address: "192.168.1.10", mask: "255.255.255.0", gateway: "" }, ["192.168.1.10"]);
  assert.equal(result.valid, false);
  assert.equal(result.field, "address");
});

test("reconhece computadores na mesma rede IPv4", () => {
  const result = IPv4.compareNetworks(
    { address: "192.168.1.100", mask: "255.255.255.0" },
    { address: "192.168.1.101", mask: "255.255.255.0" }
  );
  assert.equal(result.compatible, true);
  assert.equal(result.first.label, "192.168.1.0/24");
  assert.equal(result.second.label, "192.168.1.0/24");
});

test("separa computadores em redes IPv4 diferentes", () => {
  const result = IPv4.compareNetworks(
    { address: "192.168.1.100", mask: "255.255.255.0" },
    { address: "192.168.2.101", mask: "255.255.255.0" }
  );
  assert.equal(result.compatible, false);
  assert.equal(result.reason, "different-networks");
  assert.equal(result.first.label, "192.168.1.0/24");
  assert.equal(result.second.label, "192.168.2.0/24");
});

test("trata máscaras diferentes como configuração incompatível", () => {
  const result = IPv4.compareNetworks(
    { address: "10.0.0.10", mask: "255.255.255.0" },
    { address: "10.0.0.20", mask: "255.255.0.0" }
  );
  assert.equal(result.compatible, false);
  assert.equal(result.reason, "different-masks");
});

test("exige IPv4 configurado nos dois computadores", () => {
  const result = IPv4.compareNetworks(
    IPv4.defaultConfiguration(),
    { address: "192.168.1.20", mask: "255.255.255.0" }
  );
  assert.equal(result.compatible, false);
  assert.equal(result.reason, "missing-first");
});

require("../js/state.js");
require("../js/storage.js");

function projectWith(ipv4) {
  return {
    nodes: [{ id: "pc-1", type: "pc", name: "PC-1", x: 20, y: 20, width: 142, height: 158, status: "disconnected", hasNetworkCard: false, ipv4 }],
    connections: [],
    buses: [],
    challenge: "free",
    hintsUsed: 0,
    zoom: 1,
    pan: { x: 0, y: 0 }
  };
}

test("preserva IPv4 ao sanitizar projeto salvo", () => {
  const sanitized = global.NetLab.Storage.sanitizeProject(projectWith({ address: "10.0.0.20", mask: "255.255.255.0", gateway: "10.0.0.1" }));
  assert.deepEqual(sanitized.nodes[0].ipv4, { address: "10.0.0.20", mask: "255.255.255.0", gateway: "10.0.0.1" });
});

test("mantém compatibilidade com projetos sem IPv4", () => {
  const sanitized = global.NetLab.Storage.sanitizeProject(projectWith(undefined));
  assert.deepEqual(sanitized.nodes[0].ipv4, IPv4.defaultConfiguration());
});

function projectWithDirectPcConnection(challenge) {
  return {
    nodes: [
      { id: "pc-1", type: "pc", name: "PC-1", x: 20, y: 20, width: 142, height: 158, status: "no-internet", hasNetworkCard: true },
      { id: "pc-2", type: "pc", name: "PC-2", x: 220, y: 20, width: 142, height: 158, status: "no-internet", hasNetworkCard: true }
    ],
    connections: [{ id: "connection-1", sourceId: "pc-1", targetId: "pc-2", type: "ethernet" }],
    buses: [],
    challenge,
    hintsUsed: 0,
    zoom: 1,
    pan: { x: 0, y: 0 }
  };
}

test("preserva cabo direto entre PCs em projetos de Anel", () => {
  const sanitized = global.NetLab.Storage.sanitizeProject(projectWithDirectPcConnection("ring"));
  assert.equal(sanitized.connections.length, 1);
});

test("rejeita cabo direto entre PCs em projetos de Estrela", () => {
  assert.throws(
    () => global.NetLab.Storage.sanitizeProject(projectWithDirectPcConnection("star")),
    /conexão entre tipos de equipamentos incompatíveis/
  );
});
