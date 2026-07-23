# NetLab Escolar

O **NetLab Escolar** é um simulador educativo de redes feito para alunos do ensino médio. Ele permite montar o caminho Internet → Roteador → Switch → PCs, instalar placas de rede, configurar IPv4, criar cabos e um barramento compartilhado, praticar redes básicas, LAN/MAN/WAN e cinco topologias, além de receber feedback sobre cada tentativa.

O projeto usa somente HTML5, CSS3 e JavaScript puro. Não há backend, banco de dados, bibliotecas externas ou etapa de compilação.

## Como abrir localmente

1. Abra a pasta do projeto.
2. Dê um duplo clique em `index.html`.

O projeto também pode ser servido por qualquer servidor HTTP estático, mas isso não é obrigatório. Todo o conteúdo utiliza caminhos relativos e funciona sem conexão com a internet.

O progresso, o projeto atual e as preferências ficam salvos no `localStorage` do navegador usado para abrir a aplicação.

## Estrutura

```text
NetLab-Escolar/
├── index.html
├── README.md
├── assets/
│   └── images/
│       ├── internet.png
│       ├── roteador.png
│       ├── pc.png
│       ├── switch.png
│       ├── placa-de-rede.png
│       └── porta-rj45.png
├── css/
│   ├── style.css
│   ├── workspace.css
│   └── responsive.css
└── js/
    ├── state.js
    ├── history.js
    ├── port-model.js
    ├── network-scope.js
    ├── storage.js
    ├── devices.js
    ├── connections.js
    ├── network-basics-validator.js
    ├── network-types-validator.js
    ├── topology-validator.js
    ├── challenges.js
    ├── communication-test.js
    ├── tutorial.js
    ├── workspace.js
    └── app.js
```

Os arquivos JavaScript são carregados com `defer` e registram suas funções no namespace único `window.NetLab`. Essa organização mantém as responsabilidades separadas e, ao mesmo tempo, permite abrir o projeto diretamente por `file://`.

## Imagens dos equipamentos

As imagens ficam em `assets/images/`:

- `pc.png`: imagem de cada computador.
- `switch.png`: imagem de cada switch.
- `roteador.png`: imagem dos roteadores.
- `internet.png`: imagem da fonte de Internet.
- `placa-de-rede.png`: imagem exibida no tutorial e no slot de expansão de cada computador.
- `porta-rj45.png`: entrada de rede com fundo transparente usada nas trilhas com portas físicas.

Cada computador novo começa sem placa de rede. Clique no slot quadrado do cartão do PC, escolha **Adicionar ao computador** e depois use a ferramenta de cabo. PCs sem placa não aceitam cabos, ligações ao barramento nem testes de comunicação.

Para substituí-las, mantenha os mesmos nomes de arquivo e prefira imagens PNG com fundo transparente. O CSS usa `object-fit: contain`, preservando a proporção sem esticar a imagem.

## Conectividade e status

A lógica fica em `js/connections.js`. A função `connectionRule` permite Internet ↔ Roteador, Roteador ↔ Switch, Roteador ↔ PC, Switch ↔ PC e Switch ↔ Switch. Conexões PC ↔ PC são permitidas nos desafios Anel e Malha e no Modo livre, mas continuam bloqueadas em Estrela, Barramento e Árvore. Internet ↔ PC, Internet ↔ Switch e outras combinações incompatíveis são bloqueadas com uma mensagem educativa.

A função `recalculateStatuses` monta o grafo da rede, encontra os roteadores ligados diretamente à Internet e executa uma busca em largura a partir deles. O resultado é recalculado depois de qualquer alteração:

- **Desconectado:** nenhum cabo ligado.
- **Sem internet:** existe ligação física, mas não há caminho até um roteador conectado à Internet.
- **Conectado:** o equipamento foi alcançado a partir de um roteador online.

Ao excluir um cabo ou equipamento, as ligações dependentes são removidas e os estados são atualizados automaticamente.

## Topologias e validação

- **Estrela:** exige um único switch central ligado diretamente a pelo menos três PCs. A infraestrutura externa segue `Internet → Roteador → Switch central`, sem transformar Internet ou roteador em pontas da estrela.
- **Barramento:** exige um único barramento, pelo menos três PCs ligados à linha principal e nenhum cabo direto.
- **Anel:** exige uma rede conectada em que cada equipamento tenha exatamente duas conexões.
- **Malha:** utiliza malha completa; com `n` equipamentos, exige `n × (n - 1) / 2` cabos.
- **Árvore:** exige rede conectada, sem ciclos, com switch raiz, switch secundário, ramificações e pelo menos dois níveis.

O arquivo `js/topology-validator.js` transforma equipamentos em vértices e cabos em arestas. Ele calcula conectividade, graus, ciclos e quantidade de ligações. O barramento é tratado como um vértice especial compartilhado.

