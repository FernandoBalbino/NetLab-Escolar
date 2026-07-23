# Design QA — trilha Tipos de redes e portas físicas

- Referência visual principal: `C:\Users\Fernando\AppData\Local\Temp\codex-clipboard-af0cfc21-456a-4aec-8743-f4fb35eee8c5.png`
- Referência física: `C:\Users\Fernando\AppData\Local\Temp\codex-clipboard-036fe61e-de93-4f84-9840-d2bbce4c16e9.png`
- Implementação completa: `C:\Users\Fernando\Desktop\netlab\qa-artifacts\types-ports-router-switch.png`
- Implementação focada: `C:\Users\Fernando\Desktop\netlab\qa-artifacts\types-ports-router-only.png`
- Comparação lado a lado: `C:\Users\Fernando\Desktop\netlab\qa-artifacts\types-ports-comparison.png`
- Viewport de inspeção: 1280 × 720
- Estado: desktop, trilha Tipos de redes ativa

## Comparação visual

A comparação focada coloca a marcação do usuário e a implementação no mesmo quadro. A coluna de portas ocupa a lateral direita indicada, sem alterar o cartão do roteador. A imagem RJ45 possui transparência real, mantém leitura em tamanho reduzido e é acompanhada por rótulos WAN, L1, L2 e L3. No switch, cinco entradas cabem em uma coluna compacta com rótulos de 1 a 5.

## Findings

- Nenhuma divergência visual P0, P1 ou P2 encontrada.
- O trilho de portas não cobre nome, status ou imagem dos equipamentos.
- WAN usa tratamento azul; LAN usa tratamento âmbar; porta ocupada recebe estado cinza.
- Tipografia, sombras, bordas e raios reaproveitam a linguagem visual existente.
- O trilho aparece somente na nova trilha; no Modo livre, o roteador manteve os quatro pontos de conexão genéricos e não mostrou portas físicas.

## Interação e runtime

- O roteador expôs 1 WAN + 3 LAN.
- O switch expôs 5 portas.
- Um cabo criado pela LAN 1 ocupou a porta e terminou visualmente no trilho.
- Portas ocupadas não podem ser reutilizadas.
- A Internet só pode entrar pela WAN; computadores e switches usam LAN.
- Conexões WAN ↔ WAN e LAN ↔ WAN entre roteadores são aceitas somente nesta trilha.
- O Service Worker informou que o laboratório estava preparado para uso offline.
- Console do navegador: nenhum erro.
- Testes automatizados: 31 aprovados após o ajuste final de acessibilidade.

## Checklist

- [x] Criar imagem RJ45 sem fundo.
- [x] Posicionar portas ao lado do roteador.
- [x] Aplicar 3 LAN + 1 WAN no roteador.
- [x] Aplicar 5 portas no switch.
- [x] Isolar a mecânica na trilha Tipos de redes.
- [x] Criar cinco exercícios progressivos de LAN, MAN e WAN.
- [x] Incluir scripts e imagem no cache offline.
- [x] Verificar referência e implementação lado a lado.

final result: passed
