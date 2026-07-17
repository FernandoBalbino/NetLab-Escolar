(function () {
  "use strict";

  var NetLab = window.NetLab = window.NetLab || {};
  var DEFAULT_MASK = "255.255.255.0";

  function defaultConfiguration() {
    return { address: "", mask: DEFAULT_MASK, gateway: "" };
  }

  function parseAddress(value) {
    var text = String(value || "").trim();
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(text)) return null;
    var octets = text.split(".").map(Number);
    if (octets.some(function (octet) { return octet < 0 || octet > 255; })) return null;
    return {
      text: octets.join("."),
      octets: octets,
      number: (((octets[0] << 24) >>> 0) + (octets[1] << 16) + (octets[2] << 8) + octets[3]) >>> 0
    };
  }

  function isUnicast(address) {
    return Boolean(address && address.octets[0] > 0 && address.octets[0] < 224 && address.octets[0] !== 127);
  }

  function parseMask(value) {
    var mask = parseAddress(value);
    if (!mask || mask.number === 0 || mask.number === 0xffffffff) return null;
    var inverse = (~mask.number) >>> 0;
    if ((inverse & ((inverse + 1) >>> 0)) !== 0) return null;
    var prefix = 32;
    var remaining = inverse;
    while (remaining) { prefix -= 1; remaining >>>= 1; }
    mask.prefix = prefix;
    mask.inverse = inverse;
    return mask;
  }

  function isUsableHost(address, mask) {
    if (!isUnicast(address) || !mask) return false;
    var host = address.number & mask.inverse;
    return host !== 0 && host !== mask.inverse;
  }

  function sameSubnet(first, second, mask) {
    return ((first.number & mask.number) >>> 0) === ((second.number & mask.number) >>> 0);
  }

  function numberToAddress(number) {
    var value = number >>> 0;
    return [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join(".");
  }

  function networkDetails(configuration) {
    var source = configuration || {};
    var address = parseAddress(source.address);
    var mask = parseMask(source.mask);
    if (!address || !mask || !isUsableHost(address, mask)) return null;
    var networkNumber = (address.number & mask.number) >>> 0;
    return {
      address: address.text,
      mask: mask.text,
      prefix: mask.prefix,
      network: numberToAddress(networkNumber),
      label: numberToAddress(networkNumber) + "/" + mask.prefix,
      networkNumber: networkNumber,
      maskNumber: mask.number
    };
  }

  function compareNetworks(firstConfiguration, secondConfiguration) {
    var first = networkDetails(firstConfiguration);
    var second = networkDetails(secondConfiguration);
    if (!first || !second) {
      return {
        compatible: false,
        reason: !first && !second ? "missing-both" : !first ? "missing-first" : "missing-second",
        first: first,
        second: second
      };
    }
    var sameMask = first.maskNumber === second.maskNumber;
    var sameNetwork = first.networkNumber === second.networkNumber;
    return {
      compatible: sameMask && sameNetwork,
      reason: !sameMask ? "different-masks" : !sameNetwork ? "different-networks" : "same-network",
      first: first,
      second: second
    };
  }

  function invalid(field, message) {
    return { valid: false, field: field, message: message };
  }

  function validate(configuration, takenAddresses) {
    var source = configuration || {};
    var address = parseAddress(source.address);
    var mask = parseMask(source.mask);
    var gatewayText = String(source.gateway || "").trim();
    var gateway = gatewayText ? parseAddress(gatewayText) : null;

    if (!address || !isUnicast(address)) return invalid("address", "Informe um endereço IPv4 válido para o computador.");
    if (!mask) return invalid("mask", "Use uma máscara válida, formada por bits contínuos, como 255.255.255.0.");
    if (!isUsableHost(address, mask)) return invalid("address", "Este endereço representa a rede ou o broadcast. Escolha um endereço de host.");
    if ((takenAddresses || []).some(function (item) { return parseAddress(item) && parseAddress(item).text === address.text; })) {
      return invalid("address", "Outro computador já está usando este endereço IPv4.");
    }
    if (gatewayText && (!gateway || !isUsableHost(gateway, mask))) return invalid("gateway", "Informe um gateway IPv4 válido ou deixe o campo vazio.");
    if (gateway && !sameSubnet(address, gateway, mask)) return invalid("gateway", "O gateway deve pertencer à mesma sub-rede deste computador.");

    return {
      valid: true,
      prefix: mask.prefix,
      value: { address: address.text, mask: mask.text, gateway: gateway ? gateway.text : "" }
    };
  }

  function sanitize(configuration) {
    if (!configuration || typeof configuration !== "object") return defaultConfiguration();
    var address = parseAddress(configuration.address);
    var mask = parseMask(configuration.mask) || parseMask(DEFAULT_MASK);
    var gateway = parseAddress(configuration.gateway);
    if (!address || !isUsableHost(address, mask)) address = null;
    if (!gateway || !address || !isUsableHost(gateway, mask) || !sameSubnet(address, gateway, mask)) gateway = null;
    return { address: address ? address.text : "", mask: mask.text, gateway: gateway ? gateway.text : "" };
  }

  NetLab.IPv4 = {
    DEFAULT_MASK: DEFAULT_MASK,
    defaultConfiguration: defaultConfiguration,
    parseAddress: parseAddress,
    parseMask: parseMask,
    networkDetails: networkDetails,
    compareNetworks: compareNetworks,
    validate: validate,
    sanitize: sanitize
  };
}());
