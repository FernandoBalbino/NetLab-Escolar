(function () {
  "use strict";

  var NetLab = window.NetLab = window.NetLab || {};

  function normalize(value) {
    var text = String(value || "").trim();
    if (!text) return "";
    var compact = text.replace(/[:-]/g, "");
    if (!/^[0-9a-fA-F]{12}$/.test(compact)) return "";
    return compact.toUpperCase().match(/.{2}/g).join(":");
  }

  function invalid(message) {
    return { valid: false, field: "macAddress", message: message };
  }

  function validate(value, takenAddresses) {
    var original = String(value || "").trim();
    if (!original) return invalid("Gere ou informe um endereço MAC para esta placa de rede.");
    var normalized = normalize(original);
    if (!normalized) return invalid("Use seis pares hexadecimais, como 02:1A:2B:3C:4D:5E.");
    if (normalized === "00:00:00:00:00:00") return invalid("O endereço MAC não pode ser formado apenas por zeros.");
    if (normalized === "FF:FF:FF:FF:FF:FF") return invalid("O endereço de broadcast não pode identificar um único computador.");
    if ((parseInt(normalized.slice(0, 2), 16) & 1) === 1) return invalid("Use um endereço MAC individual, não um endereço multicast.");
    var duplicate = (takenAddresses || []).some(function (address) { return normalize(address) === normalized; });
    if (duplicate) return invalid("Outro computador já está usando este endereço MAC. Gere um endereço diferente.");
    return { valid: true, value: normalized };
  }

  function randomByte() {
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      var value = new Uint8Array(1);
      window.crypto.getRandomValues(value);
      return value[0];
    }
    return Math.floor(Math.random() * 256);
  }

  function generate(takenAddresses) {
    var taken = (takenAddresses || []).map(normalize);
    var generated = "";
    do {
      var bytes = [randomByte(), randomByte(), randomByte(), randomByte(), randomByte(), randomByte()];
      bytes[0] = (bytes[0] & 252) | 2;
      generated = bytes.map(function (byte) { return byte.toString(16).padStart(2, "0").toUpperCase(); }).join(":");
    } while (taken.indexOf(generated) >= 0);
    return generated;
  }

  function sanitize(value) {
    var result = validate(value);
    return result.valid ? result.value : "";
  }

  function isMacChallenge(challenge) {
    return typeof challenge === "string" && challenge.indexOf("mac-") === 0;
  }

  NetLab.MacAddress = {
    normalize: normalize,
    validate: validate,
    generate: generate,
    sanitize: sanitize,
    isMacChallenge: isMacChallenge
  };
}());
