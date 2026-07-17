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
    NetLab.Workspace.animatePath(path).then(function () {
      NetLab.State.setTool("select");
      notify("success", "Pacote entregue!", source.name + " conseguiu se comunicar com " + node.name + ".");
    }).catch(function () {
      NetLab.State.setTool("select");
      notify("error", "Teste interrompido", "A animação do pacote foi cancelada.");
    });
  }

  NetLab.Communication = { start: start, cancel: cancel, handleNode: handleNode };
}());
