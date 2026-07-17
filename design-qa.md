# Design QA — comunicação IPv4 entre sub-redes

## Evidências

- Fonte visual do cenário: `C:\Users\fernando\AppData\Local\Temp\codex-clipboard-afad8d01-8eaa-40ca-acc5-4be9d24ade86.png`
- Fonte visual da regra didática: `C:\Users\fernando\AppData\Local\Temp\codex-clipboard-af96e0bf-792b-4b37-8d6d-78314f079718.png`
- Implementação, animação de falha: `C:\Users\fernando\.codex\visualizations\2026\07\17\019f70f3-779d-7b83-a499-3ca0e4ffb21b\communication-red-animation.png`
- Implementação, mensagem de falha: `C:\Users\fernando\.codex\visualizations\2026\07\17\019f70f3-779d-7b83-a499-3ca0e4ffb21b\communication-subnet-failure.png`
- Implementação, animação de sucesso: `C:\Users\fernando\.codex\visualizations\2026\07\17\019f70f3-779d-7b83-a499-3ca0e4ffb21b\communication-blue-animation.png`
- Implementação, mensagem de sucesso: `C:\Users\fernando\.codex\visualizations\2026\07\17\019f70f3-779d-7b83-a499-3ca0e4ffb21b\communication-same-subnet-success.png`
- Comparação conjunta: `C:\Users\fernando\.codex\visualizations\2026\07\17\019f70f3-779d-7b83-a499-3ca0e4ffb21b\design-qa-communication-comparison.png`
- URL local: `http://127.0.0.1:4173/`
- Viewport: 1280 × 720, tema claro, zoom do laboratório em 100%.
- Estado de falha: PC-3 em `192.168.1.100/24`, PC-4 em `192.168.2.101/24`, ambos ligados ao mesmo switch; roteador e Internet presentes no desenho.
- Estado de sucesso: PC-3 em `192.168.1.100/24`, PC-4 em `192.168.1.101/24`, ambos ligados ao mesmo switch.

## Comparação da visão completa

A implementação mantém a composição, os equipamentos, os cabos e os controles do NetLab. No cenário de sub-redes diferentes, o pacote percorre lentamente o caminho físico do PC-3 até o PC-4 enquanto o cabo ativo e o pacote ficam vermelhos. O roteador e a Internet presentes no desenho não alteram o resultado porque ainda não existem interfaces e rotas configuráveis no simulador.

## Comparação das regiões focadas

A comparação conjunta avalia o cenário IPv4, a animação vermelha e o feedback final. A mensagem implementada informa as duas redes calculadas (`192.168.1.0/24` e `192.168.2.0/24`) e explica que seria necessário um roteador configurado. A animação de sucesso permanece azul e a mensagem confirma a rede compartilhada.

## Superfícies de fidelidade

- Fontes e tipografia: família, pesos, tamanhos, hierarquia e legibilidade seguem os componentes de feedback já existentes no NetLab.
- Espaçamento e ritmo: o feedback mantém padding, raio, alinhamento e posição; a animação não desloca equipamentos nem altera o layout.
- Cores e tokens: azul continua representando entrega; vermelho `#dc2626` representa falha e possui contraste e brilho suficientes sobre o fundo e os cabos cinza.
- Qualidade de imagem e ativos: imagens originais dos equipamentos permanecem nítidas e nenhuma aproximação visual ou novo ativo foi introduzido.
- Cópia e conteúdo: a mensagem usa os nomes reais dos PCs, redes calculadas a partir do IP e da máscara e explicação adequada para aula introdutória.

## Interações verificadas

- Importar cenário com dois PCs, switch, roteador e Internet.
- Testar `192.168.1.100/24` contra `192.168.2.101/24` e observar animação vermelha de aproximadamente dois segundos.
- Confirmar feedback “Falha na comunicação” com as duas redes e a necessidade de roteamento.
- Alterar o PC-4 para `192.168.1.101/24`.
- Repetir o teste e observar animação azul e feedback “Pacote entregue!”.
- Confirmar que a Internet conectada não interfere na decisão entre os PCs.
- Verificar erros e avisos do navegador: nenhum encontrado.

## Achados

Nenhum problema acionável P0, P1 ou P2 foi encontrado.

## Histórico de comparação

- Passo 1: cenário, animação, cores e feedback foram comparados em uma única prancha; nenhuma diferença P0/P1/P2 foi encontrada e nenhuma correção visual adicional foi necessária.

## Checklist de implementação

- [x] Comunicação depende do caminho físico e da sub-rede IPv4.
- [x] PCs sem IPv4 configurado recebem orientação para configurar os endereços.
- [x] Máscaras ou redes diferentes bloqueiam a entrega.
- [x] Caminhos que dependem de roteador sem configuração são bloqueados.
- [x] Falha percorre o caminho em vermelho.
- [x] Sucesso percorre o caminho em azul.
- [x] Animação desacelerada para 1 segundo por cabo.
- [x] Feedback didático mostra as redes calculadas.

final result: passed
