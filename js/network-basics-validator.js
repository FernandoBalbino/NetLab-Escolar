(function () {
  "use strict";

  var NetLab = window.NetLab = window.NetLab || {};
  var labels = {
    pc: { singular: "computador", plural: "computadores" },
    switch: { singular: "switch", plural: "switches" },
    router: { singular: "roteador", plural: "roteadores" },
    internet: { singular: "fonte de Internet", plural: "fontes de Internet" }
  };

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function result(valid, challengeId, hints, details) {
    return {
      valid: valid,
      topology: challengeId,
      challengeId: challengeId,
      hints: unique(hints),
      details: details || {}
    };
  }

  function pairKey(firstId, secondId) {
    return [firstId, secondId].sort().join("|");
  }

  function signature(snapshot) {
    var nodes = snapshot.nodes.map(function (node) {
      var ipv4 = node.ipv4 || {};
      return [node.id, node.type, Boolean(node.hasNetworkCard), ipv4.address || "", ipv4.mask || "", ipv4.gateway || ""].join("|");
    }).sort();
    var connections = snapshot.connections.map(function (connection) {
      return pairKey(connection.sourceId, connection.targetId);
    }).sort();
    var buses = snapshot.buses.map(function (bus) {
      return bus.id + ":" + bus.attachments.map(function (attachment) { return attachment.nodeId; }).sort().join(",");
    }).sort();
    return JSON.stringify({ nodes: nodes, connections: connections, buses: buses });
  }

  function nodesByType(snapshot) {
    return {
      pc: snapshot.nodes.filter(function (node) { return node.type === "pc"; }),
      switch: snapshot.nodes.filter(function (node) { return node.type === "switch"; }),
      router: snapshot.nodes.filter(function (node) { return node.type === "router"; }),
      internet: snapshot.nodes.filter(function (node) { return node.type === "internet"; })
    };
  }

  function validateCounts(groups, expected, hints) {
    var valid = true;
    Object.keys(labels).forEach(function (type) {
      var actual = groups[type].length;
      var wanted = expected[type] || 0;
      if (actual === wanted) return;
      valid = false;
      if (actual < wanted) {
        var missing = wanted - actual;
        hints.push("Adicione " + missing + " " + (missing === 1 ? labels[type].singular : labels[type].plural) + " para esta etapa.");
      } else hints.push("Use somente " + wanted + " " + (wanted === 1 ? labels[type].singular : labels[type].plural) + " nesta etapa.");
    });
    return valid;
  }

  function validateCards(pcs, hints) {
    var missing = pcs.find(function (pc) { return !pc.hasNetworkCard; });
    if (missing) hints.push("Instale uma placa de rede no " + missing.name + ".");
    return !missing;
  }

  function validateIPv4(pcs, hints) {
    if (pcs.length < 2) return false;
    var missing = pcs.find(function (pc) { return !NetLab.IPv4.networkDetails(pc.ipv4); });
    if (missing) {
      hints.push("Configure um endereço IPv4 e uma máscara válidos no " + missing.name + ".");
      return false;
    }
    var addresses = new Set();
    var duplicate = pcs.find(function (pc) {
      var address = NetLab.IPv4.sanitize(pc.ipv4).address;
      if (addresses.has(address)) return true;
      addresses.add(address);
      return false;
    });
    if (duplicate) {
      hints.push("Cada computador precisa de um endereço IPv4 diferente.");
      return false;
    }
    var reference = pcs[0];
    var incompatible = pcs.slice(1).find(function (pc) {
      return !NetLab.IPv4.compareNetworks(reference.ipv4, pc.ipv4).compatible;
    });
    if (incompatible) {
      var comparison = NetLab.IPv4.compareNetworks(reference.ipv4, incompatible.ipv4);
      hints.push(comparison.reason === "different-masks"
        ? "Use a mesma máscara de sub-rede em todos os computadores."
        : "Escolha endereços IPv4 que pertençam à mesma sub-rede.");
      return false;
    }
    return true;
  }

  function validateEdges(snapshot, expectedPairs, connectionHint, hints) {
    var actual = snapshot.connections.map(function (connection) { return pairKey(connection.sourceId, connection.targetId); }).sort();
    var expected = expectedPairs.map(function (pair) { return pairKey(pair[0], pair[1]); }).sort();
    var missing = expected.some(function (key) { return actual.indexOf(key) < 0; });
    var unexpected = actual.some(function (key) { return expected.indexOf(key) < 0; });
    if (missing) hints.push(connectionHint);
    if (unexpected || actual.length > expected.length) hints.push("Remova os cabos extras e mantenha somente o caminho pedido nesta etapa.");
    return !missing && !unexpected && actual.length === expected.length;
  }

  function hasCommunicationProof(challengeId, snapshot, pcs, proof) {
    if (!proof || proof.challengeId !== challengeId || proof.signature !== signature(snapshot)) return false;
    var pcIds = new Set(pcs.map(function (pc) { return pc.id; }));
    return proof.sourceId !== proof.targetId && pcIds.has(proof.sourceId) && pcIds.has(proof.targetId);
  }

  function expectedPairsFor(challengeId, groups) {
    var pcs = groups.pc;
    var switchNode = groups.switch[0];
    var router = groups.router[0];
    var internet = groups.internet[0];
    if (challengeId === "basic-direct") return pcs.length === 2 ? [[pcs[0].id, pcs[1].id]] : [];
    var pairs = switchNode ? pcs.map(function (pc) { return [pc.id, switchNode.id]; }) : [];
    if ((challengeId === "basic-router" || challengeId === "basic-internet") && switchNode && router) pairs.push([switchNode.id, router.id]);
    if (challengeId === "basic-internet" && router && internet) pairs.push([router.id, internet.id]);
    return pairs;
  }

  var specifications = {
    "basic-direct": {
      counts: { pc: 2 },
      connectionHint: "Ligue os dois computadores diretamente com um cabo."
    },
    "basic-switch": {
      counts: { pc: 2, switch: 1 },
      connectionHint: "Conecte cada computador diretamente ao switch."
    },
    "basic-lan": {
      counts: { pc: 3, switch: 1 },
      connectionHint: "Conecte os três computadores diretamente ao mesmo switch."
    },
    "basic-router": {
      counts: { pc: 2, switch: 1, router: 1 },
      connectionHint: "Monte o caminho PCs → Switch → Roteador, sem adicionar a Internet ainda."
    },
    "basic-internet": {
      counts: { pc: 3, switch: 1, router: 1, internet: 1 },
      connectionHint: "Complete o caminho Internet → Roteador → Switch → três computadores."
    }
  };

  function validate(challengeId, snapshot, proof) {
    var specification = specifications[challengeId];
    if (!specification) return result(false, challengeId, ["Escolha um exercício básico válido."], {});
    var cleanSnapshot = snapshot || NetLab.State.captureProject();
    var hints = [];
    var groups = nodesByType(cleanSnapshot);
    var countsReady = validateCounts(groups, specification.counts, hints);
    if (cleanSnapshot.buses.length) hints.push("Remova o barramento: esta trilha usa cabos e switches.");
    var cardsReady = validateCards(groups.pc, hints);
    var ipv4Ready = validateIPv4(groups.pc, hints);
    var expectedPairs = expectedPairsFor(challengeId, groups);
    var edgesReady = countsReady && validateEdges(cleanSnapshot, expectedPairs, specification.connectionHint, hints);
    var communicationReady = hasCommunicationProof(challengeId, cleanSnapshot, groups.pc, proof);
    if (!communicationReady) hints.push("Use Testar comunicação e entregue um pacote entre dois computadores antes de verificar.");
    var valid = countsReady && !cleanSnapshot.buses.length && cardsReady && ipv4Ready && edgesReady && communicationReady;
    return result(valid, challengeId, hints, {
      countsReady: countsReady,
      cardsReady: cardsReady,
      ipv4Ready: ipv4Ready,
      edgesReady: edgesReady,
      communicationReady: communicationReady
    });
  }

  NetLab.NetworkBasicsValidator = { validate: validate, signature: signature };
}());
