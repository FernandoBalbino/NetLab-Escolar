"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "precache-manifest.json"), "utf8"));

test("todos os recursos do precache existem localmente", () => {
  manifest.forEach((entry) => {
    assert.equal(fs.existsSync(path.join(root, entry.replace(/^\.\//, ""))), true, `recurso ausente: ${entry}`);
  });
});

test("a nova trilha, a análise geográfica e o ícone das portas funcionam offline", () => {
  ["./js/port-model.js", "./js/network-scope.js", "./js/network-types-validator.js", "./assets/images/porta-rj45.png"].forEach((entry) => {
    assert.equal(manifest.includes(entry), true, `faltou no precache: ${entry}`);
  });
});
