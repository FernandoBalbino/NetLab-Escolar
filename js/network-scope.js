(function () {
  "use strict";

  var NetLab = window.NetLab = window.NetLab || {};
  var AVAILABLE_CITIES = Object.freeze([
    Object.freeze({ id: "maceio", name: "Maceió" }),
    Object.freeze({ id: "arapiraca", name: "Arapiraca" })
  ]);
  var DEFAULT_CITY = "maceio";
  var FINAL_DEVICE_TYPES = ["pc", "notebook", "server", "printer"];

  function dataOf(snapshot) {
    return snapshot || (NetLab.State && NetLab.State.data) || { nodes: [], connections: [], buses: [] };
  }

  function nodesOf(snapshot) { return Array.isArray(dataOf(snapshot).nodes) ? dataOf(snapshot).nodes : []; }
  function connectionsOf(snapshot) { return Array.isArray(dataOf(snapshot).connections) ? dataOf(snapshot).connections : []; }
  function nodeMap(snapshot) { return new Map(nodesOf(snapshot).map(function (node) { return [node.id, node]; })); }
  function isFinalDevice(node) { return Boolean(node && FINAL_DEVICE_TYPES.indexOf(node.type) >= 0); }
  function otherId(connection, nodeId) { return connection.sourceId === nodeId ? connection.targetId : connection.sourceId; }
  function touches(connection, nodeId) { return connection.sourceId === nodeId || connection.targetId === nodeId; }

  function sanitizeCity(value) {
    return AVAILABLE_CITIES.some(function (city) { return city.id === value; }) ? value : DEFAULT_CITY;
  }

  function cityName(cityId) {
    var city = AVAILABLE_CITIES.find(function (item) { return item.id === cityId; });
    return city ? city.name : "Cidade não definida";
  }

  function migrateLegacyNetworkState(project) {
    if (!project || typeof project !== "object" || !Array.isArray(project.nodes)) return project;
    var migrated = Object.assign({}, project);
    migrated.nodes = project.nodes.map(function (node) {
      if (!node || node.type !== "router") return node;
      return Object.assign({}, node, { city: sanitizeCity(node.city) });
    });
    return migrated;
  }

  function getRouterCity(routerId, snapshot) {
    var router = nodeMap(snapshot).get(routerId);
    return router && router.type === "router" ? sanitizeCity(router.city) : null;
  }

  function portIdAt(connection, nodeId) {
    if (connection.sourceId === nodeId) return connection.sourcePortId || null;
    if (connection.targetId === nodeId) return connection.targetPortId || null;
    return null;
  }

  function routerPortKind(connection, routerId, snapshot) {
    var nodes = nodeMap(snapshot);
    var router = nodes.get(routerId);
    if (!router || router.type !== "router" || !touches(connection, routerId)) return "invalid";
    var portId = portIdAt(connection, routerId);
    if (portId === "wan") return "wan";
    if (typeof portId === "string" && portId.indexOf("lan-") === 0) return "lan";
    var neighbor = nodes.get(otherId(connection, routerId));
    if (!portId && neighbor && neighbor.type === "internet") return "wan";
    if (!portId && neighbor && ["switch"].concat(FINAL_DEVICE_TYPES).indexOf(neighbor.type) >= 0) return "lan";
    return "unknown";
  }

  function localTraversalAllowed(connection, currentId, ownerRouterId, nodes, snapshot) {
    if (!touches(connection, currentId)) return false;
    var current = nodes.get(currentId);
    var neighbor = nodes.get(otherId(connection, currentId));
    if (!current || !neighbor || current.type === "internet" || neighbor.type === "internet") return false;
    if (current.type === "router") {
      return current.id === ownerRouterId && neighbor.type !== "router" && routerPortKind(connection, current.id, snapshot) === "lan";
    }
    if (neighbor.type === "router") {
      return neighbor.id === ownerRouterId && routerPortKind(connection, neighbor.id, snapshot) === "lan";
    }
    return true;
  }

  function collectRouterLan(router, snapshot) {
    var nodes = nodeMap(snapshot);
    var connections = connectionsOf(snapshot);
    var visited = new Set([router.id]);
    var queue = [router.id];
    var usedConnections = new Set();
    while (queue.length) {
      var currentId = queue.shift();
      connections.forEach(function (connection) {
        if (!localTraversalAllowed(connection, currentId, router.id, nodes, snapshot)) return;
        var neighborId = otherId(connection, currentId);
        usedConnections.add(connection.id);
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      });
    }
    var deviceIds = Array.from(visited);
    var finalDeviceIds = deviceIds.filter(function (id) { return isFinalDevice(nodes.get(id)); });
    return {
      id: "lan-" + router.id,
      routerId: router.id,
      city: sanitizeCity(router.city),
      deviceIds: deviceIds,
      finalDeviceIds: finalDeviceIds,
      connectionIds: Array.from(usedConnections),
      valid: finalDeviceIds.length > 0 && usedConnections.size > 0
    };
  }

  function collectOrphanLans(snapshot, assignedIds) {
    var nodes = nodeMap(snapshot);
    var connections = connectionsOf(snapshot);
    var candidates = nodesOf(snapshot).filter(function (node) {
      return node.type !== "router" && node.type !== "internet" && !assignedIds.has(node.id);
    });
    var seen = new Set();
    var networks = [];
    candidates.forEach(function (start) {
      if (seen.has(start.id)) return;
      var queue = [start.id];
      var members = new Set([start.id]);
      var usedConnections = new Set();
      seen.add(start.id);
      while (queue.length) {
        var currentId = queue.shift();
        connections.forEach(function (connection) {
          if (!touches(connection, currentId)) return;
          var neighbor = nodes.get(otherId(connection, currentId));
          if (!neighbor || neighbor.type === "router" || neighbor.type === "internet" || assignedIds.has(neighbor.id)) return;
          usedConnections.add(connection.id);
          if (!seen.has(neighbor.id)) {
            seen.add(neighbor.id);
            members.add(neighbor.id);
            queue.push(neighbor.id);
          }
        });
      }
      var deviceIds = Array.from(members);
      var finalDeviceIds = deviceIds.filter(function (id) { return isFinalDevice(nodes.get(id)); });
      var hasSwitch = deviceIds.some(function (id) { return nodes.get(id).type === "switch"; });
      if (hasSwitch || finalDeviceIds.length > 1) {
        networks.push({
          id: "lan-local-" + (networks.length + 1),
          routerId: null,
          city: null,
          deviceIds: deviceIds,
          finalDeviceIds: finalDeviceIds,
          connectionIds: Array.from(usedConnections),
          valid: hasSwitch && finalDeviceIds.length > 0 && usedConnections.size > 0
        });
      }
    });
    return networks;
  }

  function detectLocalNetworks(snapshot) {
    var routers = nodesOf(snapshot).filter(function (node) { return node.type === "router"; });
    var networks = routers.map(function (router) { return collectRouterLan(router, snapshot); });
    var assigned = new Set();
    networks.forEach(function (network) { network.deviceIds.forEach(function (id) { assigned.add(id); }); });
    return networks.concat(collectOrphanLans(snapshot, assigned));
  }

  function hasValidLocalNetwork(routerId, snapshot) {
    return detectLocalNetworks(snapshot).some(function (network) { return network.routerId === routerId && network.valid; });
  }

  function findResponsibleRouter(deviceId, snapshot) {
    var nodes = nodeMap(snapshot);
    var start = nodes.get(deviceId);
    if (!start) return null;
    if (start.type === "router") return start;
    var connections = connectionsOf(snapshot);
    var visited = new Set([deviceId]);
    var queue = [{ id: deviceId, distance: 0 }];
    var matches = [];
    while (queue.length) {
      var current = queue.shift();
      connections.forEach(function (connection) {
        if (!touches(connection, current.id)) return;
        var neighborId = otherId(connection, current.id);
        var neighbor = nodes.get(neighborId);
        if (!neighbor || neighbor.type === "internet" || visited.has(neighborId)) return;
        if (neighbor.type === "router") {
          if (routerPortKind(connection, neighbor.id, snapshot) === "lan") matches.push({ router: neighbor, distance: current.distance + 1 });
          return;
        }
        visited.add(neighborId);
        queue.push({ id: neighborId, distance: current.distance + 1 });
      });
    }
    matches.sort(function (first, second) { return first.distance - second.distance || first.router.id.localeCompare(second.router.id); });
    return matches.length ? matches[0].router : null;
  }

  function getDeviceLocation(deviceId, snapshot) {
    var router = findResponsibleRouter(deviceId, snapshot);
    if (!router) return { city: null, cityName: "Cidade não definida", routerId: null, routerName: null };
    var city = sanitizeCity(router.city);
    return { city: city, cityName: cityName(city), routerId: router.id, routerName: router.name };
  }

  function getDeviceCity(deviceId, snapshot) { return getDeviceLocation(deviceId, snapshot).city; }

  function findRouterConnections(snapshot) {
    var nodes = nodeMap(snapshot);
    return connectionsOf(snapshot).filter(function (connection) {
      var source = nodes.get(connection.sourceId);
      var target = nodes.get(connection.targetId);
      return source && target && source.type === "router" && target.type === "router";
    });
  }

  function classifyRouterLink(routerA, routerB, connection, snapshot, localNetworks) {
    if (!routerA || !routerB || !connection) return { scope: "invalid", reason: "Ligação inválida entre roteadores." };
    var networks = localNetworks || detectLocalNetworks(snapshot);
    var lanA = networks.find(function (network) { return network.routerId === routerA.id && network.valid; });
    var lanB = networks.find(function (network) { return network.routerId === routerB.id && network.valid; });
    if (!lanA || !lanB) return { scope: "incomplete", reason: "Cada roteador precisa possuir sua própria LAN com pelo menos um equipamento final." };
    var portA = routerPortKind(connection, routerA.id, snapshot);
    var portB = routerPortKind(connection, routerB.id, snapshot);
    var cityA = sanitizeCity(routerA.city);
    var cityB = sanitizeCity(routerB.city);
    if (portA === "wan" && portB === "wan") {
      if (cityA === cityB) {
        return { scope: "man", city: cityA, label: "MAN — " + cityName(cityA), tooltip: "Ligação entre duas redes locais da mesma cidade" };
      }
      return { scope: "wan", cities: [cityA, cityB], label: "WAN — " + cityName(cityA) + " ↔ " + cityName(cityB), tooltip: "Ligação entre redes localizadas em cidades diferentes" };
    }
    if (cityA !== cityB && (portA === "wan" || portB === "wan")) {
      return { scope: "wan", cities: [cityA, cityB], label: "WAN — " + cityName(cityA) + " ↔ " + cityName(cityB), tooltip: "Ligação entre redes localizadas em cidades diferentes" };
    }
    return { scope: "local", reason: "Uma ligação LAN ↔ WAN pode representar roteadores dentro da mesma unidade e não forma uma MAN automaticamente." };
  }

  function analyzeRouterLinks(snapshot, localNetworks) {
    var nodes = nodeMap(snapshot);
    return findRouterConnections(snapshot).map(function (connection) {
      var routerA = nodes.get(connection.sourceId);
      var routerB = nodes.get(connection.targetId);
      return Object.assign({ connectionId: connection.id, routerAId: routerA.id, routerBId: routerB.id }, classifyRouterLink(routerA, routerB, connection, snapshot, localNetworks));
    });
  }

  function detectMetropolitanLinks(snapshot, localNetworks) {
    return analyzeRouterLinks(snapshot, localNetworks).filter(function (link) { return link.scope === "man"; });
  }

  function detectWideAreaLinks(snapshot, localNetworks, routerLinks) {
    var nodes = nodeMap(snapshot);
    var networks = localNetworks || detectLocalNetworks(snapshot);
    var links = (routerLinks || analyzeRouterLinks(snapshot, networks)).filter(function (link) { return link.scope === "wan"; });
    connectionsOf(snapshot).forEach(function (connection) {
      var source = nodes.get(connection.sourceId);
      var target = nodes.get(connection.targetId);
      if (!source || !target || [source.type, target.type].sort().join("|") !== "internet|router") return;
      var router = source.type === "router" ? source : target;
      if (routerPortKind(connection, router.id, snapshot) !== "wan") return;
      var lan = networks.find(function (network) { return network.routerId === router.id && network.valid; });
      if (!lan) return;
      links.push({
        connectionId: connection.id,
        routerId: router.id,
        scope: "internet",
        city: sanitizeCity(router.city),
        label: "WAN — Internet",
        tooltip: "A rede local está conectada à Internet pela porta WAN"
      });
    });
    return links;
  }

  function classificationWarnings(snapshot, localNetworks, routerLinks) {
    var warnings = [];
    var nodes = nodeMap(snapshot);
    var routers = nodesOf(snapshot).filter(function (node) { return node.type === "router"; });
    routerLinks.forEach(function (link) {
      if (link.scope === "incomplete") warnings.push("Existem roteadores conectados, mas ainda não há duas redes locais completas.");
      if (link.scope === "local") warnings.push(link.reason);
    });
    var validByRouter = new Set(localNetworks.filter(function (network) { return network.valid && network.routerId; }).map(function (network) { return network.routerId; }));
    routers.forEach(function (router, index) {
      routers.slice(index + 1).forEach(function (other) {
        var sameCity = sanitizeCity(router.city) === sanitizeCity(other.city);
        var connected = routerLinks.some(function (link) {
          return [link.routerAId, link.routerBId].indexOf(router.id) >= 0 && [link.routerAId, link.routerBId].indexOf(other.id) >= 0;
        });
        if (sameCity && connected && (!validByRouter.has(router.id) || !validByRouter.has(other.id))) {
          warnings.push("Para formar uma MAN, conecte pelo menos um equipamento final à LAN de cada roteador.");
        }
        if (sameCity && !connected && validByRouter.has(router.id) && validByRouter.has(other.id)) {
          warnings.push("Há duas LANs em " + cityName(sanitizeCity(router.city)) + ", mas elas ainda não estão conectadas entre si.");
        }
        if (!sameCity && !connected && validByRouter.has(router.id) && validByRouter.has(other.id)) {
          warnings.push("As LANs estão em cidades diferentes, mas precisam estar conectadas para formar uma WAN geográfica.");
        }
      });
    });
    connectionsOf(snapshot).forEach(function (connection) {
      var source = nodes.get(connection.sourceId);
      var target = nodes.get(connection.targetId);
      if (!source || !target || [source.type, target.type].sort().join("|") !== "internet|router") return;
      var router = source.type === "router" ? source : target;
      if (routerPortKind(connection, router.id, snapshot) !== "wan") warnings.push("A Internet deve ser conectada à porta WAN do roteador.");
    });
    return Array.from(new Set(warnings));
  }

  function classifyNetworkScope(snapshot) {
    var localNetworks = detectLocalNetworks(snapshot);
    var validLocalNetworks = localNetworks.filter(function (network) { return network.valid; });
    var routerLinks = analyzeRouterLinks(snapshot, localNetworks);
    var metropolitanLinks = routerLinks.filter(function (link) { return link.scope === "man"; });
    var wideAreaLinks = detectWideAreaLinks(snapshot, localNetworks, routerLinks);
    var hasLAN = validLocalNetworks.length > 0;
    var hasMAN = metropolitanLinks.length > 0;
    var hasWAN = wideAreaLinks.length > 0;
    var classifications = [];
    if (hasLAN) classifications.push("LAN");
    if (hasMAN) classifications.push("MAN");
    if (hasWAN) classifications.push("WAN");
    return {
      hasLAN: hasLAN,
      hasMAN: hasMAN,
      hasWAN: hasWAN,
      classifications: classifications,
      localNetworks: localNetworks,
      validLocalNetworks: validLocalNetworks,
      routerLinks: routerLinks,
      metropolitanLinks: metropolitanLinks,
      wideAreaLinks: wideAreaLinks,
      warnings: classificationWarnings(snapshot, localNetworks, routerLinks)
    };
  }

  function findConnectionScope(connectionId, snapshot, analysis) {
    var result = analysis || classifyNetworkScope(snapshot);
    return result.metropolitanLinks.concat(result.wideAreaLinks).find(function (link) { return link.connectionId === connectionId; }) || null;
  }

  NetLab.NetworkScope = {
    AVAILABLE_CITIES: AVAILABLE_CITIES,
    DEFAULT_CITY: DEFAULT_CITY,
    sanitizeCity: sanitizeCity,
    cityName: cityName,
    migrateLegacyNetworkState: migrateLegacyNetworkState,
    getRouterCity: getRouterCity,
    getDeviceCity: getDeviceCity,
    getDeviceLocation: getDeviceLocation,
    findResponsibleRouter: findResponsibleRouter,
    detectLocalNetworks: detectLocalNetworks,
    hasValidLocalNetwork: hasValidLocalNetwork,
    findRouterConnections: findRouterConnections,
    classifyRouterLink: classifyRouterLink,
    detectMetropolitanLinks: detectMetropolitanLinks,
    detectWideAreaLinks: detectWideAreaLinks,
    classifyNetworkScope: classifyNetworkScope,
    findConnectionScope: findConnectionScope,
    routerPortKind: routerPortKind
  };
}());
