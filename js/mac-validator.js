(function () {
  "use strict";

  var NetLab = window.NetLab = window.NetLab || {};

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function signature(snapshot) {
    var nodes = snapshot.nodes.map(function (node) {
      return [node.id, node.type, Boolean(node.hasNetworkCard), NetLab.MacAddress.sanitize(node.macAddress)].join("|");
    }).sort();
    var connections = snapshot.connections.map(function (connection) {
      return [connection.sourceId, connection.targetId].sort().join("|");
    }).sort();
    return JSON.stringify({ nodes: nodes, connections: connections, buses: snapshot.buses.length });
  }

  function hasCommunicationProof(challengeId, snapshot, pcs, proof) {
    if (!proof || proof.challengeId !== challengeId || proof.signature !== signature(snapshot)) return false;
    var ids = new Set(pcs.map(function (pc) { return pc.id; }));
    return proof.sourceId !== proof.targetId && ids.has(proof.sourceId) && ids.has(proof.targetId);
  }

  function validate(challengeId, snapshot, proof, challengeData) {
    var cleanSnapshot = snapshot || NetLab.State.captureProject();
    var hints = [];
    var pcs = cleanSnapshot.nodes.filter(function (node) { return node.type === "pc"; });
    var onlyPcs = pcs.length === cleanSnapshot.nodes.length;
    var countsReady = onlyPcs && pcs.length === 2;
    if (!countsReady) hints.push("Use somente os dois computadores preparados para este exercício.");
    if (cleanSnapshot.buses.length) hints.push("Este exercício usa apenas um cabo direto, sem barramento.");

    var directConnection = pcs.length === 2 && cleanSnapshot.connections.length === 1 && cleanSnapshot.connections.some(function (connection) {
      return [connection.sourceId, connection.targetId].indexOf(pcs[0].id) >= 0
        && [connection.sourceId, connection.targetId].indexOf(pcs[1].id) >= 0;
    });
    if (!directConnection) hints.push("Mantenha os dois computadores ligados diretamente pelo cabo preparado.");

    var missingCard = pcs.find(function (pc) { return !pc.hasNetworkCard; });
    if (missingCard) hints.push("Instale a placa de rede no " + missingCard.name + ".");

    var invalidMac = pcs.find(function (pc) { return !NetLab.MacAddress.validate(pc.macAddress).valid; });
    if (invalidMac) hints.push("Abra a placa de rede do " + invalidMac.name + " e use Gerar MAC aleatório.");
    var normalized = pcs.map(function (pc) { return NetLab.MacAddress.sanitize(pc.macAddress); }).filter(Boolean);
    var uniqueMacs = normalized.length === pcs.length && new Set(normalized).size === normalized.length;
    if (normalized.length === pcs.length && !uniqueMacs) hints.push("Os computadores estão com o mesmo MAC. Gere um novo endereço para apenas um deles.");

    var communicationReady = true;
    var quizReady = true;
    if (challengeId === "mac-identities" || challengeId === "mac-conflict") {
      communicationReady = hasCommunicationProof(challengeId, cleanSnapshot, pcs, proof);
      if (!communicationReady) hints.push("Depois de corrigir os MACs, use Testar comunicação e entregue um quadro entre os computadores.");
    }
    if (challengeId === "mac-destination") {
      quizReady = Boolean(challengeData && challengeData.macQuizComplete);
      if (!quizReady) hints.push("Escolha no desafio atual qual MAC deve ser usado como destino do quadro.");
    }

    var macsReady = !invalidMac && uniqueMacs;
    var valid = countsReady && !cleanSnapshot.buses.length && directConnection && !missingCard && macsReady && communicationReady && quizReady;
    return {
      valid: valid,
      topology: challengeId,
      challengeId: challengeId,
      hints: unique(hints),
      details: {
        countsReady: countsReady,
        directConnection: directConnection,
        cardsReady: !missingCard,
        macsReady: macsReady,
        communicationReady: communicationReady,
        quizReady: quizReady
      }
    };
  }

  NetLab.MacValidator = { validate: validate, signature: signature };
}());
