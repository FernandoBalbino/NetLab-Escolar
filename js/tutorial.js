(function () {
  "use strict";

  var NetLab = window.NetLab = window.NetLab || {};
  var index = 0;
  var elements = {};
  var steps = [
    { title: "Comece pela Internet", text: "Adicione a Internet e um Roteador. A Internet só pode ser ligada diretamente ao Roteador.", image: "./assets/images/internet.png", alt: "Símbolo da Internet" },
    { title: "Distribua a conexão", text: "Ligue o Roteador ao Switch e o Switch aos computadores. Os status mudam automaticamente.", image: "./assets/images/roteador.png", alt: "Roteador usado no simulador" },
    { title: "Instale a placa de rede", text: "Cada computador começa com um slot vazio. Clique no quadrado, adicione a placa de rede e só então conecte os cabos.", image: "./assets/images/placa-de-rede.png", alt: "Placa de rede instalada nos computadores" },
    { title: "Observe os três estados", text: "Desconectado significa sem cabo; Sem internet é uma rede local sem caminho ativo; Conectado indica acesso via Roteador.", image: "./assets/images/switch.png", alt: "Switch de rede" }
  ];

  function render() {
    var step = steps[index];
    elements.number.textContent = String(index + 1);
    elements.progress.textContent = "Etapa " + (index + 1) + " de " + steps.length;
    elements.title.textContent = step.title;
    elements.text.textContent = step.text;
    elements.image.src = step.image;
    elements.image.alt = step.alt;
    elements.next.textContent = index === steps.length - 1 ? "Começar" : "Próxima";
  }

  function close() {
    NetLab.State.data.preferences.tutorialSeen = true;
    if (elements.hide.checked) NetLab.State.data.preferences.tutorialHidden = true;
    NetLab.Storage.saveNow();
    elements.modal.hidden = true;
    document.getElementById("workspace").focus();
  }

  function next() {
    if (index >= steps.length - 1) { close(); return; }
    index += 1;
    render();
  }

  function open() {
    index = 0;
    render();
    elements.modal.hidden = false;
    window.setTimeout(function () { elements.next.focus(); }, 0);
  }

  function init() {
    elements = {
      modal: document.getElementById("tutorial-modal"),
      number: document.getElementById("tutorial-number"),
      progress: document.getElementById("tutorial-progress"),
      title: document.getElementById("tutorial-title"),
      text: document.getElementById("tutorial-text"),
      image: document.getElementById("tutorial-image"),
      hide: document.getElementById("tutorial-hide"),
      next: document.getElementById("tutorial-next"),
      skip: document.getElementById("tutorial-skip")
    };
    elements.next.addEventListener("click", next);
    elements.skip.addEventListener("click", close);
    if (!NetLab.State.data.preferences.tutorialSeen && !NetLab.State.data.preferences.tutorialHidden) open();
  }

  NetLab.Tutorial = { init: init, open: open, close: close };
}());
