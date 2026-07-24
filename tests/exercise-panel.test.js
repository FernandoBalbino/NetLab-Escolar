"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "precache-manifest.json"), "utf8"));

test("mantém os equipamentos e o desafio atual dentro do sidebar", () => {
  const sidebar = html.match(/<aside id="sidebar"[\s\S]*?<\/aside>/);
  assert.ok(sidebar, "sidebar não encontrado");
  assert.match(sidebar[0], /id="equipment-title">Equipamentos/);
  assert.match(sidebar[0], /id="active-challenge"/);
  assert.doesNotMatch(sidebar[0], /Trilhas de exercícios|learning-modules|progress-list/);
});

test("abre as trilhas em um painel independente e acessível", () => {
  const panel = html.match(/<aside id="exercise-panel"[\s\S]*?<\/aside>/);
  assert.ok(panel, "painel de exercícios não encontrado");
  assert.match(panel[0], /id="learning-modules"/);
  assert.doesNotMatch(panel[0], /id="active-challenge"/);
  assert.match(panel[0], /id="progress-list"/);
  assert.match(html, /id="exercise-panel-toggle"[^>]+aria-controls="exercise-panel"/);
  assert.match(app, /function setExercisePanel\(open, restoreFocus\)/);
  assert.match(app, /event\.key === "Escape" && exercisePanelOpen/);
});

test("abre os exercícios em uma camada sobreposta com retorno destacado", () => {
  assert.match(html, /id="exercise-module-popup"[^>]+role="dialog"/);
  assert.match(html, /id="exercise-module-back"[\s\S]*?Voltar para trilhas/);
  assert.match(html, /data-challenge-module="basics"[^>]+aria-haspopup="dialog"/);
  assert.match(html, /data-challenge-module="mac"[^>]+aria-controls="mac-challenge-list"/);
  assert.match(html, /id="exercise-module-popup"[\s\S]*id="basics-challenge-list"[\s\S]*id="types-challenge-list"[\s\S]*id="mac-challenge-list"[\s\S]*id="topologies-challenge-list"/);
  assert.match(app, /function openExerciseModule\(moduleId\)/);
  assert.match(app, /function closeExerciseModulePopup\(restoreFocus\)/);
  assert.match(app, /overview\.inert = Boolean\(selectedModule\)/);
  assert.match(app, /event\.key === "Escape" && activeExerciseModule/);
});

test("não revela a classificação automática durante o exercício de identificação", () => {
  const sandbox = {
    window: {
      NetLab: {
        Challenges: {
          moduleFor(challenge) {
            return challenge.startsWith("types-") ? "types" : "topologies";
          }
        }
      }
    },
    document: { addEventListener() {} }
  };
  vm.runInNewContext(app, sandbox);

  const shouldShow = sandbox.window.NetLab.App.shouldShowNetworkAnalysis;
  assert.equal(shouldShow("types-man-link"), true);
  assert.equal(shouldShow("types-complete"), false);
  assert.equal(shouldShow("star"), false);
});

test("mantém os ícones do painel disponíveis offline", () => {
  ["./assets/icons/book-open.svg", "./assets/icons/x.svg"].forEach((entry) => {
    assert.equal(manifest.includes(entry), true, `faltou no precache: ${entry}`);
    assert.equal(fs.existsSync(path.join(root, entry.replace(/^\.\//, ""))), true, `recurso ausente: ${entry}`);
  });
});
