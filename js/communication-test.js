(function () {
  "use strict";

  var NetLab = window.NetLab = window.NetLab || {};

  function notify(type, title, message) {
    if (NetLab.App && NetLab.App.feedback) NetLab.App.feedback(type, title, message);
  }

  function start() {
    var pcs = NetLab.State.data.nodes.filter(function (node) { return node.type === "pc"; });
    if (pcs.length < 2) {
      notify("warning", "Faltam computadores", "Adicione pelo menos dois computadores para testar a comunicação.");
      return false;
    }
    var readyPcs = pcs.filter(function (node) { return node.hasNetworkCard; });
    if (readyPcs.length < 2) {
      notify("warning", "Placas de rede necessárias", "Instale uma placa de rede em pelo menos dois computadores antes do teste.");
      return false;
    }
    NetLab.State.data.communicationDraft = { sourceId: null };
    NetLab.State.setTool("communication");
    if (NetLab.Workspace) NetLab.Workspace.showHint("Selecione o computador de origem.");
    return true;
  }

  function cancel() {
    NetLab.State.data.communicationDraft = null;
    if (NetLab.State.data.tool === "communication") NetLab.State.setTool("select");
  }

  function pathNeedsRouting(path) {
    return path.vertices.slice(1, -1).some(function (vertexId) {
      if (vertexId.indexOf("bus:") === 0) return false;
      var node = NetLab.State.getNode(vertexId);
      return node && (node.type === "router" || node.type === "internet");
    });
  }

  function logicalResult(source, target, path) {
    var comparison = NetLab.IPv4.compareNetworks(source.ipv4, target.ipv4);
    if (!comparison.first || !comparison.second) {
      var missing = [];
      if (!comparison.first) missing.push(source.name);
      if (!comparison.second) missing.push(target.name);
      return {
        ok: false,
        title: "IPv4 não configurado",
        message: "Configure o endereço IPv4 de " + missing.join(" e ") + " antes de testar a comunicação."
      };
    }
    if (!comparison.compatible) {
      var detail = source.name + " pertence à rede " + comparison.first.label + " e " + target.name + " pertence à rede " + comparison.second.label + ". ";
      return {
        ok: false,
        title: "Falha na comunicação",
        message: detail + (comparison.reason === "different-masks" ? "As máscaras de sub-rede são diferentes. " : "As redes são diferentes. ") + "Seria necessário um roteador configurado para encaminhar os pacotes entre elas."
      };
    }
    if (pathNeedsRouting(path)) {
      return {
        ok: false,
        title: "Roteamento não configurado",
        message: "O caminho entre " + source.name + " e " + target.name + " passa por um roteador. Nesta etapa, o simulador ainda não possui interfaces e rotas configuradas."
      };
    }
    return {
      ok: true,
      title: "Pacote entregue!",
      message: source.name + " e " + target.name + " pertencem à rede " + comparison.first.label + "."
    };
  }

  function handleNode(nodeId) {
    var node = NetLab.State.getNode(nodeId);
    var draft = NetLab.State.data.communicationDraft;
    if (!draft || !node) return;
    if (node.type !== "pc") {
      notify("warning", "Escolha um computador", "O teste começa e termina em computadores, embora possa passar por switches.");
      return;
    }
    if (!node.hasNetworkCard) {
      notify("warning", "Computador sem placa de rede", "Clique no slot do " + node.name + " e instale a placa antes de testar a comunicação.");
      if (NetLab.Workspace) NetLab.Workspace.openNetworkCardSlot(node.id);
      return;
    }
    if (!draft.sourceId) {
      draft.sourceId = nodeId;
      NetLab.State.data.selected = { kind: "node", id: nodeId };
      NetLab.State.emit("communication-source");
      if (NetLab.Workspace) NetLab.Workspace.showHint("Agora selecione o computador de destino.");
      return;
    }
    if (draft.sourceId === nodeId) {
      notify("warning", "Destino repetido", "Escolha outro computador como destino.");
      return;
    }
    var source = NetLab.State.getNode(draft.sourceId);
    var path = NetLab.Connections.findPath(draft.sourceId, nodeId);
    NetLab.State.data.communicationDraft = null;
    if (!path) {
      NetLab.State.setTool("select");
      notify("error", "Pacote não entregue", "Não existe um caminho entre esses computadores. Verifique os cabos.");
      return;
    }
    if (!NetLab.Workspace) return;
    var result = logicalResult(source, node, path);
    NetLab.Workspace.animatePath(path, { variant: result.ok ? "success" : "error" }).then(function () {
      NetLab.State.setTool("select");
      notify(result.ok ? "success" : "error", result.title, result.message);
    }).catch(function () {
      NetLab.State.setTool("select");
      notify("error", "Teste interrompido", "A animação do pacote foi cancelada.");
    });
  }

  NetLab.Communication = { start: start, cancel: cancel, handleNode: handleNode, logicalResult: logicalResult };
}());
