# Design QA — painel de trilhas fora do sidebar

- Fonte visual: `C:\Users\Fernando\AppData\Local\Temp\codex-clipboard-20c71154-9363-4389-a3c6-04e92d7e26b9.png`
- Implementação final aberta: `C:\Users\Fernando\Desktop\netlab\qa-artifacts\exercise-panel-open-final.png`
- Implementação final fechada: `C:\Users\Fernando\Desktop\netlab\qa-artifacts\sidebar-equipment-only-final.png`
- Comparação completa: `C:\Users\Fernando\Desktop\netlab\qa-artifacts\design-comparison-full.png` (referência à esquerda, implementação à direita)
- Comparação focada: `C:\Users\Fernando\Desktop\netlab\qa-artifacts\design-comparison-panel.png` (região direita de 600 × 870 px de cada captura)
- Evidência móvel: `C:\Users\Fernando\Desktop\netlab\qa-artifacts\mobile-equipment-sidebar-final.png` e `C:\Users\Fernando\Desktop\netlab\qa-artifacts\mobile-exercise-panel-final.png`
- Viewport desktop: 1696 × 929 CSS px, densidade solicitada 1x
- Pixels recebidos: referência 1693 × 929; implementação 1664 × 929 pelo recorte da superfície interna do navegador
- Normalização: as duas capturas completas foram ajustadas para 836 × 458 antes da composição; a comparação focada recorta os 600 px finais de cada imagem sem alterar sua escala vertical
- Estado comparado: desktop claro, sidebar aberto, painel de trilhas aberto; o canvas da referência contém uma rede e o canvas da implementação está vazio, diferença de dados excluída da avaliação do componente

## Findings

- Nenhuma divergência P0, P1 ou P2 permanece.
- Tipografia: a implementação mantém Inter/Arial/system, pesos e hierarquia já usados no NetLab. Título, eyebrow, rótulos, descrições e ações têm leitura equivalente à referência, sem truncamento no painel.
- Espaçamento e layout: o sidebar ficou restrito aos quatro equipamentos; botão circular e painel ocupam a mesma região direita da referência; largura, raios, bordas, sombras e ritmo dos cards são coerentes. O painel fica mais alto porque preserva as três trilhas reais do produto.
- Cores e tokens: azul primário, superfícies brancas, fundo pontilhado e cinzas reaproveitam os tokens existentes; estados ativo, desabilitado e foco continuam distinguíveis.
- Imagens e ícones: os equipamentos reutilizam os PNGs existentes. Livro e fechar usam arquivos vetoriais reais em `assets/icons/`, sem placeholders, emojis ou desenhos em CSS.
- Copy e conteúdo: nomes, descrições, contagens e ações reais do NetLab foram preservados. A anotação azul com seta da referência foi tratada como orientação da imagem, não como texto permanente da interface. A terceira trilha, inexistente no recorte de referência, foi mantida por ser funcionalidade existente.
- A comparação focada foi necessária porque tipografia, ícones, cards e controles do painel ficam pequenos na comparação completa.

## Histórico de comparação

### Iteração 1 — bloqueada

- [P2] O tooltip do launcher permanecia visível após o clique e cobria parte do cabeçalho do painel. Evidência: `qa-artifacts/design-comparison-pass1.png`.
- [P2] No breakpoint de 390 × 844, o sidebar herdava 520 px de altura e deixava espaço vazio excessivo depois da remoção das trilhas. Evidência: lado esquerdo de `qa-artifacts/mobile-sidebar-height-comparison.png`.

Correções aplicadas:

- O tooltip é ocultado enquanto o painel está aberto.
- A folha móvel do sidebar passou a usar `min(52vh, 440px)`.

Evidência pós-correção:

- `qa-artifacts/design-comparison-full.png` e `qa-artifacts/design-comparison-panel.png` mostram o painel sem sobreposição.
- O lado direito de `qa-artifacts/mobile-sidebar-height-comparison.png` mostra o sidebar móvel mais compacto e sem perda de cards.

### Iteração final — aprovada

- Nenhum P0, P1 ou P2 foi encontrado na repetição da comparação completa e focada.
- P3 aceitável: o painel começa mais próximo do launcher do que na referência, pois a implementação não inclui a seta e o texto explicativo temporário da imagem.

## Interações, responsividade e runtime

- Abrir pelo livro, fechar pelo X, fechar com Escape e fechar ao clicar fora: aprovados.
- Abrir um módulo em camada sobreposta, voltar para as trilhas e abrir o progresso detalhado: aprovados.
- Sidebar móvel fecha automaticamente ao abrir as trilhas: aprovado.
- Inspetor do equipamento selecionado aparece como cartão contextual sobre o canvas: aprovado.
- Desktop 1696 × 929: sem overflow do documento.
- Mobile 390 × 844: sidebar 374 × 438,875; painel 374 × 720 com rolagem interna; sem overflow do documento.
- Console do navegador nas capturas finais: nenhum erro ou warning.
- Trilha MAC: geração aleatória, bloqueio sem MAC, conflito duplicado, entrega do quadro e identificação do destino aprovados em desktop e mobile.
- Testes automatizados: 58 aprovados, incluindo a trilha MAC e a garantia de que o exercício de classificação não exibe a leitura automática.

## Implementation Checklist

- [x] Manter equipamentos e desafio atual no sidebar.
- [x] Adicionar launcher circular com ícone de livro.
- [x] Mover trilhas, análise e progresso para o painel flutuante.
- [x] Preservar o inspetor como cartão contextual fora do sidebar.
- [x] Implementar estados aberto/fechado, Escape, clique externo e responsividade.
- [x] Incluir ícones no precache offline.
- [x] Comparar referência e implementação no mesmo quadro.
- [x] Validar desktop, mobile, console e testes.

final result: passed
