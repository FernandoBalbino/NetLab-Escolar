(function () {
  "use strict";

  var NetLab = window.NetLab = window.NetLab || {};
  var els = {};
  var drag = null;
  var frame = 0;
  var hintTimer = 0;
  var animationToken = 0;
  var isAnimating = false;
  var openNetworkCardNodeId = null;
  var openIPv4NodeId = null;

  function element(tag, className) {
    var item = document.createElement(tag);
    if (className) item.className = className;
    return item;
  }

  function svgElement(tag, className) {
    var item = document.createElementNS("http://www.w3.org/2000/svg", tag);
    if (className) item.setAttribute("class", className);
    return item;
  }

  function updateTransform() {
    var state = NetLab.State.data;
    var supportsLayoutZoom = window.CSS && CSS.supports && CSS.supports("zoom", "1");
    if (supportsLayoutZoom) {
      els.world.style.zoom = String(state.zoom);
      els.world.style.transform = "translate(" + (state.pan.x / state.zoom) + "px, " + (state.pan.y / state.zoom) + "px)";
    } else {
      els.world.style.zoom = "";
      els.world.style.transform = "translate(" + state.pan.x + "px, " + state.pan.y + "px) scale(" + state.zoom + ")";
    }
    els.workspace.style.backgroundSize = (20 * state.zoom) + "px " + (20 * state.zoom) + "px";
    els.workspace.style.backgroundPosition = state.pan.x + "px " + state.pan.y + "px";
  }

  function worldPoint(clientX, clientY) {
    var rect = els.workspace.getBoundingClientRect();
    var state = NetLab.State.data;
    return {
      x: (clientX - rect.left - state.pan.x) / state.zoom,
      y: (clientY - rect.top - state.pan.y) / state.zoom
    };
  }

  function centerPoint() {
    var rect = els.workspace.getBoundingClientRect();
    return worldPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  var nodeVisuals = {
    pc: { image: "./assets/images/pc.png", alt: "Computador" },
    switch: { image: "./assets/images/switch.png", alt: "Switch" },
    router: { image: "./assets/images/roteador.png", alt: "Roteador" },
    internet: { image: "./assets/images/internet.png", alt: "Internet" }
  };

  function statusText(node) {
    if (node.type === "pc" && !node.hasNetworkCard) return "Sem placa de rede";
    if (node.status === "connected") return "Conectado";
    if (node.status === "no-internet") return "Sem internet";
    return "Desconectado";
  }

  function physicalPortsEnabled() {
    return NetLab.PortModel.isPortChallenge(NetLab.State.data.challenge);
  }

  function addPhysicalPortRail(item, node) {
    var ports = NetLab.PortModel.portsFor(node, NetLab.State.data.challenge);
    if (!ports.length) return false;
    item.dataset.hasPhysicalPorts = "true";
    var rail = element("div", "device-port-rail device-port-rail--" + node.type);
    rail.setAttribute("aria-label", "Portas físicas de " + node.name);
    ports.forEach(function (port) {
      var occupied = NetLab.PortModel.connectionForPort(NetLab.State.data.connections, node.id, port.id);
      var button = element("button", "device-port-button device-port-button--" + port.kind + (occupied ? " is-occupied" : ""));
      button.type = "button";
      button.dataset.nodeId = node.id;
      button.dataset.portId = port.id;
      button.setAttribute("aria-label", node.name + ", porta " + port.label + (occupied ? ", ocupada" : ", livre"));
      button.setAttribute("aria-pressed", "false");
      var image = element("img", "device-port-image");
      image.src = "./assets/images/porta-rj45.png";
      image.alt = "";
      image.draggable = false;
      var label = element("span", "device-port-label");
      label.textContent = port.kind === "wan" ? "WAN" : port.label.replace("LAN ", "L");
      button.appendChild(image);
      button.appendChild(label);
      button.addEventListener("pointerdown", function (event) {
        event.stopPropagation();
      });
      button.addEventListener("click", function (event) {
        if (isAnimating) return;
        event.preventDefault();
        event.stopPropagation();
        if (NetLab.State.data.tool === "cable") handleCableEndpoint(node.id, port.id);
        else NetLab.State.select("node", node.id);
      });
      rail.appendChild(button);
    });
    item.appendChild(rail);
    return true;
  }

  function closeNetworkCardSlot() {
    if (!openNetworkCardNodeId) return;
    openNetworkCardNodeId = null;
    if (!els.nodeLayer) return;
    var popover = els.nodeLayer.querySelector(".network-card-popover");
    if (popover) popover.remove();
    var expanded = els.nodeLayer.querySelector('.network-card-slot[aria-expanded="true"]');
    if (expanded) {
      expanded.setAttribute("aria-expanded", "false");
      var owner = expanded.closest(".network-node");
      if (owner) owner.classList.remove("has-open-popover");
    }
  }

  function closeIPv4Popover() {
    if (!openIPv4NodeId) return;
    openIPv4NodeId = null;
    if (!els.nodeLayer) return;
    var popover = els.nodeLayer.querySelector(".ipv4-popover");
    if (popover) popover.remove();
    var expanded = els.nodeLayer.querySelector('.pc-settings-slot[aria-expanded="true"]');
    if (expanded) {
      expanded.setAttribute("aria-expanded", "false");
      var owner = expanded.closest(".network-node");
      if (owner) owner.classList.remove("has-open-popover");
    }
  }

  function openNetworkCardSlot(nodeId) {
    var node = NetLab.State.getNode(nodeId);
    if (!node || node.type !== "pc") return false;
    openIPv4NodeId = null;
    openNetworkCardNodeId = nodeId;
    renderNodes();
    renderSelection();
    window.setTimeout(function () {
      var action = els.nodeLayer.querySelector('[data-install-network-card="' + CSS.escape(nodeId) + '"]');
      if (action) action.focus();
    }, 0);
    return true;
  }

  function openIPv4Popover(nodeId) {
    var node = NetLab.State.getNode(nodeId);
    if (!node || node.type !== "pc") return false;
    openNetworkCardNodeId = null;
    openIPv4NodeId = nodeId;
    renderNodes();
    renderSelection();
    window.setTimeout(function () {
      var address = els.nodeLayer.querySelector('.ipv4-popover [data-ipv4-field="address"]');
      if (address) address.focus();
    }, 0);
    return true;
  }

  function addNetworkCardControl(item, node, controls) {
    var installed = Boolean(node.hasNetworkCard);
    var slot = element("button", "network-card-slot" + (installed ? " is-installed" : " is-empty"));
    slot.type = "button";
    slot.setAttribute("aria-label", installed ? "Ver placa de rede instalada no " + node.name : "Adicionar placa de rede ao " + node.name);
    slot.setAttribute("aria-haspopup", "dialog");
    slot.setAttribute("aria-expanded", openNetworkCardNodeId === node.id ? "true" : "false");
    slot.title = installed ? "Placa de rede instalada" : "Slot vazio — adicionar placa de rede";
    if (installed) {
      var thumbnail = element("img", "network-card-thumbnail");
      thumbnail.src = "./assets/images/placa-de-rede.png";
      thumbnail.alt = "";
      thumbnail.draggable = false;
      slot.appendChild(thumbnail);
    } else {
      var plus = element("span", "network-card-plus");
      plus.setAttribute("aria-hidden", "true");
      plus.textContent = "+";
      slot.appendChild(plus);
    }
    slot.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    slot.addEventListener("dblclick", function (event) { event.stopPropagation(); });
    slot.addEventListener("click", function (event) {
      event.stopPropagation();
      if (openNetworkCardNodeId === node.id) {
        closeNetworkCardSlot();
        return;
      }
      openNetworkCardSlot(node.id);
    });
    controls.appendChild(slot);

    if (openNetworkCardNodeId !== node.id) return;
    var popover = element("div", "network-card-popover");
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-label", "Placa de rede para " + node.name);
    popover.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    popover.addEventListener("dblclick", function (event) { event.stopPropagation(); });
    var cardImage = element("img", "network-card-popover__image");
    cardImage.src = "./assets/images/placa-de-rede.png";
    cardImage.alt = "Placa de rede";
    cardImage.draggable = false;
    var title = element("strong", "network-card-popover__title");
    title.textContent = "Placa de rede";
    var description = element("span", "network-card-popover__text");
    description.textContent = installed ? "Instalada e pronta para conectar este computador." : "Permite que o computador envie e receba dados pela rede.";
    var install = element("button", "network-card-install");
    install.type = "button";
    install.dataset.installNetworkCard = node.id;
    install.textContent = installed ? "Placa instalada" : "Adicionar ao computador";
    install.disabled = installed;
    install.addEventListener("click", function (event) {
      event.stopPropagation();
      openNetworkCardNodeId = null;
      if (NetLab.Devices.installNetworkCard(node.id) && NetLab.App) {
        NetLab.App.feedback("success", "Placa de rede instalada", node.name + " agora pode ser conectado à rede.");
      }
    });
    popover.appendChild(cardImage);
    popover.appendChild(title);
    popover.appendChild(description);
    popover.appendChild(install);
    item.appendChild(popover);
  }

  function appendIPv4Field(form, nodeId, key, labelText, optional, value, placeholder) {
    var inputId = "ipv4-" + key + "-" + nodeId;
    var label = element("label", "ipv4-popover__label");
    label.setAttribute("for", inputId);
    label.appendChild(document.createTextNode(labelText));
    if (optional) {
      var note = element("span", "ipv4-popover__optional");
      note.textContent = " (opcional)";
      label.appendChild(note);
    }
    var input = element("input", "ipv4-popover__input");
    input.id = inputId;
    input.type = "text";
    input.inputMode = "numeric";
    input.maxLength = 15;
    input.autocomplete = "off";
    input.spellcheck = false;
    input.placeholder = placeholder;
    input.value = value;
    input.dataset.ipv4Field = key;
    form.appendChild(label);
    form.appendChild(input);
  }

  function addIPv4Control(item, node, controls) {
    var configuration = NetLab.IPv4.sanitize(node.ipv4);
    var configured = Boolean(configuration.address);
    var button = element("button", "pc-settings-slot" + (configured ? " is-configured" : ""));
    button.type = "button";
    button.setAttribute("aria-label", (configured ? "Editar" : "Configurar") + " IPv4 do " + node.name);
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-expanded", openIPv4NodeId === node.id ? "true" : "false");
    button.title = configured ? configuration.address + " — editar IPv4" : "Configurar IPv4";
    var icon = svgElement("svg", "pc-settings-icon");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    var use = svgElement("use");
    use.setAttribute("href", "#i-pc");
    icon.appendChild(use);
    button.appendChild(icon);
    button.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    button.addEventListener("dblclick", function (event) { event.stopPropagation(); });
    button.addEventListener("click", function (event) {
      event.stopPropagation();
      if (openIPv4NodeId === node.id) {
        closeIPv4Popover();
        return;
      }
      openIPv4Popover(node.id);
    });
    controls.appendChild(button);

    if (openIPv4NodeId !== node.id) return;
    var form = element("form", "ipv4-popover");
    form.noValidate = true;
    form.setAttribute("role", "dialog");
    form.setAttribute("aria-label", "Configuração IPv4 do " + node.name);
    form.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    form.addEventListener("dblclick", function (event) { event.stopPropagation(); });

    var head = element("div", "ipv4-popover__head");
    var headingCopy = element("div", "ipv4-popover__heading-copy");
    var eyebrow = element("span", "ipv4-popover__eyebrow");
    eyebrow.textContent = "Rede lógica";
    var title = element("strong", "ipv4-popover__title");
    title.textContent = "Configuração IPv4";
    var mode = element("span", "ipv4-popover__mode");
    mode.textContent = "Manual";
    headingCopy.appendChild(eyebrow);
    headingCopy.appendChild(title);
    head.appendChild(headingCopy);
    head.appendChild(mode);
    form.appendChild(head);

    appendIPv4Field(form, node.id, "address", "Endereço IPv4", false, configuration.address, "192.168.1.10");
    appendIPv4Field(form, node.id, "mask", "Máscara de sub-rede", false, configuration.mask, "255.255.255.0");
    appendIPv4Field(form, node.id, "gateway", "Gateway padrão", true, configuration.gateway, "192.168.1.1");

    var error = element("p", "ipv4-popover__error");
    error.setAttribute("role", "alert");
    error.hidden = true;
    form.appendChild(error);

    var actions = element("div", "ipv4-popover__actions");
    var clear = element("button", "ipv4-popover__clear");
    clear.type = "button";
    clear.textContent = "Limpar";
    var save = element("button", "ipv4-popover__save");
    save.type = "submit";
    save.textContent = "Salvar IPv4";
    actions.appendChild(clear);
    actions.appendChild(save);
    form.appendChild(actions);

    form.addEventListener("input", function (event) {
      event.target.removeAttribute("aria-invalid");
      error.hidden = true;
    });
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      event.stopPropagation();
      form.querySelectorAll("[aria-invalid]").forEach(function (field) { field.removeAttribute("aria-invalid"); });
      var result = NetLab.Devices.configureIPv4(node.id, {
        address: form.querySelector('[data-ipv4-field="address"]').value,
        mask: form.querySelector('[data-ipv4-field="mask"]').value,
        gateway: form.querySelector('[data-ipv4-field="gateway"]').value
      });
      if (!result.valid) {
        error.textContent = result.message;
        error.hidden = false;
        var invalidField = form.querySelector('[data-ipv4-field="' + result.field + '"]');
        if (invalidField) { invalidField.setAttribute("aria-invalid", "true"); invalidField.focus(); }
        return;
      }
      if (NetLab.App) NetLab.App.feedback("success", result.unchanged ? "IPv4 já configurado" : "IPv4 salvo", result.value.address + "/" + result.prefix + (result.value.gateway ? " · Gateway " + result.value.gateway : " · Sem gateway"));
    });
    clear.addEventListener("click", function (event) {
      event.stopPropagation();
      if (NetLab.Devices.clearIPv4(node.id) && NetLab.App) NetLab.App.feedback("info", "IPv4 removido", node.name + " voltou a ficar sem configuração IPv4.");
    });
    item.appendChild(form);
  }

  function createNode(node) {
    var connected = node.status === "connected";
    var noInternet = node.status === "no-internet";
    var cardStateClass = node.type === "pc" ? (node.hasNetworkCard ? " has-network-card" : " needs-network-card") : "";
    var popoverStateClass = openNetworkCardNodeId === node.id || openIPv4NodeId === node.id ? " has-open-popover" : "";
    var item = element("div", "network-node network-node--" + node.type + (connected ? " is-connected" : "") + (noInternet ? " is-no-internet" : "") + cardStateClass + popoverStateClass);
    item.dataset.id = node.id;
    item.dataset.type = node.type;
    item.style.left = node.x + "px";
    item.style.top = node.y + "px";
    item.style.width = node.width + "px";
    item.style.height = node.height + "px";
    item.tabIndex = 0;
    var exposesPhysicalPorts = physicalPortsEnabled() && NetLab.PortModel.portsFor(node, NetLab.State.data.challenge).length > 0;
    item.setAttribute("role", node.type === "pc" || exposesPhysicalPorts ? "group" : "button");
    var accessibilityState = statusText(node).toLowerCase();
    item.setAttribute("aria-label", node.name + ", " + accessibilityState);

    var image = element("img", "node-image");
    image.src = nodeVisuals[node.type].image;
    image.alt = nodeVisuals[node.type].alt;
    image.draggable = false;

    var label = element("span", "node-label");
    label.textContent = node.name;
    label.title = node.name;
    var state = element("span", "node-state");
    state.textContent = statusText(node);
    item.appendChild(image);
    item.appendChild(label);
    item.appendChild(state);
    var hasPhysicalPorts = exposesPhysicalPorts && addPhysicalPortRail(item, node);
    if (!hasPhysicalPorts) {
      ["top", "right", "bottom", "left"].forEach(function (side) {
        var port = element("span", "port port--" + side);
        port.setAttribute("aria-hidden", "true");
        item.appendChild(port);
      });
    }
    if (node.type === "pc") {
      var controls = element("div", "pc-control-row");
      item.appendChild(controls);
      addNetworkCardControl(item, node, controls);
      addIPv4Control(item, node, controls);
    }
    item.addEventListener("pointerdown", onNodePointerDown);
    item.addEventListener("dblclick", function (event) {
      event.stopPropagation();
      var current = NetLab.State.getNode(node.id);
      if (!current) return;
      var next = window.prompt("Novo nome do equipamento:", current.name);
      if (next !== null) NetLab.Devices.renameNode(node.id, next);
    });
    item.addEventListener("keydown", function (event) {
      if (event.target !== item) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        NetLab.State.select("node", node.id);
      }
    });
    return item;
  }

  function createBus(bus) {
    var item = element("div", "bus-element");
    item.dataset.id = bus.id;
    item.style.left = bus.x + "px";
    item.style.top = bus.y + "px";
    item.style.width = bus.width + "px";
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", bus.name + ", " + bus.attachments.length + " equipamentos conectados");
    var line = element("span", "bus-line");
    var label = element("span", "bus-label");
    label.textContent = bus.name;
    item.appendChild(line);
    item.appendChild(label);
    var used = new Set(bus.attachments.map(function (attachment) { return Math.round(attachment.offset * 11); }));
    for (var i = 0; i < 12; i += 1) {
      var anchor = element("span", "bus-anchor" + (used.has(i) ? " is-used" : ""));
      anchor.style.left = (i / 11 * 100) + "%";
      anchor.dataset.offset = String(i / 11);
      anchor.setAttribute("aria-hidden", "true");
      item.appendChild(anchor);
    }
    ["left", "right"].forEach(function (side) {
      var handle = element("span", "bus-resizer bus-resizer--" + side);
      handle.dataset.resize = side;
      handle.setAttribute("aria-hidden", "true");
      item.appendChild(handle);
    });
    item.addEventListener("pointerdown", onBusPointerDown);
    item.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); NetLab.State.select("bus", bus.id); }
    });
    return item;
  }

  function addCableGroup(fragment, id, kind, pathData, selected, attachment) {
    var group = svgElement("g", "cable-group");
    var hit = svgElement("path", "connection-hit");
    var visual = svgElement("path", attachment ? "attachment-path" : "connection-path");
    hit.setAttribute("d", pathData);
    visual.setAttribute("d", pathData);
    hit.dataset.kind = kind;
    hit.dataset.id = id;
    visual.dataset.kind = kind;
    visual.dataset.id = id;
    visual.dataset.visual = "true";
    if (selected) visual.classList.add("is-selected");
    group.appendChild(hit);
    group.appendChild(visual);
    fragment.appendChild(group);
  }

  function renderConnections() {
    var fragment = document.createDocumentFragment();
    var selected = NetLab.State.data.selected;
    NetLab.State.data.connections.forEach(function (connection) {
      addCableGroup(fragment, connection.id, "connection", NetLab.Connections.connectionPath(connection), Boolean(selected && selected.kind === "connection" && selected.id === connection.id), false);
    });
    NetLab.State.data.buses.forEach(function (bus) {
      bus.attachments.forEach(function (attachment) {
        addCableGroup(fragment, attachment.id, "attachment", NetLab.Connections.attachmentPath(bus, attachment), Boolean(selected && selected.kind === "attachment" && selected.id === attachment.id), true);
      });
    });
    els.connectionGroup.replaceChildren(fragment);
  }

  function renderNodes() {
    var fragment = document.createDocumentFragment();
    NetLab.State.data.nodes.forEach(function (node) { fragment.appendChild(createNode(node)); });
    els.nodeLayer.replaceChildren(fragment);
  }

  function renderBuses() {
    var fragment = document.createDocumentFragment();
    NetLab.State.data.buses.forEach(function (bus) { fragment.appendChild(createBus(bus)); });
    els.busLayer.replaceChildren(fragment);
  }

  function renderSelection() {
    var selected = NetLab.State.data.selected;
    els.nodeLayer.querySelectorAll(".network-node").forEach(function (item) {
      item.classList.toggle("is-selected", Boolean(selected && selected.kind === "node" && selected.id === item.dataset.id));
      item.classList.toggle("is-cable-source", Boolean(NetLab.State.data.connectionDraft && NetLab.State.data.connectionDraft.sourceId === item.dataset.id));
      item.classList.toggle("is-communication-source", Boolean(NetLab.State.data.communicationDraft && NetLab.State.data.communicationDraft.sourceId === item.dataset.id));
    });
    els.nodeLayer.querySelectorAll(".device-port-button").forEach(function (button) {
      var draft = NetLab.State.data.connectionDraft;
      var active = Boolean(draft && draft.sourceId === button.dataset.nodeId && draft.sourcePortId === button.dataset.portId);
      button.classList.toggle("is-cable-source", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    els.busLayer.querySelectorAll(".bus-element").forEach(function (item) {
      item.classList.toggle("is-selected", Boolean(selected && selected.kind === "bus" && selected.id === item.dataset.id));
    });
    els.connectionGroup.querySelectorAll("[data-visual]").forEach(function (path) {
      path.classList.toggle("is-selected", Boolean(selected && selected.kind === path.dataset.kind && selected.id === path.dataset.id));
    });
  }

  function updateEmpty() {
    els.emptyState.hidden = NetLab.State.data.nodes.length > 0 || NetLab.State.data.buses.length > 0;
  }

  function updateNetworkTip() {
    var hasEquipment = NetLab.State.data.nodes.some(function (node) { return node.type !== "internet"; });
    els.networkTip.hidden = !hasEquipment || NetLab.Connections.hasActiveInternet();
  }

  function renderAll() {
    updateTransform();
    renderConnections();
    renderBuses();
    renderNodes();
    renderSelection();
    updateEmpty();
    updateNetworkTip();
    els.workspace.dataset.tool = NetLab.State.data.tool;
  }

  function onStateChange(state, reason) {
    if (["selection", "tool", "connection-draft", "communication-source", "history", "hint", "pan", "zoom"].indexOf(reason) >= 0) {
      updateTransform();
      renderSelection();
      els.workspace.dataset.tool = state.tool;
      return;
    }
    renderAll();
  }

  function updateGeometry() {
    NetLab.State.data.connections.forEach(function (connection) {
      var path = NetLab.Connections.connectionPath(connection);
      els.connectionGroup.querySelectorAll('[data-kind="connection"][data-id="' + CSS.escape(connection.id) + '"]').forEach(function (item) { item.setAttribute("d", path); });
    });
    NetLab.State.data.buses.forEach(function (bus) {
      bus.attachments.forEach(function (attachment) {
        var path = NetLab.Connections.attachmentPath(bus, attachment);
        els.connectionGroup.querySelectorAll('[data-kind="attachment"][data-id="' + CSS.escape(attachment.id) + '"]').forEach(function (item) { item.setAttribute("d", path); });
      });
    });
  }

  function handleCableEndpoint(nodeId, portId) {
    var node = NetLab.State.getNode(nodeId);
    var draft = NetLab.State.data.connectionDraft;
    if (!draft && !NetLab.Connections.canConnectNode(node)) {
      if (NetLab.App) NetLab.App.feedback("warning", "Placa de rede necessária", "Clique no slot do " + node.name + " e adicione uma placa antes de conectar o cabo.");
      openNetworkCardSlot(nodeId);
      return;
    }
    if (!draft) {
      NetLab.State.data.connectionDraft = { sourceId: nodeId, sourcePortId: portId || null };
      NetLab.State.data.selected = { kind: "node", id: nodeId };
      NetLab.State.emit("connection-draft");
      showHint(portId ? "Porta de origem selecionada. Escolha uma porta ou equipamento de destino." : "Origem selecionada. Escolha outro equipamento ou um barramento.");
      return;
    }
    var result = NetLab.Connections.add(draft.sourceId, nodeId, draft.sourcePortId, portId || null);
    if (result.ok) {
      NetLab.State.data.connectionDraft = null;
      els.preview.hidden = true;
      NetLab.State.emit("connection-draft");
      showHint("Cabo criado. A ferramenta continua ativa.");
    } else {
      if (result.nodeId) openNetworkCardSlot(result.nodeId);
      if (NetLab.App) NetLab.App.feedback("warning", result.reason === "invalid-type" ? "Conexão inválida" : "Cabo não criado", result.message);
    }
  }

  function onNodePointerDown(event) {
    if (event.button !== 0 || isAnimating) return;
    event.stopPropagation();
    var id = event.currentTarget.dataset.id;
    var tool = NetLab.State.data.tool;
    if (tool === "cable") {
      var node = NetLab.State.getNode(id);
      if (physicalPortsEnabled() && NetLab.PortModel.portsFor(node, NetLab.State.data.challenge).length) {
        if (NetLab.App) NetLab.App.feedback("info", "Escolha uma porta", "Use uma porta livre ao lado do " + node.name + " para conectar o cabo.");
        return;
      }
      handleCableEndpoint(id, null);
      return;
    }
    if (tool === "communication") { NetLab.Communication.handleNode(id); return; }
    if (tool === "pan") { startPan(event); return; }
    if (tool !== "select") return;
    NetLab.State.select("node", id);
    var node = NetLab.State.getNode(id);
    if (!node) return;
    drag = { mode: "node", id: id, pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, startX: node.x, startY: node.y, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onBusPointerDown(event) {
    if (event.button !== 0 || isAnimating) return;
    event.stopPropagation();
    var item = event.currentTarget;
    var id = item.dataset.id;
    var bus = NetLab.State.getBus(id);
    if (!bus) return;
    if (NetLab.State.data.tool === "cable") {
      var draft = NetLab.State.data.connectionDraft;
      if (!draft) { if (NetLab.App) NetLab.App.feedback("warning", "Escolha a origem", "Clique primeiro em um equipamento e depois no barramento."); return; }
      var point = worldPoint(event.clientX, event.clientY);
      var attached = NetLab.Connections.attachToBus(draft.sourceId, id, (point.x - bus.x) / bus.width);
      if (attached.ok) { NetLab.State.data.connectionDraft = null; els.preview.hidden = true; NetLab.State.emit("connection-draft"); showHint("Equipamento ligado ao barramento."); }
      else if (NetLab.App) NetLab.App.feedback("warning", attached.reason === "invalid-type" ? "Conexão inválida" : "Ligação não criada", attached.message);
      return;
    }
    if (NetLab.State.data.tool === "pan") { startPan(event); return; }
    if (NetLab.State.data.tool !== "select") return;
    NetLab.State.select("bus", id);
    var resizeSide = event.target.dataset.resize;
    drag = {
      mode: resizeSide ? "bus-resize" : "bus",
      side: resizeSide || null,
      id: id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: bus.x,
      startY: bus.y,
      startWidth: bus.width,
      moved: false
    };
    item.setPointerCapture(event.pointerId);
  }

  function startPan(event) {
    drag = {
      mode: "pan",
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: NetLab.State.data.pan.x,
      startPanY: NetLab.State.data.pan.y,
      moved: false
    };
    els.workspace.classList.add("is-panning");
    if (event.currentTarget && event.currentTarget.setPointerCapture) event.currentTarget.setPointerCapture(event.pointerId);
  }

  function applyDrag(clientX, clientY) {
    if (!drag) return;
    var dx = (clientX - drag.startClientX) / (drag.mode === "pan" ? 1 : NetLab.State.data.zoom);
    var dy = (clientY - drag.startClientY) / (drag.mode === "pan" ? 1 : NetLab.State.data.zoom);
    drag.moved = drag.moved || Math.abs(clientX - drag.startClientX) + Math.abs(clientY - drag.startClientY) > 3;
    if (drag.mode === "node") {
      var node = NetLab.State.getNode(drag.id);
      if (!node) return;
      node.x = NetLab.State.clamp(drag.startX + dx, 0, NetLab.State.WORLD_WIDTH - node.width);
      node.y = NetLab.State.clamp(drag.startY + dy, 0, NetLab.State.WORLD_HEIGHT - node.height);
      var nodeElement = els.nodeLayer.querySelector('[data-id="' + CSS.escape(node.id) + '"]');
      if (nodeElement) { nodeElement.style.left = node.x + "px"; nodeElement.style.top = node.y + "px"; }
      updateGeometry();
    }
    if (drag.mode === "bus") {
      var bus = NetLab.State.getBus(drag.id);
      if (!bus) return;
      bus.x = NetLab.State.clamp(drag.startX + dx, 0, NetLab.State.WORLD_WIDTH - bus.width);
      bus.y = NetLab.State.clamp(drag.startY + dy, 0, NetLab.State.WORLD_HEIGHT - 48);
      var busElement = els.busLayer.querySelector('[data-id="' + CSS.escape(bus.id) + '"]');
      if (busElement) { busElement.style.left = bus.x + "px"; busElement.style.top = bus.y + "px"; }
      updateGeometry();
    }
    if (drag.mode === "bus-resize") {
      var resizeBus = NetLab.State.getBus(drag.id);
      if (!resizeBus) return;
      if (drag.side === "right") resizeBus.width = NetLab.State.clamp(drag.startWidth + dx, 260, Math.min(1000, NetLab.State.WORLD_WIDTH - drag.startX));
      else {
        var minLeft = Math.max(0, drag.startX + drag.startWidth - 1000);
        var maxLeft = drag.startX + drag.startWidth - 260;
        resizeBus.x = NetLab.State.clamp(drag.startX + dx, minLeft, maxLeft);
        resizeBus.width = drag.startWidth + (drag.startX - resizeBus.x);
      }
      var resizeElement = els.busLayer.querySelector('[data-id="' + CSS.escape(resizeBus.id) + '"]');
      if (resizeElement) { resizeElement.style.left = resizeBus.x + "px"; resizeElement.style.width = resizeBus.width + "px"; }
      updateGeometry();
    }
    if (drag.mode === "pan") {
      NetLab.State.data.pan.x = drag.startPanX + (clientX - drag.startClientX);
      NetLab.State.data.pan.y = drag.startPanY + (clientY - drag.startClientY);
      updateTransform();
    }
  }

  function onPointerMove(event) {
    if (NetLab.State.data.connectionDraft) updatePreview(event.clientX, event.clientY);
    if (!drag || drag.pointerId !== event.pointerId) return;
    var x = event.clientX;
    var y = event.clientY;
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(function () { applyDrag(x, y); });
  }

  function endDrag(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    window.cancelAnimationFrame(frame);
    applyDrag(event.clientX, event.clientY);
    var completed = drag;
    drag = null;
    els.workspace.classList.remove("is-panning");
    if (completed.moved && completed.mode !== "pan") {
      NetLab.History.record(completed.mode === "node" ? "move-node" : completed.mode === "bus" ? "move-bus" : "resize-bus");
      NetLab.State.emit("move");
    } else if (completed.mode === "pan") NetLab.State.emit("pan");
  }

  function onWorkspacePointerDown(event) {
    if (event.button !== 0 || isAnimating) return;
    if (!event.target.closest || !event.target.closest(".network-card-slot, .pc-settings-slot, .network-card-popover, .ipv4-popover")) {
      closeNetworkCardSlot();
      closeIPv4Popover();
    }
    if (event.target.closest && (event.target.closest(".network-node") || event.target.closest(".bus-element") || event.target.closest(".cable-group"))) return;
    var tool = NetLab.State.data.tool;
    if (tool === "pan") { startPan(event); return; }
    var point = worldPoint(event.clientX, event.clientY);
    if (tool.indexOf("add-") === 0 && tool !== "add-bus") { addNodeAtPoint(tool.slice(4), point.x, point.y); return; }
    if (tool === "add-bus") { NetLab.Devices.addBus(point.x - 260, point.y - 24); return; }
    if (tool === "select") NetLab.State.select(null, null);
  }

  function onCablePointerDown(event) {
    var target = event.target;
    if (!target.dataset || !target.dataset.kind) return;
    event.preventDefault();
    event.stopPropagation();
    if (NetLab.State.data.tool !== "select") return;
    NetLab.State.select(target.dataset.kind, target.dataset.id);
  }

  function updatePreview(clientX, clientY) {
    var draft = NetLab.State.data.connectionDraft;
    var source = draft && NetLab.State.getNode(draft.sourceId);
    if (!source) { els.preview.hidden = true; return; }
    var point = worldPoint(clientX, clientY);
    els.preview.setAttribute("d", NetLab.Connections.smoothPath(NetLab.Connections.endpointPoint(source, draft.sourcePortId), point));
    els.preview.hidden = false;
  }

  function clearDrafts() {
    NetLab.State.data.connectionDraft = null;
    NetLab.State.data.communicationDraft = null;
    els.preview.hidden = true;
    cancelAnimation();
    NetLab.State.setTool("select");
  }

  function addAtCenter(type) {
    var point = centerPoint();
    var offsets = [[0, 0], [-180, -120], [180, -120], [-180, 120], [180, 120], [0, -210], [0, 210], [-320, 0], [320, 0]];
    var index = (NetLab.State.data.nodes.length + NetLab.State.data.buses.length) % offsets.length;
    var offset = offsets[index];
    if (NetLab.Devices.dimensionsFor(type)) return addNodeAtPoint(type, point.x + offset[0], point.y + offset[1]);
    return NetLab.Devices.addBus(point.x + offset[0] - 260, point.y + offset[1] - 24);
  }

  function addNodeAtPoint(type, centerX, centerY) {
    var dimensions = NetLab.Devices.dimensionsFor(type);
    if (!dimensions) return null;
    return NetLab.Devices.add(type, centerX - dimensions.width / 2, centerY - dimensions.height / 2);
  }

  function zoomTo(nextZoom) {
    var state = NetLab.State.data;
    var rect = els.workspace.getBoundingClientRect();
    var centerX = rect.width / 2;
    var centerY = rect.height / 2;
    var worldX = (centerX - state.pan.x) / state.zoom;
    var worldY = (centerY - state.pan.y) / state.zoom;
    state.zoom = NetLab.State.clamp(nextZoom, .4, 2);
    state.pan.x = centerX - worldX * state.zoom;
    state.pan.y = centerY - worldY * state.zoom;
    NetLab.State.emit("zoom");
  }

  function zoomBy(delta) { zoomTo(NetLab.State.data.zoom + delta); }

  function fitToScreen() {
    var rect = els.workspace.getBoundingClientRect();
    var zoom = NetLab.State.clamp(Math.min((rect.width - 50) / NetLab.State.WORLD_WIDTH, (rect.height - 130) / NetLab.State.WORLD_HEIGHT), .4, 2);
    NetLab.State.data.zoom = zoom;
    NetLab.State.data.pan.x = (rect.width - NetLab.State.WORLD_WIDTH * zoom) / 2;
    NetLab.State.data.pan.y = Math.max(112, (rect.height - NetLab.State.WORLD_HEIGHT * zoom) / 2);
    NetLab.State.emit("zoom");
  }

  function showHint(message) {
    window.clearTimeout(hintTimer);
    els.hint.textContent = message;
    els.hint.classList.add("is-visible");
    hintTimer = window.setTimeout(function () { els.hint.classList.remove("is-visible"); }, 2400);
  }

  function findVisual(edge) {
    return els.connectionGroup.querySelector('[data-visual][data-kind="' + edge.kind + '"][data-id="' + CSS.escape(edge.id) + '"]');
  }

  function animateSvgPath(pathElement, reverse, duration, token, routeClass) {
    return new Promise(function (resolve, reject) {
      if (!pathElement) { resolve(); return; }
      pathElement.classList.add(routeClass);
      var length = pathElement.getTotalLength();
      var started = performance.now();
      function tick(now) {
        if (token !== animationToken) { pathElement.classList.remove(routeClass); reject(new Error("cancelled")); return; }
        var progress = Math.min(1, (now - started) / duration);
        var point = pathElement.getPointAtLength((reverse ? 1 - progress : progress) * length);
        els.packet.setAttribute("cx", point.x);
        els.packet.setAttribute("cy", point.y);
        if (progress < 1) window.requestAnimationFrame(tick);
        else { window.setTimeout(function () { pathElement.classList.remove(routeClass); }, 320); resolve(); }
      }
      window.requestAnimationFrame(tick);
    });
  }

  function attachmentById(id) {
    for (var i = 0; i < NetLab.State.data.buses.length; i += 1) {
      var attachment = NetLab.State.data.buses[i].attachments.find(function (item) { return item.id === id; });
      if (attachment) return { bus: NetLab.State.data.buses[i], attachment: attachment };
    }
    return null;
  }

  function animateBusSegment(previousEdge, nextEdge, token, routeClass) {
    var previous = attachmentById(previousEdge.id);
    var next = attachmentById(nextEdge.id);
    if (!previous || !next || previous.bus.id !== next.bus.id) return Promise.resolve();
    var start = NetLab.Connections.busPoint(previous.bus, previous.attachment);
    var end = NetLab.Connections.busPoint(next.bus, next.attachment);
    var busElement = els.busLayer.querySelector('[data-id="' + CSS.escape(previous.bus.id) + '"]');
    if (busElement) busElement.classList.add(routeClass);
    return new Promise(function (resolve, reject) {
      var started = performance.now();
      function tick(now) {
        if (token !== animationToken) { if (busElement) busElement.classList.remove(routeClass); reject(new Error("cancelled")); return; }
        var progress = Math.min(1, (now - started) / 750);
        els.packet.setAttribute("cx", start.x + (end.x - start.x) * progress);
        els.packet.setAttribute("cy", start.y + (end.y - start.y) * progress);
        if (progress < 1) window.requestAnimationFrame(tick);
        else { if (busElement) window.setTimeout(function () { busElement.classList.remove(routeClass); }, 320); resolve(); }
      }
      window.requestAnimationFrame(tick);
    });
  }

  function animatePath(path, options) {
    animationToken += 1;
    var token = animationToken;
    var variant = options && options.variant === "error" ? "error" : "success";
    var routeClass = variant === "error" ? "is-route-error" : "is-route";
    isAnimating = true;
    els.packet.classList.toggle("is-error", variant === "error");
    els.packet.hidden = false;
    var sequence = Promise.resolve();
    path.edges.forEach(function (edge, index) {
      var from = path.vertices[index];
      var to = path.vertices[index + 1];
      if (from.indexOf("bus:") === 0 && index > 0) sequence = sequence.then(function () { return animateBusSegment(path.edges[index - 1], edge, token, routeClass); });
      sequence = sequence.then(function () {
        var reverse = false;
        if (edge.kind === "connection") {
          var connection = NetLab.State.data.connections.find(function (item) { return item.id === edge.id; });
          reverse = Boolean(connection && connection.sourceId !== from);
        } else reverse = from.indexOf("bus:") === 0;
        return animateSvgPath(findVisual(edge), reverse, 1000, token, routeClass);
      });
    });
    return sequence.finally(function () {
      if (token === animationToken) {
        isAnimating = false;
        els.packet.hidden = true;
        els.packet.classList.remove("is-error");
        els.connectionGroup.querySelectorAll(".is-route, .is-route-error").forEach(function (item) { item.classList.remove("is-route", "is-route-error"); });
        els.busLayer.querySelectorAll(".is-route, .is-route-error").forEach(function (item) { item.classList.remove("is-route", "is-route-error"); });
      }
    });
  }

  function cancelAnimation() {
    if (!isAnimating) return;
    animationToken += 1;
    isAnimating = false;
    els.packet.hidden = true;
    els.packet.classList.remove("is-error");
    els.connectionGroup.querySelectorAll(".is-route, .is-route-error").forEach(function (item) { item.classList.remove("is-route", "is-route-error"); });
    els.busLayer.querySelectorAll(".is-route, .is-route-error").forEach(function (item) { item.classList.remove("is-route", "is-route-error"); });
  }

  function celebrate() {
    els.workspace.classList.remove("is-celebrating");
    void els.workspace.offsetWidth;
    els.workspace.classList.add("is-celebrating");
    window.setTimeout(function () { els.workspace.classList.remove("is-celebrating"); }, 700);
  }

  function init() {
    els = {
      workspace: document.getElementById("workspace"),
      world: document.getElementById("world"),
      nodeLayer: document.getElementById("node-layer"),
      busLayer: document.getElementById("bus-layer"),
      connectionGroup: document.getElementById("connection-group"),
      preview: document.getElementById("cable-preview"),
      packet: document.getElementById("packet"),
      emptyState: document.getElementById("empty-state"),
      hint: document.getElementById("interaction-hint"),
      networkTip: document.getElementById("network-tip")
    };
    els.workspace.addEventListener("pointerdown", onWorkspacePointerDown);
    els.workspace.addEventListener("pointermove", onPointerMove);
    els.workspace.addEventListener("pointerup", endDrag);
    els.workspace.addEventListener("pointercancel", endDrag);
    els.connectionGroup.addEventListener("pointerdown", onCablePointerDown);
    els.workspace.addEventListener("wheel", function (event) {
      if (!event.ctrlKey) return;
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? .1 : -.1);
    }, { passive: false });
    NetLab.State.subscribe(onStateChange);
    renderAll();
  }

  NetLab.Workspace = {
    init: init,
    render: renderAll,
    worldPoint: worldPoint,
    addAtCenter: addAtCenter,
    zoomBy: zoomBy,
    fitToScreen: fitToScreen,
    showHint: showHint,
    clearDrafts: clearDrafts,
    openNetworkCardSlot: openNetworkCardSlot,
    animatePath: animatePath,
    cancelAnimation: cancelAnimation,
    celebrate: celebrate
  };
}());