Na estrela, a forma da LAN e o acesso à Internet são verificações separadas. Se todos os PCs estiverem ligados diretamente ao mesmo switch, a topologia continua válida mesmo sem Internet; os equipamentos apenas permanecem com o estado visual **Sem internet**. Quando os nós externos são usados, o roteador deve estar ligado ao switch central e a Internet deve estar ligada ao roteador.

O teste de comunicação usa busca em largura (BFS) para encontrar um caminho entre dois computadores e animar um pacote sobre os cabos encontrados.

## Trilhas de exercícios

Os exercícios ficam recolhidos em três módulos que podem ser abertos separadamente:

- **Redes básicas:** cinco etapas progressivas — conexão direta entre dois PCs, rede com switch, LAN com três PCs, roteador na borda e caminho completo até a Internet.
- **Tipos de redes:** cinco etapas para montar uma LAN, unir duas LANs de Maceió em uma MAN, transformar a MAN em WAN ao mover uma unidade para Arapiraca, conectar uma LAN à Internet e classificar três cenários prontos. Somente nessa trilha o roteador expõe 3 portas LAN + 1 WAN e o switch expõe 5 portas; cada cabo ocupa uma porta livre.
- **Topologias:** Estrela, Barramento, Anel, Malha e Árvore.

Na trilha de redes básicas, cada computador precisa de placa de rede, endereço IPv4 único e máscara compatível. A etapa só é concluída depois que o aluno executa **Testar comunicação** com sucesso e verifica o exercício. Alterar cabos ou configurações depois do teste invalida essa comprovação e exige um novo envio de pacote.

Na trilha de tipos de redes, cada roteador pode representar Maceió ou Arapiraca. Computadores e switches herdam a cidade do roteador responsável por sua LAN. O analisador em `js/network-scope.js` só reconhece MAN ou WAN geográfica quando existem LANs próprias válidas e conectadas; a Internet só representa WAN quando entra pela porta WAN de um roteador que possui uma LAN interna.

## Como criar um novo desafio

1. Adicione a definição do desafio ao objeto `definitions` e à lista `order` em `js/challenges.js`.
2. Crie a função de validação correspondente em `js/topology-validator.js`.
3. Registre a função no objeto `validators` do mesmo arquivo.
4. Inclua o identificador em `challengeIds`, dentro de `js/state.js`, para permitir persistência e importação.
5. Adicione o nome legível no objeto `topologyNames` de `js/app.js`.

Cada validador deve retornar:

```js
{
  valid: true,
  topology: "identificador",
  hints: [],
  details: {}
}
```

## Atalhos de teclado

| Atalho | Ação |
| --- | --- |
| `V` | Selecionar |
| `H` ou `Espaço` | Mover o espaço |
| `I` | Ferramenta Internet |
| `R` | Ferramenta roteador |
| `P` | Ferramenta computador |
| `S` | Ferramenta switch |
| `C` | Ferramenta cabo |
| `B` | Ferramenta barramento |
| `Delete` ou `Backspace` | Excluir selecionado |
| `Escape` | Cancelar ação atual |
| `Ctrl+Z` | Desfazer |
| `Ctrl+Shift+Z` ou `Ctrl+Y` | Refazer |
| `+` | Aproximar |
| `-` | Afastar |
| `0` | Ajustar à tela |

Os atalhos não são executados enquanto o aluno digita em um campo de texto.

## Exportar e importar

O botão **Exportar** gera `netlab-escolar-projeto.json`. O arquivo contém a versão do formato, o projeto e o progresso. A importação valida IDs, tipos, limites, referências dos cabos e anexos do barramento antes de substituir a rede atual.

## Publicar no GitHub Pages

1. Envie todos os arquivos desta pasta para um repositório no GitHub.
2. Abra **Settings** no repositório.
3. No menu lateral, abra **Pages**.
4. Em **Build and deployment**, selecione **Deploy from a branch**.
5. Escolha a branch **main** e a pasta **/root**.
6. Clique em **Save** e aguarde a publicação.

## Instalação e uso offline

O NetLab Escolar é uma PWA instalável. Depois do primeiro acesso completo pelo GitHub Pages, o Service Worker salva localmente a interface, scripts, estilos e todas as imagens usadas pelo laboratório.

No Chrome ou Chromebook, abra o site e use o ícone **Instalar** na barra de endereço. Depois da instalação, o laboratório abre sem internet e mantém projetos, progresso e preferências no `localStorage` do dispositivo.

O cache atual é `netlab-offline-v6`. Ao alterar recursos do projeto, incremente `CACHE_VERSION` em `service-worker.js`; caches antigos são apagados automaticamente na ativação da nova versão.

Não altere os caminhos relativos nem mova o `index.html` para fora da raiz publicada.
