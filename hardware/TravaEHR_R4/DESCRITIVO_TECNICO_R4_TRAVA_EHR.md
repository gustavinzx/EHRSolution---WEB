# Descritivo técnico: revisão R4 do esquema elétrico ALFA (Trava EHR)

**Projeto:** Trava eletrônica de abastecimento para tanque de caminhão (EHR)
**Documento de origem:** `R3 FLUXOGRAMA COMUNICAÇÃOLORA E SISTEMA DE BLOQUEIO EHRdwg.dwg` (REV. 03, 21/10/2026)
**Documento resultante:** `R4 FLUXOGRAMA COMUNICACAO LORA E SISTEMA DE BLOQUEIO EHR.dwg` (REV. 04)
**Data:** 23/10/2026
**Escopo:** auditoria completa do R3, todas as correções a aplicar no AutoCAD, lista de materiais, lista de ligações ponto a ponto, requisitos de firmware e roteiro de comissionamento.

---

## Sumário

0. Como usar este documento e arquivos entregues
1. Resumo das mudanças R3 → R4
2. Premissas de projeto (confirmar antes de montar)
3. Auditoria do R3: todas as não conformidades encontradas
4. Arquitetura elétrica da R4
5. Passo a passo no AutoCAD
6. Pinagem final do ESP32
7. Lista de ligações ponto a ponto (para montagem)
8. Lista de materiais R4 e o que ainda falta comprar
9. Montagem física e preparação dos módulos
10. Requisitos do firmware v2.0
11. Comissionamento passo a passo
12. Pendências e riscos para o protótipo Beta
- Anexo A: memória de cálculo
- Anexo B: coordenadas de referência do desenho

---

## 0. Como usar este documento e arquivos entregues

Faça na ordem: **seção 2** (confirmar as premissas), **seção 5** (corrigir o desenho), **seção 8** (comprar o que falta), **seções 7 e 9** (montar) e **seção 11** (comissionar).

Arquivos na pasta `PROTOTIPO ALFA\FLUXOGRAMA\ALFA R4`:

| Arquivo | O que é |
|---|---|
| `R4 FLUXOGRAMA COMUNICACAO LORA E SISTEMA DE BLOQUEIO EHR.dwg` | Cópia idêntica do R3, já renomeada. **É nela que as correções são feitas.** O R3 original não é alterado. |
| `R4_BLOCOS_NOVOS.dxf` | Blocos já redesenhados, nas **coordenadas absolutas do seu desenho**, com os mesmos nomes de layer. Basta apagar o que é indicado e colar no ponto 0,0. |
| `R4_PREVIA_MONTAGEM.png` | Prévia do R3 com os blocos novos sobrepostos. Mostra onde cada coisa entra. Os textos que mudam por "localizar e substituir" ainda aparecem com o conteúdo antigo. |
| `gera_blocos_r4.py` | Script que gera o DXF acima (mesmo padrão do `generate_cad_diagram.py`). Use se quiser ajustar algo e gerar de novo. |
| `EHR_DUMP.lsp` | Rotina auxiliar que não é mais necessária. Pode apagar. |

> **Convenção do desenho:** cruzamento de fios **sem ponto** de junção = sem conexão. Rótulos de rede com o **mesmo nome** (ex.: `G27`, `V_SOL`, `KL15`) = mesmo nó elétrico. Escreva isso nas notas, porque o R3 usa muitas ligações por rótulo.

---

## 1. Resumo das mudanças R3 → R4

| # | Área | R3 (como está) | R4 (como fica) | Motivo |
|---|---|---|---|---|
| 1 | Atuador | Motor DC TT + "ponte H" D4184 + trava radial de 3 palhetas | **2 mini travas solenoide 12 V fail-secure**, uma chave MOSFET D4184 para cada | Mudança de rota do protótipo alfa |
| 2 | Alimentação VR1 | Entrada IN+ do VR1 ligada **direto no KL30**, antes do fusível, do TVS e do diodo | VR1 e VR2 alimentados pelo **+24V_PROT** | Hoje a eletrônica está sem proteção nenhuma |
| 3 | Conversor 5 V | "LM2596 HV / MP1584", e o módulo comprado é de 10–28 V | **LM2596HV** (entrada até 60 V) + dissipador | 28 V é a tensão normal de carga de um caminhão 24 V |
| 4 | Alimentação solenoides | Não existia | **VR2** LM2596HV ajustado em 12,0 V → rede `V_SOL` | Bobina 12 V em sistema 24 V |
| 5 | Barramento SPI/I2C | Três pares de fios desenhados **sobrepostos** (curto no desenho) | Colunas de roteamento separadas | MISO×SD_CS, SCK×3V3, LORA_NSS×SDA |
| 6 | Monitor de bateria | Divisor 100k/10k + zener **invertido** e componentes desconectados | Divisor 150k/10k + 100 nF + clamp BAT43 | O zener invertido grampeava a leitura em ~0,7 V |
| 7 | KL15 | Borne 2 sem uso | KL15 vira **sinal de ignição** (divisor → G39) | Saber se o caminhão está ligado e economizar bateria |
| 8 | GSM | SIM800L em ~4,1 V por diodo Schottky (D3) | Placa **SIM800L V2.0** (a comprada) direto em 5 V; D3 removido | O módulo comprado tem regulador próprio e é alimentado em 5 V |
| 9 | Fins de curso | "Travado/Destravado" da trava radial, pull-up 10k, desenho com fios interrompidos | Um sensor por lingueta (SW1/SW2), pull-up 4k7, série 1k, 100 nF | Realimentação real de cada trava; imunidade a ruído no cabo |
| 10 | Pinos ESP32 | G2 = LORA_RST, G14 = PWM, G25/G26 "abrir/fechar" | G2 = LED, **G27 = LORA_RST**, G14 livre, G25/G26 = TRIG das travas | Pinos de boot (strapping) e nova lógica de acionamento |
| 11 | LoRa | "SX1276 / RA-02 915 MHz" (o Ra-02 é SX1278 433 MHz) | **Ra-01H ou RFM95W (SX1276)** 915–928 MHz; pinos DIO0 e RESET desenhados | Faixa de frequência correta |
| 12 | BOM | 22 itens, com erros | 32 itens revisados + notas de revisão | — |

---

## 2. Premissas de projeto (confirmar antes de montar)

A R4 foi desenhada sobre as premissas abaixo. **Se alguma não se confirmar, veja a coluna "se não for"**.

| # | Premissa | Como confirmar | Se não for |
|---|---|---|---|
| P1 | Mini trava solenoide de **12 V**, **fail-secure** (lingueta estendida sem energia, recolhe energizada), corrente ≤ 1 A | Anúncio/etiqueta. Teste: sem energia a lingueta fica para fora; com 12 V ela recolhe | **Bobina 24 V:** não montar VR2; ligar `V_SOL` direto no `+24V_PROT`. **Fail-safe** (abre sem energia): não serve para trava antifurto, trocar o modelo |
| P2 | Lingueta **chanfrada** (trava sozinha ao fechar a tampa, sem energia) | Olhar a peça | Lingueta reta exige energizar para fechar: muda a lógica do firmware (seção 10) |
| P3 | Caminhão **24 V** | — | **12 V:** F1 passa para 5 A, D2 para SB540 (5 A). O resto funciona igual |
| P4 | SIM800L comprado é a placa **"SIM800L V2.0 / EVB 5V"** (pinos 5V, GND, VDD, SIM_TXD, SIM_RXD, GND, RST) | Serigrafia da placa | **Módulo vermelho pequeno** (pinos VCC, RST, RXD, TXD): ver variante B na seção 5.5 |
| P5 | Módulo LoRa comprado é **SX1276** (Ra-01H, RFM95W, "LoRa 915 MHz SX1276") com interface SPI | Serigrafia do módulo. O chip deve ser SX1276 | **Ra-02 (SX1278):** é 433 MHz, trocar. **Ebyte E32/E220 (UART):** a ligação muda toda (M0/M1/AUX/TX/RX) |
| P6 | Placa ESP32 com WROOM-32 (30 ou 38 pinos) | Contar pinos | O desenho é **lógico**: os GPIO valem para as duas versões; só a posição física muda |
| P7 | Existe um **receptor LoRa** (gateway ou base) do outro lado | — | Sem receptor, o LoRa não tem função no alfa; GSM/SMS e Wi-Fi fazem o papel |

---

## 3. Auditoria do R3: todas as não conformidades encontradas

Classificação: **B** = bloqueante (danifica, não funciona ou é inseguro), **I** = importante (falha intermitente, confiabilidade), **D** = documentação.

| ID | Classe | Local no R3 | Problema | Correção R4 (seção) |
|---|---|---|---|---|
| A01 | **B** | Bloco 1/2: fio vertical em X=35 | A entrada **IN+ do VR1 sai da borda do J1, no KL30 bruto**, antes de F1, D1 e D2. A eletrônica inteira fica sem fusível, sem TVS e sem proteção de polaridade. O `+24V_PROT` não alimenta nada | Religar o VR1 no `+24V_PROT` (5.4) |
| A02 | **B** | Bloco 2 | Conversor 5 V especificado "LM2596 HV / MP1584 9–36 V". O MP1584 aguenta só 28 V e o módulo comprado é de **10–28 V / 2 A**. O caminhão 24 V carrega a 27,6–28,8 V e tem transientes acima | LM2596HV (até 60 V), 3 A, com dissipador (5.4) |
| A03 | **B** | Barramento à direita do ESP32, coluna X=620 | Vertical do **SD_CS** (vindo do G13) **sobreposta** à vertical do **MISO** entre Y=500 e 545: curto no desenho | Nova coluna X=595 para SD_CS (5.8) |
| A04 | **B** | Coluna X=625 | Vertical do **SCK** sobreposta à vertical do **3V3** entre Y=530 e 680: curto 3V3–SCK no desenho | Nova coluna X=630 para SCK (5.8) |
| A05 | **B** | Coluna X=610 | Vertical do **LORA_NSS** (G5) sobreposta à do **SDA** (G21) entre Y=549 e 627 | Nova coluna X=600 para NSS (5.8) |
| A06 | **B** | Bloco 3 | **DZ1 desenhado invertido** (anodo no sinal, catodo no GND): conduz direto e prende o ADC em ~0,7 V. Além disso o zener de 3,3 V vaza bem antes de 3,3 V com 100k em série | Clamp com 2× BAT43 ao 3V3 e ao GND (5.6) |
| A07 | **B** | Bloco [POTENCIA] | D4184 tratado como "ponte H" com "abrir/fechar/PWM": é uma chave MOSFET de lado baixo (1 canal) | Com solenoide o D4184 passa a ser o componente certo, 1 por trava (5.7) |
| A08 | **B** | Bloco [POTENCIA] | Alimentação do atuador **não desenhada** (VIN do driver sem ligação) | Rede `V_SOL` gerada pelo VR2 (5.4 e 5.7) |
| A09 | **B** | Bloco 2 | GSM alimentado com 5 V − Schottky (D3). Com carga leve a queda é ~0,3 V → 4,7 V, **acima do máximo de 4,4 V** de um SIM800L sem regulador. E a placa comprada é de 5 V com regulador próprio | SIM800L V2.0 direto em 5 V; D3 removido (5.5) |
| A10 | **B** | BOM item 02 / Bloco 4 | "RA-02 915 MHz": o Ra-02 é SX1278 (410–525 MHz, 433 MHz) | Ra-01H / RFM95W SX1276 (5.10) |
| A11 | I | Bloco 3 | Vários componentes **sem contato elétrico** no desenho: R2 e DZ1 não encostam no fio do sinal; R3/R4 não encostam no nó; as chaves SW1/SW2 têm terminais deslocados ~3 mm do GND e do fio | Bloco 3 redesenhado (5.6) |
| A12 | I | ESP32 G2 | **G2 é pino de boot** e é onde está o LED da placa. Usado como LORA_RST pode impedir a gravação | G2 = LED; LORA_RST no G27 (5.9) |
| A13 | I | ESP32 G14 | G14 emite PWM durante o boot. Ligado ao driver causaria pulso no atuador ao ligar | G14 sem uso (5.9) |
| A14 | I | ESP32 G12 | "HSPI_MISO (reserva)": G12 é pino de boot; se for a nível alto no boot o ESP32 não inicia (tensão da flash) | Marcar como NC, não ligar nada (5.9) |
| A15 | I | ESP32 G25/G26 | Saídas sem pull-down: flutuam no boot → acionamento espúrio | R5/R6 10k para GND (5.7) |
| A16 | I | ESP32 G36 | Errata do ESP32: G36/G39 podem dar pulsos falsos quando o ADC é usado | Ler G36 por varredura com confirmação, nunca por interrupção (seção 10) |
| A17 | I | Bloco 4 | LoRa sem os pinos **DIO0** e **RESET** desenhados (aparecem só no texto do ESP32) | Pinos e rótulos adicionados (5.10) |
| A18 | I | Blocos 5/4 | SD e LoRa no mesmo VSPI. Módulos SD com 74LVC125 costumam deixar o MISO sempre ativo → conflito com o LoRa | Pull-up 10k nos dois CS + teste obrigatório (seção 11, fase 9) |
| A19 | I | Bloco 7 | GPS sem o pino RXD; GSM sem RXD, VDD e RST | Pinos e rótulos adicionados (5.10) |
| A20 | I | Bloco 1 | C1 470 µF/**50 V** com TVS que grampeia em ~50 V: sem margem | C1 470 µF/**63 V** (5.3) |
| A21 | I | BOM item 12 | "TVS P6KE36A BIDIR": o P6KE36A é **unidirecional**; o bidirecional é P6KE36**C**A | P6KE36CA (5.3 e 5.12) |
| A22 | I | Chicote | Sem fusível na saída da bateria: o fio entre a bateria e a placa fica desprotegido | F0 5 A em linha junto à bateria (seção 9) |
| A23 | D | BOM | "Motor de passo" (o TT é motor DC), "Driver duplo ponte H", 74LVC125 como item separado, sem buzzer, LED, antenas, conectores | BOM refeita (5.12) |
| A24 | D | Legenda | Símbolos de motor e zener; layer "PWR GSM 4V"; erro de digitação "SINAIS E ACINAMENTO" | Legenda atualizada (5.11) |
| A25 | D | Script `generate_cad_diagram.py` (SUPERADOS) | O script REV03 tem os mesmos erros A01, A03–A06 e A11 | Não regenerar a partir dele sem corrigir. Usar o `gera_blocos_r4.py` |

O que **está correto** no R3 e permanece:
- fusível F1 + TVS + Schottky anti-inversão + 470 µF na entrada (só faltava alimentar alguém por ali);
- leitura da bateria no **ADC1** (G32), que funciona com o Wi-Fi ligado;
- pinos só-entrada (34, 35, 36, 39) com pull-up externo;
- I2C em G21/G22 e GPS no UART1 (G34/G33);
- GSM no UART2 (G16/G17), buffer de 1000 µF no GSM;
- nenhum uso dos GPIO 6–11 (flash).

---

## 4. Arquitetura elétrica da R4

### 4.1 Diagrama de blocos

```
BATERIA + ──F0 5A──┬── J1-1 KL30 ──F1 3A──┬──D2 1N5822──┬── +24V_PROT
                   │                       │             ├─ C1 470uF/63V, C2 100nF
                   │                       D1 P6KE36CA   ├─ R1 150k → VBAT_ADC (G32)
                   │                       │             ├─ VR1 LM2596HV → +5V ──┬─ ESP32 VIN → 3V3 (LDO da placa)
                   │                      GND            │                       ├─ SIM800L 5V (+C_GSM 1000uF)
CHAVE IGN. ─────── J1-2 KL15 ── R7 150k → KL15 (G39)     │                       ├─ GPS NEO-6M, SD
                                                         │                       └─ Buzzer (opcional)
CHASSI ─────────── J1-3 GND (ponto estrela)              └─ VR2 LM2596HV → V_SOL 12V ─┬─ M1 D4184 → SOL1
                                                                                     └─ M2 D4184 → SOL2
ESP32 3V3 → LoRa SX1276, RTC DS3231, VDD do SIM800L, pull-ups, clamps
```

### 4.2 Tensões e redes

| Rede | Tensão | Origem | Layer no desenho |
|---|---|---|---|
| KL30 | 24 V (20–32 V, transientes) | Bateria via F0 | `PWR_VEICULAR_24V` |
| +24V_PROT | KL30 − 0,4 V | Após F1/D1/D2 | `PWR_VEICULAR_24V` |
| KL15 | 0 ou 24 V | Pós-chave, **só sinal** | `PWR_VEICULAR_24V` |
| +5V (VCC_5V) | 5,00 V | VR1 | `PWR_REGULADA_5V` |
| +5V_GSM | 5,00 V | Ramo do +5V com C_GSM | `PWR_GSM_5V` (antigo `PWR_GSM_4V`) |
| V_SOL | 12,0 V | VR2 | `PWR_SOLENOIDE_12V` (**novo**, cor 40) |
| 3V3 | 3,30 V | Regulador da placa ESP32 | `PWR_LOGICA_3V3` |
| GND | 0 V | J1-3, chassi | `GND_CHASSI_TERRA` |

### 4.3 Orçamento de corrente

| Carga | 5 V médio | 5 V pico | Observação |
|---|---|---|---|
| ESP32 + Wi-Fi | 0,08 A | 0,35 A | Picos de TX Wi-Fi |
| LoRa SX1276 (pelo 3V3 da placa) | 0,01 A | 0,12 A | TX +20 dBm |
| GPS NEO-6M | 0,045 A | 0,05 A | |
| SD | 0,02 A | 0,10 A | Escrita |
| SIM800L | 0,02 A | **2,0 A** | Rajadas de 577 µs na transmissão |
| RTC | < 1 mA | | |
| **Total 5 V** | **≈ 0,2 A** | **≈ 2,6 A** | VR1 3 A com dissipador + C_GSM segura o pico |

| Carga | 12 V | Observação |
|---|---|---|
| SOL1 + SOL2 juntos | ≈ 1,2–1,6 A (2 × 0,6–0,8 A) | Só durante o pulso de 3–5 s; confirmar a corrente real da bobina |

Corrente no lado 24 V, no pior caso (GSM transmitindo + duas travas energizadas): 5 V × 2,6 A / 0,85 / 24 V + 12 V × 1,6 A / 0,88 / 24 V ≈ **0,64 + 0,91 = 1,55 A** → F1 3 A tem margem. Em caminhão 12 V esse valor dobra (~3,1 A): use F1 5 A e D2 SB540 (P3).

Atenção ao regulador 3V3 da placa ESP32 (AMS1117): ESP32 + LoRa + RTC + pull-ups ≈ 0,5 A de pico. Funciona, mas esquenta. Não pendure mais nada no 3V3.

---

## 5. Passo a passo no AutoCAD

O AutoCAD está em português. Os comandos abaixo usam o **prefixo `_`** (nome em inglês), que funciona em qualquer idioma. Exemplo: `_ERASE` é o APAGAR.

### 5.0 Preparação

1. Abra `ALFA R4\R4 FLUXOGRAMA COMUNICACAO LORA E SISTEMA DE BLOQUEIO EHR.dwg` (`_OPEN`). **Não trabalhe no arquivo do R3.**
2. Confira se as coordenadas do desenho são as esperadas: digite `_ID` e clique (com OSNAP *Extremidade*) no **canto inferior esquerdo da caixa do módulo DC-DC (VR1)**. Deve aparecer **X = 45, Y = 440**. Se aparecer, todas as coordenadas deste documento valem como estão. Se não aparecer, anote o deslocamento (ΔX, ΔY) e some-o a todas as coordenadas, ou cole o DXF com esse deslocamento.
3. Ligue o OSNAP com *Extremidade*, *Ponto médio*, *Centro*, *Interseção* e *Perpendicular* (`_OSNAP`).
4. Renomeie o layer do GSM: `_RENAME` → Layers → `PWR_GSM_4V` → `PWR_GSM_5V`.
5. Crie o layer novo: `_LAYER` → Novo → `PWR_SOLENOIDE_12V`, cor **40**, tipo de linha Continuous. Se esquecer, ele é criado automaticamente ao colar o DXF.
6. Descubra o estilo de texto usado no R3: selecione qualquer texto existente → `Ctrl+1` (Propriedades) → anote o campo *Estilo*. Você vai precisar dele no passo 5.2.10.
7. Salve (`Ctrl+S`).

### 5.1 Apagar o que será substituído

Use **seleção por janela** (arraste da **esquerda para a direita**, retângulo de linha contínua). Ela só pega o que está **inteiramente dentro** e preserva as linhas que atravessam a área. Para digitar a janela: `_ERASE` → `W` → primeiro canto → segundo canto.

| Passo | O que apagar | Janela (canto 1 → canto 2) | O que deve sobrar ao redor |
|---|---|---|---|
| 5.1.1 | **Bloco [POTENCIA] inteiro** (título, caixa D4184, textos IN1/IN2/PWM, diodo D4, motor, "TRAVA RADIAL...") | `362,158` → `598,233` | Os fios SD_CS (Y=235) e GPS (Y=240) acima, e o texto "Simbologia conforme normas..." abaixo |
| 5.1.2 | **Bloco 3 inteiro** (título, divisor, DZ1, R3/R4, SW1/SW2, todos os fios e rótulos, e o texto vertical "FINS DE CURSO DA TRAVA RADIAL...") | `18,150` → `333,360` | O fio laranja do VIN (X=335), o terra do C_GSM acima |
| 5.1.3 | **Tabela BOM inteira** (moldura, linhas, colunas, textos) | `828,193` → `1182,837` | A moldura da folha (linha X=1180 e Y=835 continuam) |
| 5.1.4 | **Diodo D3 e o texto "D3 1N5822"** | `187.5,409` → `202.5,425` | Os fios laranja dos dois lados (até X=188 e a partir de X=202) |

Apagar individualmente (clique em cada objeto):

| Passo | Objeto | Onde clicar | Como confirmar |
|---|---|---|---|
| 5.1.5 | Fio vertical vermelho que desce da borda esquerda do J1 até o IN+ do VR1 | `35,600` | `_LIST`: linha de (35,715) a (35,495), layer PWR_VEICULAR_24V |
| 5.1.6 | Junção vermelha na borda esquerda do J1 (2 círculos concêntricos) | `35,715` | Círculos r=1,5 e r=0,75 |

Fios do barramento que estão sobrepostos. **Antes, isole o layer** `BUS_SPI_LORA_SD` (`_LAYISO` → clique num fio magenta). Assim o clique não pega o 3V3 nem o I2C por engano. No fim, `_LAYUNISO`.

| Passo | Rede | Segmentos a apagar (coordenadas de início-fim) | Onde clicar |
|---|---|---|---|
| 5.1.7 | LORA_NSS (G5) | (590,549)-(610,549) · (610,549)-(610,695) · (610,695)-(635,695) | `600,549` · `610,680` · `625,695` |
| 5.1.8 | SCK (G18) | (590,575)-(625,575) · (625,575)-(625,680) · (625,680)-(635,680) · (625,575)-(625,530) · (625,530)-(635,530) · junção em (625,575) | `600,575` · `625,650` · `630,680` · `625,550` · `630,530` · junção |
| 5.1.9 | SD_CS (G13), trecho de baixo e da direita | (355,235)-(620,235) · (620,235)-(620,545) · (620,545)-(635,545) | `450,235` · `620,400` · `628,545` |

**Não apague:** o trecho do SD_CS que sai do G13 pela esquerda, (370,367)-(355,367) e (355,367)-(355,235). Ele continua valendo.

Se algum fio do R3 for uma polilinha (vários segmentos num objeto só), use `_EXPLODE` nele antes e apague só os segmentos da tabela.

### 5.2 Colar os blocos novos

1. `_OPEN` → tipo de arquivo **DXF** → `ALFA R4\R4_BLOCOS_NOVOS.dxf` (abre em outra aba).
2. Nessa aba: `Ctrl+A` (selecionar tudo) → `_COPYBASE` → ponto base **`0,0`** → Enter.
3. Volte para a aba do R4 (`Ctrl+Tab`) → `_PASTECLIP` → ponto de inserção **`0,0`**.
4. Feche a aba do DXF sem salvar.
5. Confira o encaixe com `_ID`:
   - canto inferior esquerdo da caixa **VR2** = **(200, 588)**;
   - fim do novo fio SCK no pino SCK do LoRa = **(635, 680)**;
   - pino `G25 -> TRIG1` do bloco de potência = **(376, 207)**.

O que o DXF coloca no desenho:

| Item | Conteúdo | Posição |
|---|---|---|
| A | Bloco [POTENCIA] novo: 2 canais (R5/R6, M1/M2 D4184, D4/D5, SOL1/SOL2), rede V_SOL | X 370–590, Y 155–235 |
| B | Bloco 3 novo: VBAT (R1 150k, R2 10k, C3, D6/D7 BAT43), KL15 (R7, R8, C4, D8/D9), fins de curso (SW1/SW2, R3/R4 4k7, C5/C6, R9/R10 1k) | X 25–330, Y 155–360 |
| C | Novo fio de alimentação do VR1 a partir do +24V_PROT (X=315 → Y=580 → X=35), junção para o VR2 | Bloco 1/2 |
| C | Caixa **VR2** com C_SOL e rótulo V_SOL | X 182–315, Y 580–625 |
| C | Fio KL15 saindo do J1-2 com rótulo "KL15 -> BLOCO 3 (R7)" | (65,675)–(80,675) |
| C | Jumper no lugar do D3, layer PWR_GSM_5V | (188,415)–(202,415) |
| D | Novas rotas do NSS (coluna X=600), SCK (X=630) e SD_CS (X=595) | Barramento |
| E | Pinos novos: LoRa DIO0/RESET, GPS RXD, GSM VDD/RXD/RST, notas R11/R12/C_LORA | Lado direito dos módulos (X=800) |
| F | **BOM R4** completa + notas de revisão | X 830–1180, Y 245,5–835 |
| G | Símbolos de legenda (solenoide e BAT43), **fora da folha** | X≈1290–1340, Y 50–130 |

6. Os textos colados vêm no estilo `STANDARD`. Se no seu R3 o `STANDARD` já usa a fonte Aller, eles ficam iguais automaticamente. Se não, selecione os textos novos (`_SELECT` → `P` de "anterior" logo após colar, ou por janela) → `Ctrl+1` → *Estilo* = o estilo anotado em 5.0-6.

### 5.3 Bloco 1: entrada veicular

1. Localizar e substituir (`_FIND`), com **"Coincidir maiúsc./minúsc." ligado** e **"Palavra inteira" desligado**:

| Localizar (exato) | Substituir por |
|---|---|
| `2: +24V (KL15)` | `2: KL15 (SINAL)` |
| `D1 (P6KE36A)` | `D1 P6KE36CA` |
| `C1 470uF/50V` | `C1 470uF/63V` |

2. O símbolo do D1 já é bidirecional: fica como está.
3. Confira que o pino 1 do J1 (KL30) agora só vai para o F1 (o fio da borda esquerda foi apagado em 5.1.5/5.1.6).
4. Opcional, recomendado: escreva junto ao J1-1 o texto `F0 5A NO CHICOTE (JUNTO A BATERIA)`, altura 2,2, layer PWR_VEICULAR_24V, posição (12, 722). Se não couber, deixe só na BOM.

### 5.4 Bloco 2: reguladores

1. Localizar e substituir:

| Localizar (exato) | Substituir por |
|---|---|
| `[BLOCO 2] REGULADOR DC-DC STEP-DOWN &CONDICIONADOR GSM` | `[BLOCO 2] REGULADORES DC-DC (VR1 5V / VR2 12V) & BUFFER GSM` |
| `MODULO DC-DC STEP-DOWN` | `VR1 BUCK LM2596HV` |
| `LM2596 HV / MP1584` | `Vin 4,5-60V / Vout 5,0V 3A` |
| `Vin: 9-36V \| Vout: 5.0V 3A` | `+ DISSIPADOR (LOGICA + GSM)` |

(No campo do AutoCAD, digite a barra vertical `|` normal. A `\` só aparece aqui por causa da formatação da tabela.)

2. Confira o novo caminho do +24V_PROT colado em 5.2: terminal `+24V_PROT` (290,715) → direita até X=315 → desce até Y=580 → esquerda até X=35 → desce até o IN+ do VR1 (35,495)→(45,495). O trecho (35,495)–(45,495) já existia: só confira se está encostado.
3. Na vertical X=315 há uma junção em Y=618, de onde sai o IN+ do VR2. O IN− do VR2 vai para o GND.
4. A saída do VR2 tem C_SOL 470 µF/25 V e o rótulo **V_SOL**, o mesmo nome do bloco de potência (ligação por rótulo).
5. O texto `+24V_PROT -> VR1 (IN+)` identifica o fio novo; pode mover se atrapalhar a leitura.

### 5.5 Bloco 2: ramo do GSM

1. O D3 foi apagado (5.1.4) e o jumper colado (5.2). Confira a continuidade (175,415) → (230,415) com `_LIST` nos três trechos.
2. Selecione os fios do ramo GSM que estavam no antigo `PWR_GSM_4V` (agora `PWR_GSM_5V`): conferir se todos mudaram de layer com o `_RENAME`.
3. Localizar e substituir:

| Localizar | Substituir por |
|---|---|
| `+4.1V_GSM (SIM800L VCC)` | `+5V_GSM (SIM800L V2.0 - PINO 5V)` |
| `C_GSM 1000uF` | `C_GSM 1000uF/16V + C7 100nF` |

**Variante B (só se o SIM800L for o módulo vermelho pequeno, sem regulador):** não use o +5V. Acrescente um terceiro buck LM2596HV (VR3) ajustado em **4,00 V**, com entrada no +24V_PROT e capacidade de 2 A ou mais. A saída dele vira `+4V0_GSM` com C_GSM 1000 µF. A entrada RX do módulo (lógica 2,8 V) recebe o TX do ESP32 por um divisor 1k/2k2. Atualize o rótulo e a BOM.

### 5.6 Bloco 3: VBAT, KL15 e fins de curso

Já colado em 5.2. Confira:
- **VBAT:** `+24V_PROT` → R1 150k → nó → R2 10k ao GND, C3 100nF ao GND, D6 BAT43 (anodo no nó, catodo no +3,3 V), D7 BAT43 (anodo no GND, catodo no nó) → terminal `VBAT_ADC -> ESP32 G32`.
- **KL15:** `KL15 (J1-2)` → R7 150k → nó → R8 10k, C4, D8, D9 (mesmo arranjo) → `KL15_SENSE -> ESP32 G39 (VN)`.
- **Fins de curso:** SW1 NA (um lado no GND, outro no nó) → nó com R3 4k7 ao 3V3 e C5 100nF ao GND → R9 1k → `FC_TRAVA1 -> ESP32 G35`. SW2 igual com R4, C6, R10 → `FC_TRAVA2 -> ESP32 G36 (VP)`.
- Todos os componentes **encostam** nos fios (não há mais lacunas como no R3). Clique em cada terminal com OSNAP para confirmar.

### 5.7 Bloco [POTENCIA]

Já colado em 5.2. Confira por canal (canal 1 / canal 2):
- `G25 -> TRIG1 (SOL1)` / `G26 -> TRIG2 (SOL2)` → R5/R6 10k ao GND (pull-down) → pino TRIG do M1/M2 D4184.
- GND de sinal do módulo → GND.
- VIN+ → rede `V_SOL` (as duas verticais se unem em X=454 por uma junção); VIN− → GND.
- OUT+ → `+` do solenoide; OUT− → `−` do solenoide.
- D4/D5 1N4007 **em paralelo com cada bobina**, **catodo no `+`** (no desenho o traço do diodo fica no fio de cima).
- Texto ao lado de cada solenoide: `MINI TRAVA 12V / FAIL-SECURE / J2 / SW1` (canal 2: `J3 / SW2`).

### 5.8 Barramentos SPI: conferência das colunas

Depois de 5.1.7–5.1.9 e da colagem, as colunas verticais entre o ESP32 (X=590) e os módulos (X=635) devem ficar assim. **Cada rede numa coluna própria**, com compartilhamento só entre redes que não se sobrepõem em Y:

| Coluna X | Rede | Faixa Y | Junções |
|---|---|---|---|
| 595 | SD_CS (G13) | 235–545 | — |
| 600 | LORA_NSS (G5) | 549–695 | — |
| 605 | I2C SCL (G22) | 385–653 | — |
| 610 | I2C SDA (G21) | 400–627 | — |
| 615 | MOSI (G23) / UART GSM RX2 (G16) | 515–679 / 180–419 | (615,665) |
| 620 | MISO (G19) | 500–650 | (620,601) |
| 625 | 3V3 / UART GPS (G34) | 430–800 / 240–270 | (625,725) |
| 630 | SCK (G18) | 530–680 | (630,575) |

Teste rápido: `_LAYISO` no `BUS_SPI_LORA_SD` e confira que nenhuma vertical magenta se sobrepõe a outra. Repita isolando `BUS_I2C_RTC` + `PWR_LOGICA_3V3` juntos.

### 5.9 Bloco ESP32: textos dos pinos

Localizar e substituir, **nesta ordem**. A linha 1 precisa vir antes da linha 2, senão o texto do G2 e o do G27 se confundem.

| # | Pino | Localizar (exato) | Substituir por |
|---|---|---|---|
| 1 | G2 | `IO -> LORA_RST` | `LED STATUS (ONBOARD)` |
| 2 | G27 | `IO_RES (STATUS LED)` | `IO -> LORA_RST` |
| 3 | G36 | `SENSOR_VP <- FC_DESTRAV` | `FC_TRAVA2 (SW2) - POLLING` |
| 4 | G39 | `SENSOR_VN (RESERVA)` | `KL15_SENSE (IGNICAO)` |
| 5 | G35 | `INPUT ONLY <- FC_TRAVADO` | `FC_TRAVA1 (SW1)` |
| 6 | G32 | `ADC1_CH4 <- SINAL_VBAT` | `ADC1_CH4 <- VBAT_ADC` |
| 7 | G25 | `DAC1 -> DRV_GATE1 (ABRIR)` | `SAIDA -> TRIG1 D4184 (SOL1)` |
| 8 | G26 | `DAC2 -> DRV_GATE2 (FECHAR)` | `SAIDA -> TRIG2 D4184 (SOL2)` |
| 9 | G14 | `PWM -> DRV_VELOCIDADE` | `LIVRE (PWM NO BOOT)` |
| 10 | G12 | `HSPI_MISO (RESERVA)` | `NC - PINO DE BOOT` |
| 11 | G13 | `HSPI_MOSI -> SD_CS` | `IO -> SD_CS (R12)` |
| 12 | G5 | `VSPI CS -> LORA_NSS` | `VSPI CS -> LORA_NSS (R11)` |
| 13 | G15 | `HSPI_CS / BUZZER ALARME` | `IO -> BUZZER Q1 (OPCIONAL)` |
| 14 | VIN | `ENTRADA +5.0V STEP-DOWN` | `ENTRADA +5.0V (VR1)` |
| 15 | título | `ESP32 DEVKIT V1 (38 PINOS) - DUAL CORE 240MHz` | `ESP32 DEVKIT V1 (WROOM-32) - DIAGRAMA LOGICO` |

Depois da troca, se algum texto ficar longo demais e encostar no nome do pino, reduza a altura dele de 2,5 para 2,2.

### 5.10 Blocos 4 a 7: módulos

Localizar e substituir:

| Bloco | Localizar | Substituir por |
|---|---|---|
| 4 LoRa | `MODULO LORA RA-02` | `MODULO LORA RA-01H / RFM95W` |
| 4 LoRa | `SX1276 915MHz SPI + CSS` | `SX1276 915-928MHz SPI (AU915)` |
| 5 SD | `Buffer 74LVC125 SPI FAT32` | `SPI FAT32 - VCC 5V (REG. ONBOARD)` |
| 7 GSM | `MODEM GSM SIM800L` | `MODEM GSM SIM800L V2.0 (5V)` |
| 7 GSM | `VCC (+4.1V GSM)` | `5V <- +5V_GSM` |

Já colados em 5.2 (só conferir):
- LoRa: `DIO0 -> ESP32 G4` (pino em 800,710), `RESET <- ESP32 G27` (800,695), `R11 10k p/ 3V3` junto ao NSS, `C_LORA 100uF + C8 100nF` junto ao 3V3.
- SD: `R12 10k p/ 3V3` junto ao CS.
- GPS: `RXD <- ESP32 G33` (800,284).
- GSM: `VDD (NIVEL) <- 3V3` (800,208), `RXD <- ESP32 G17` (800,194), `RST: NC` (800,180).

### 5.11 Legendas

**Legenda de simbologia** (centro inferior):
1. Apague o símbolo do motor (círculo + texto "M") e cole no lugar o símbolo do solenoide da área G. Use `_COPYBASE` pela cruz de referência em (1300,100) e cole no centro do círculo antigo.
2. Apague o símbolo do zener e cole o símbolo do BAT43 (cruz em (1300,60)) no centro do antigo.
3. Apague as duas cruzes e os dois textos de instrução da área G (layer 0).
4. Localizar e substituir:

| Localizar | Substituir por |
|---|---|
| `Motor DC Redutor TT` | `Mini Trava Solenoide` |
| `Trava 3 palhetas 120 graus` | `Fail-secure 12V (V_SOL)` |
| `Diodo Zener 3.3V` | `Diodo Schottky BAT43` |
| `Clamp sobretensao ADC` | `Clamp ADC (3V3 / GND)` |
| `Supressao indutiva motor` | `Supressao indutiva solenoide` |
| `Diodo TVS P6KE36A` | `Diodo TVS P6KE36CA` |
| `Sensoriamento mecanico` | `Lingueta travada = contato fechado` |

5. Apague os textos `Mini Trava Solenoide` / `Fail-secure 12V (V_SOL)` / `Diodo Schottky BAT43` / `Clamp ADC (3V3 / GND)` que vieram **na área G** (fora da folha). Os da legenda já foram trocados no item 4.

**Legenda de layers** (canto inferior esquerdo):

| Localizar | Substituir por |
|---|---|
| `PWR GSM 4V` | `PWR GSM 5V` |
| `SINAIS E ACINAMENTO` | `SINAIS DE ACIONAMENTO` |

6. Nova linha da legenda: copie (`_COPY`) a linha `PWR LOGICA 3V3` (texto + traço de exemplo) **17,5 mm para baixo**. Troque o texto para `PWR SOLENOIDE 12V` e mude o traço de exemplo para o layer `PWR_SOLENOIDE_12V`.

### 5.12 Carimbo e BOM

1. Localizar e substituir: `REV: REV. 03` → `REV: REV. 04`.
2. A data continua `10/2026`; se quiser o dia, escreva `23/10/2026`.
3. O título do carimbo pode virar `ESQUEMA DE LIGACAO ELETRONICO - COMUNICACAO LORA/GSM E TRAVA SOLENOIDE`, opcional.
4. A **BOM R4** já foi colada inteira (item F do DXF). Confira os 32 itens com a seção 8 deste documento.

### 5.13 Limpeza, verificação e plotagem

1. `_OVERKILL` → selecione tudo → OK. Remove linhas duplicadas (ex.: borda direita da BOM sobre a moldura).
2. `_AUDIT` → `S` (corrigir erros) e `_PURGE` → tudo que não é usado. **Não** marque *Purgar layers* se quiser manter o layer antigo vazio.
3. **Checklist de conferência visual**, item por item:
   - [ ] O VR1 IN+ chega pelo fio do +24V_PROT; nada sai da borda esquerda do J1.
   - [ ] O J1-2 vai só para o rótulo KL15 (Bloco 3), não para alimentação.
   - [ ] As colunas do barramento estão como na tabela 5.8, sem sobreposição.
   - [ ] Não sobrou motor, ponte H, "ABRIR/FECHAR", "PWM (VEL)", D3 nem DZ1 no desenho (`_FIND` em cada termo).
   - [ ] Cada rótulo de rede tem o par do outro lado: V_SOL (VR2 ↔ potência), G4/G27/G33/G17/G25/G26/G35/G36/G39/G32 (módulo ↔ ESP32), KL15 (J1 ↔ Bloco 3), +24V_PROT (Bloco 1 ↔ Bloco 3).
   - [ ] Os diodos D4/D5 têm o catodo no `+` do solenoide; D6/D8 apontam para o +3,3 V; D7/D9 saem do GND.
   - [ ] O carimbo diz REV. 04.
4. Salve. Plote em PDF com a mesma configuração de página do R3 (`_PLOT` → *Configuração de página* = a do R3; ou `_PAGESETUP` → importar do arquivo R3). Nome: `R4 FLUXOGRAMA COMUNICACAO LORA E SISTEMA DE BLOQUEIO EHR-Model.pdf`.

---

## 6. Pinagem final do ESP32

| GPIO | Função R4 | Direção | Observação |
|---|---|---|---|
| 3V3 | Saída 3,3 V | — | LoRa, RTC, VDD do SIM800L, pull-ups, clamps |
| EN | Reset | — | Não usar |
| G36 (VP) | FC_TRAVA2 (SW2) | Entrada | Só entrada; **ler por varredura** (errata) |
| G39 (VN) | KL15_SENSE | Entrada analógica | Só entrada; pode acordar do deep sleep (EXT0) |
| G34 | UART1 RX ← GPS TX | Entrada | Só entrada |
| G35 | FC_TRAVA1 (SW1) | Entrada | Só entrada |
| G32 | VBAT_ADC | Entrada analógica | ADC1_CH4 |
| G33 | UART1 TX → GPS RX | Saída | |
| G25 | TRIG1 → M1 D4184 (SOL1) | Saída | Pull-down R5 10k |
| G26 | TRIG2 → M2 D4184 (SOL2) | Saída | Pull-down R6 10k |
| G27 | LORA_RST | Saída | |
| G14 | Livre | — | PWM no boot: não usar para potência |
| G12 | **NC** | — | Pino de boot: nada ligado |
| G13 | SD_CS | Saída | Pull-up R12 10k |
| GND | Terra | — | |
| VIN | +5 V do VR1 | — | |
| G23 | VSPI MOSI | Saída | LoRa + SD |
| G22 | I2C SCL | Saída | RTC (pull-up no módulo) |
| G21 | I2C SDA | E/S | RTC |
| G19 | VSPI MISO | Entrada | LoRa + SD |
| G18 | VSPI SCK | Saída | LoRa + SD |
| G5 | LORA_NSS | Saída | Pino de boot (precisa de nível alto) → pull-up R11 10k |
| G4 | LORA_DIO0 | Entrada | Interrupção TX/RX pronto |
| G2 | LED de status (da placa) | Saída | Pino de boot; o LED é compatível |
| G15 | Buzzer (Q1), opcional | Saída | Pino de boot: nível baixo só desliga o log do boot |
| G16 | UART2 RX ← SIM800L TXD | Entrada | |
| G17 | UART2 TX → SIM800L RXD | Saída | |
| TX0/RX0 | USB / depuração | — | Não usar |

Pinos de boot (strapping) e o estado de cada um: G0 = botão BOOT (não usado); G2 = LED (nível baixo no boot); G5 = alto (R11); G12 = sem ligação (baixo interno); G15 = baixo pelo R14 do buzzer (só silencia o log).

---

## 7. Lista de ligações ponto a ponto (para montagem)

### 7.1 Alimentação e proteção

| # | De | Para | Bitola / obs. |
|---|---|---|---|
| 1 | Bateria + | F0 5 A (porta-fusível em linha, até 20 cm da bateria) | 1,0 mm² |
| 2 | F0 | J1-1 (KL30) | 1,0 mm² |
| 3 | Chassi (ponto de massa limpo) | J1-3 (GND) | 1,0 mm², terminal olhal |
| 4 | Pós-chave (ignição) | J1-2 (KL15) | 0,5 mm²; só sinal |
| 5 | J1-1 | F1 3 A | Trilha/fio largo |
| 6 | Saída F1 (nó A) | D1 P6KE36CA, outro lado no GND | TVS curto, perto do borne |
| 7 | Nó A | D2 1N5822 anodo | |
| 8 | D2 catodo | **+24V_PROT** | |
| 9 | +24V_PROT | C1 470 µF/63V (+); C1 (−) no GND | |
| 10 | +24V_PROT | C2 100 nF; outro lado no GND | |
| 11 | +24V_PROT | VR1 IN+; VR1 IN− no GND | |
| 12 | +24V_PROT | VR2 IN+; VR2 IN− no GND | |
| 13 | VR1 OUT+ (5,00 V) | Barramento +5 V | |
| 14 | VR2 OUT+ (12,0 V) | Rede V_SOL + C_SOL 470 µF/25V (+) | |
| 15 | VR1 OUT−, VR2 OUT− | GND | |

### 7.2 Distribuição

| # | De | Para |
|---|---|---|
| 16 | +5 V | ESP32 VIN |
| 17 | +5 V | SIM800L pino 5V (C_GSM 1000 µF + C7 100 nF soldados **nos pinos** do módulo, a menos de 15 mm) |
| 18 | +5 V | GPS VCC |
| 19 | +5 V | SD VCC |
| 20 | +5 V | Buzzer (+), opcional |
| 21 | ESP32 3V3 | LoRa 3V3 (C_LORA 100 µF + C8 100 nF no pino) |
| 22 | ESP32 3V3 | RTC VCC |
| 23 | ESP32 3V3 | SIM800L VDD (referência de nível da UART) |
| 24 | ESP32 3V3 | R3, R4, R11, R12 (pull-ups) e catodos de D6/D8 |
| 25 | GND de todos os módulos | Barramento GND da placa → ponto estrela no J1-3 |

### 7.3 Sinais analógicos e sensores

| # | De | Para |
|---|---|---|
| 26 | +24V_PROT → R1 150k → **nó VBAT** | nó VBAT → R2 10k → GND; nó → C3 100 nF → GND; nó → D6 (A) / D6 (K) → 3V3; GND → D7 (A) / D7 (K) → nó; nó → **G32** |
| 27 | J1-2 → R7 150k → **nó KL15** | nó → R8 10k → GND; C4 100 nF → GND; D8 ao 3V3; D9 do GND; nó → **G39** |
| 28 | SW1 contato 1 (via J4-2) | GND |
| 29 | SW1 contato 2 (via J4-1) → **nó FC1** | nó → R3 4k7 → 3V3; nó → C5 100 nF → GND (no conector); nó → R9 1k → **G35** |
| 30 | SW2 (via J5) → **nó FC2** | Mesmo arranjo: R4, C6, R10 → **G36** |

### 7.4 Acionamento das travas

| # | De | Para |
|---|---|---|
| 31 | G25 | M1 TRIG; R5 10k de TRIG para GND |
| 32 | G26 | M2 TRIG; R6 10k de TRIG para GND |
| 33 | M1/M2 GND (sinal) | GND |
| 34 | V_SOL | M1 VIN+, M2 VIN+ |
| 35 | M1/M2 VIN− | GND, **por fio/trilha próprio até o ponto estrela** (corrente da bobina não passa pelo GND da lógica) |
| 36 | M1 OUT+ / OUT− | J2-1 / J2-2 → SOL1 (+) / (−) |
| 37 | M2 OUT+ / OUT− | J3-1 / J3-2 → SOL2 (+) / (−) |
| 38 | D4 (D5) 1N4007 | Soldado **nos terminais do solenoide**: catodo (faixa) no +, anodo no − |

### 7.5 Comunicação

| # | Módulo | Pino do módulo | ESP32 |
|---|---|---|---|
| 39 | LoRa | NSS | G5 (+ R11 10k ao 3V3) |
| 40 | LoRa | SCK | G18 |
| 41 | LoRa | MOSI | G23 |
| 42 | LoRa | MISO | G19 |
| 43 | LoRa | DIO0 | G4 |
| 44 | LoRa | RESET | G27 |
| 45 | LoRa | ANT | Pigtail IPEX → SMA → antena 915 MHz (**nunca transmitir sem antena**) |
| 46 | SD | CS | G13 (+ R12 10k ao 3V3) |
| 47 | SD | SCK / MOSI / MISO | G18 / G23 / G19 |
| 48 | RTC | SDA / SCL | G21 / G22 (32K e SQW sem ligação) |
| 49 | GPS | TX / RX | G34 / G33 |
| 50 | SIM800L | SIM_TXD (saída do módulo) | G16 |
| 51 | SIM800L | SIM_RXD (entrada do módulo) | G17 |
| 52 | SIM800L | RST | Sem ligação (opcional: G14 numa revisão futura) |
| 53 | SIM800L | GND (os dois pinos) | GND |

### 7.6 Opcional

| # | De | Para |
|---|---|---|
| 54 | G15 → R13 1k | Base Q1 2N2222; R14 10k entre base e emissor |
| 55 | Q1 emissor | GND |
| 56 | Q1 coletor | Buzzer (−); buzzer (+) no +5 V |

---

## 8. Lista de materiais R4 e o que ainda falta comprar

### 8.1 BOM R4 (igual à do desenho)

| IT | Qtd | Ref | Componente | Especificação / aplicação |
|---|---|---|---|---|
| 01 | 1 | U1 | ESP32 DevKit V1 (WROOM-32) | 30 ou 38 pinos |
| 02 | 1 | U2 | LoRa Ra-01H / RFM95W (SX1276) | 915–928 MHz, SPI, antena SMA 915 + pigtail IPEX |
| 03 | 1 | U3 | GPS NEO-6M (GY-GPS6MV2) | UART 9600 bps, 3–5 V |
| 04 | 1 | U4 | SIM800L EVB V2.0 (5 V) | VDD = 3V3, pico 2 A |
| 05 | 1 | U5 | RTC DS3231 (ZS-042) | I2C 3V3 + CR2032; remover circuito de carga |
| 06 | 1 | U6 | Módulo micro SD (SPI) | VCC 5 V |
| 07 | 1 | VR1 | Buck LM2596HV 5,0 V 3 A | Entrada 4,5–60 V + dissipador |
| 08 | 1 | VR2 | Buck LM2596HV 12,0 V 3 A | Entrada 4,5–60 V |
| 09 | 2 | M1, M2 | Módulo MOSFET D4184 | Chave low-side, entrada 3,3 V |
| 10 | 2 | SOL1, SOL2 | Mini trava solenoide 12 V | Fail-secure, lingueta chanfrada |
| 11 | 2 | SW1, SW2 | Microswitch KW12 NA | Fim de curso da lingueta |
| 12 | 1 | F1 | Fusível mini ATO 3 A + porta-fusível | 5 A em caminhão 12 V |
| 13 | 1 | F0 | Fusível em linha 5 A + porta-fusível estanque | Junto à bateria |
| 14 | 1 | D1 | TVS P6KE36CA | Bidirecional 600 W |
| 15 | 1 | D2 | Schottky 1N5822 | 3 A 40 V (SB540 em 12 V) |
| 16 | 2 | D4, D5 | 1N4007 | Flyback das bobinas |
| 17 | 4 | D6–D9 | Schottky BAT43 (DO-35) | Clamp dos ADC |
| 18 | 1 | C1 | Eletrolítico 470 µF 63 V low ESR | Entrada |
| 19 | 1 | C_GSM | Eletrolítico 1000 µF 16 V low ESR | Pico do GSM |
| 20 | 1 | C_SOL | Eletrolítico 470 µF 25 V | Saída VR2 |
| 21 | 1 | C_LORA | Eletrolítico 100 µF 10 V | 3V3 do LoRa |
| 22 | 7 | C2–C8 | Cerâmico 100 nF 50 V | Desacoplamento / debounce |
| 23 | 2 | R1, R7 | 150 kΩ 1 % 1/4 W | Divisores |
| 24 | 2 | R2, R8 | 10 kΩ 1 % 1/4 W | Divisores |
| 25 | 2 | R3, R4 | 4,7 kΩ 5 % | Pull-up fins de curso |
| 26 | 2 | R5, R6 | 10 kΩ 5 % | Pull-down TRIG |
| 27 | 2 | R9, R10 | 1 kΩ 5 % | Série GPIO fins de curso |
| 28 | 2 | R11, R12 | 10 kΩ 5 % | Pull-up NSS / SD_CS |
| 29 | 1 | J1 | Borne automotivo 3 vias 5,08 mm | KL30 / KL15 / GND |
| 30 | 4 | J2–J5 | Conector 2 vias com trava | Solenoides e fins de curso |
| 31 | 1 | BZ1, Q1 | Buzzer ativo 5 V + 2N2222 (+ R13 1k, R14 10k) | Opcional |
| 32 | 3 | ANT1–3 | Antenas LoRa 915 / GSM / GPS | |

Não estão no desenho mas são necessários: caixa IP67 com prensa-cabos, placa padrão ou PCB, cabos 1,0 / 0,75 / 0,5 mm² (par trançado para sensores), espaguete termocontrátil, cartão micro SD (≤ 32 GB, FAT32), chip GSM de operadora com 2G na região, bateria CR2032.

### 8.2 Já comprado (pasta ALTERNATIVOS) e situação

| Item comprado | Situação na R4 |
|---|---|
| Conversor DC 12/24 V → 5 V, entrada 10–28 V, 2 A (R$ 44,90) | **Não usar no caminhão** (entrada máxima 28 V). Serve para bancada |
| Módulo micro SD | Usar (U6) |
| RTC DS3231 | Usar (U5); remover o circuito de carga (seção 9.3) |
| SIM800L "5 V" | Usar (U4) se for a placa V2.0 (P4) |
| GPS NEO-6M | Usar (U3) |
| LoRa 915 MHz SX1276 (R$ 157,98) | Usar (U2) se a serigrafia confirmar SX1276/SPI (P5) |
| Placa ESP32 | Usar (U1) |

### 8.3 Falta comprar

2× LM2596HV (confira a marcação do CI **LM2596HVS** e capacitores de entrada **≥ 63 V**; há módulos "HV" falsificados com capacitores de 35 V), 2× D4184, 2× mini trava solenoide 12 V fail-secure, 2× microswitch, TVS P6KE36CA, 1N5822, 2× 1N4007, 4× BAT43, os capacitores e resistores da BOM, fusíveis F0/F1 com porta-fusíveis, borne J1, conectores J2–J5, antenas, caixa IP67 e, opcionalmente, buzzer + 2N2222.

---

## 9. Montagem física e preparação dos módulos

### 9.1 Antes de ligar qualquer módulo

1. **Ajuste os buck sem carga:** alimente cada LM2596HV com 24 V de uma fonte de bancada e gire o trimpot até **VR1 = 5,00 V ± 0,05** e **VR2 = 12,0 V ± 0,2**. Só depois ligue as cargas. Pingue esmalte/cola no trimpot.
2. Confira a tensão dos capacitores de entrada dos dois módulos LM2596HV (≥ 63 V). Se forem de 35 V ou 50 V, troque.
3. Ponha dissipador no CI do VR1.

### 9.2 Módulo SIM800L V2.0

- Pinos: `5V`, `GND`, `VDD`, `SIM_TXD`, `SIM_RXD`, `GND`, `RST`. Confira a serigrafia da sua placa.
- `VDD` = 3V3 do ESP32: define o nível da UART em 3,3 V.
- Solde C_GSM 1000 µF + 100 nF **direto nos pinos 5V/GND do módulo**.
- Fio 5V/GND do módulo curto e grosso (≥ 0,5 mm²).
- Antena GSM sempre conectada antes de energizar.

### 9.3 Módulo RTC DS3231 (ZS-042)

O módulo tem um circuito de carga para bateria recarregável (LIR2032): um resistor de ~200 Ω em série com um diodo, ligado ao VCC. Com **CR2032 (não recarregável)**, retire o diodo ou o resistor. Com VCC em 3,3 V o risco é baixo, mas a retirada é a prática correta. Endereços I2C: RTC **0x68**, EEPROM 0x57.

### 9.4 LoRa

- Solde o pigtail IPEX → SMA e prenda a antena 915 MHz na face superior da caixa.
- **Nunca energize o LoRa sem antena:** a potência refletida queima o estágio de saída.
- C_LORA 100 µF + 100 nF no pino 3V3 do módulo.

### 9.5 Solenoides e D4184

- Confira no módulo D4184 os bornes `VIN+ VIN-` (alimentação), `OUT+ OUT-` (carga) e a entrada de sinal (`TRIG/PWM` e `GND`).
- Diodo 1N4007 soldado **no próprio solenoide** (catodo/faixa no +).
- Teste cada solenoide antes de montar: 12 V direto → a lingueta recolhe; sem energia → estende. Meça a corrente com o multímetro e anote (entra no firmware e confirma o F1).
- **Destravamento manual de emergência obrigatório** (cilindro com chave ou cabo): como a trava é fail-secure, sem bateria não há como abrir a tampa.

### 9.6 Fiação e aterramento

- Ponto de terra **estrela** no J1-3: chegam separadamente o GND da lógica, o GND do VR1/VR2 e o retorno das bobinas (VIN− dos D4184).
- Bitolas: KL30/GND 1,0 mm²; solenoides 0,75 mm²; sensores e KL15 0,5 mm² em **par trançado**.
- Conectores com trava, de preferência estanques (Superseal/Deutsch) no Beta.
- Caixa da eletrônica **longe do bocal**; na tampa ficam só os solenoides e os microswitches.
- Antenas LoRa/GSM/GPS na face superior da caixa, longe de chapas metálicas.

---

## 10. Requisitos do firmware v2.0

O firmware v1.1 (3 motores, 6 fins de curso, L298N, só Wi-Fi) **não serve** para este hardware. Requisitos da v2.0:

### 10.1 Definições de pinos

```cpp
#define PIN_TRIG_SOL1   25
#define PIN_TRIG_SOL2   26
#define PIN_FC_TRAVA1   35   // LOW = lingueta estendida (travada)
#define PIN_FC_TRAVA2   36   // LOW = travada; ler por varredura (errata)
#define PIN_VBAT_ADC    32
#define PIN_KL15_ADC    39
#define PIN_LED         2
#define PIN_BUZZER      15   // opcional
#define PIN_LORA_NSS    5
#define PIN_LORA_RST    27
#define PIN_LORA_DIO0   4
#define PIN_SD_CS       13
#define PIN_GPS_RX      34   // UART1 RX
#define PIN_GPS_TX      33   // UART1 TX
#define PIN_GSM_RX      16   // UART2 RX
#define PIN_GSM_TX      17   // UART2 TX
#define PIN_I2C_SDA     21
#define PIN_I2C_SCL     22
// SPI: SCK 18, MISO 19, MOSI 23
```

### 10.2 Inicialização

1. A **primeira** coisa no `setup()`: `pinMode(25/26, OUTPUT)` e `digitalWrite(LOW)`.
2. NSS do LoRa e CS do SD em nível alto **antes** de iniciar o SPI.
3. Ler a posição real das linguetas e não acionar nada sozinho após uma queda de energia.

### 10.3 Destravar (pulso nos solenoides)

- Pré-condições: comando autenticado (10.6), VBAT acima do mínimo (≥ 20 V em 24 V; ≥ 10,5 V em 12 V) e fora do bloqueio térmico.
- Energizar SOL1 e SOL2 **juntos**, com defasagem de 50 ms para reduzir o pico de partida.
- Duração `T_PULSO` = 3 s (configurável, **máximo absoluto 5 s**).
- A janela de abertura é o próprio pulso: o operador abre a tampa enquanto as linguetas estão recolhidas.
- Desligar ao fim do pulso ou quando os dois fins de curso indicarem tampa aberta.
- Proteção térmica: intervalo mínimo de **10 s** entre pulsos; no máximo **3 pulsos por minuto**.

### 10.4 Travar

- A trava é **mecânica**: a lingueta chanfrada engata sozinha quando a tampa fecha (P2). O firmware só confirma.
- Estado `TRAVADO` = SW1 **e** SW2 em nível baixo por ≥ 200 ms.
- Tampa fechada com um sensor aberto → alarme "travamento incompleto".
- Se a lingueta for reta (P2 negativa), energizar, fechar e desenergizar.

### 10.5 Sensores e medições

- Fins de curso: varredura a cada 20 ms; considerar a mudança após 3 leituras iguais.
- **Violação:** SW1 ou SW2 abre sem um destravamento autorizado → buzzer, gravação no SD com hora do RTC e envio de alerta (LoRa + SMS) com posição do GPS.
- VBAT: `analogReadMilliVolts(32)`, média de 16 leituras. `Vbat = mV × 16 / 1000 + 0,35` (o 0,35 V compensa a queda do D2).
- KL15: `Vkl15 = mV × 16 / 1000`. Ignição LIGADA se > 8 V; DESLIGADA se < 4 V (histerese).

### 10.6 Comunicação e segurança

- **LoRa:** 915 MHz (faixa 915–928 MHz), SF9, BW 125 kHz, CR 4/5, sync word privada (0x12), potência 17 dBm.
  - Pacote: ID do caminhão, estado, VBAT, KL15, lat/lon, hora e contador.
- **Comandos de destravar** (LoRa, SMS ou Wi-Fi) **autenticados**: HMAC-SHA256 com chave por caminhão + contador crescente (anti-replay). Sem isso, qualquer pessoa que gravar um pacote de rádio consegue reabrir a trava.
- **GSM:** SMS de alerta; GPRS/MQTT opcional. Verificar a cobertura 2G na região de operação (as operadoras estão desligando o 2G aos poucos).
- **Wi-Fi/app Android:** manter como interface local de manutenção (o app da v1.1 pode ser adaptado: TRAVAR vira "consultar estado").

### 10.7 Registro, relógio e energia

- **SD:** log CSV de eventos (destravamento, violação, alarme, queda de VBAT, partidas).
- **RTC:** fonte de hora; sincronizar pelo GPS quando houver fix.
- **Energia:** ignição desligada por mais de N minutos → GPS em espera, GSM em sleep (`AT+CSCLK=2`), ESP32 em light/deep sleep.
  - Acordar por KL15 (EXT0 no G39, nível alto), por violação (EXT1 em G35|G36, ANY_HIGH) e por timer para envio periódico.
- **Watchdog** (TWDT) ligado.

---

## 11. Comissionamento passo a passo

Ferramentas: fonte de bancada 0–30 V com limite de corrente, multímetro, de preferência um osciloscópio, segundo nó LoRa (ou gateway) e um chip GSM ativo.

| Fase | Teste | Como fazer | Critério de aprovação |
|---|---|---|---|
| 0 | Inspeção | Placa sem módulos: conferir polaridade de D1/D2/D4–D9 e dos eletrolíticos; continuidade da lista da seção 7 | Sem curto entre +24V_PROT, +5V, 3V3, V_SOL e GND |
| 1 | Entrada | Fonte 24 V, limite 300 mA, só a entrada (sem VR) | +24V_PROT = 23,6 V ± 0,2; com a polaridade invertida: corrente ≈ 0 |
| 2 | Reguladores | Ligar VR1 e VR2 sem carga | VR1 = 5,00 V; VR2 = 12,0 V; repetir com a entrada em 12 V e 30 V |
| 3 | ESP32 | Só o ESP32 no +5V; gravar firmware de teste | 3V3 = 3,30 ± 0,1 V; boot normal; consumo ~50–80 mA em 5 V |
| 4 | Boot com tudo | Todos os módulos montados; desligar e ligar 20 vezes | ESP32 inicia todas as vezes; **solenoides não estalam no boot** (R5/R6) |
| 5 | VBAT/KL15 | Fonte em 12 / 24 / 28,8 / 32 V; KL15 em 0 e 24 V | Erro da leitura de VBAT < 2 %; KL15 detectado nos dois estados |
| 6 | Fins de curso | Acionar SW1/SW2; puxar e balançar o cabo | Estados corretos; nenhuma troca falsa com o cabo mexendo |
| 7 | Solenoides | Comando destravar, 3 s, cada trava e as duas juntas; 10 ciclos | V_SOL ≥ 11,5 V durante o pulso; linguetas recolhem; temperatura da bobina tolerável ao toque; intervalo e limite de pulsos respeitados |
| 8 | RTC | Varredura I2C | Respostas em 0x68 e 0x57; hora mantida após desligar |
| 9 | SD + LoRa juntos | 1000 ciclos alternando escrita no SD e transmissão LoRa | Zero erros. Se falhar: trocar o módulo SD por um sem buffer ou isolar o MISO do SD (A18) |
| 10 | GPS | Sentenças NMEA no G34 a 9600 bps; ao ar livre | Fix em < 2 min (partida a frio) |
| 11 | GSM | `AT`, `AT+CSQ`, `AT+CREG?`, envio de SMS; osciloscópio no pino 5V do módulo durante a transmissão | CSQ > 10; registrado (0,1 ou 0,5); SMS recebido; **5V ≥ 4,6 V** nos picos |
| 12 | LoRa | Troca de pacotes com o segundo nó; teste de alcance | Versão do chip lida = 0x12; RSSI e alcance registrados |
| 13 | Caminhão: alimentação | Instalar com F0 e F1; medir consumo com ignição desligada; dar partida 10 vezes | Consumo parado anotado (meta < 25 mA em 24 V); ESP32 **não reinicia** na partida (ou reinicia sem acionar nada) |
| 14 | Caminhão: funcional | Destravar por app/LoRa/SMS; abrir e fechar a tampa; simular violação | Trava fecha sozinha; estado TRAVADO confirmado; alarme e SMS na violação; eventos gravados no SD |

---

## 12. Pendências e riscos para o protótipo Beta

1. **Confirmações abertas:** P1–P7 (seção 2), em especial o modelo exato da mini trava (tensão, corrente, fail-secure, lingueta), a serigrafia do LoRa e a versão do SIM800L.
2. **2G:** planejar a troca do SIM800L por 4G Cat-1 (A7670SA) ou Cat-M (SIM7080G).
3. **Consumo parado:** no alfa, GPS e GSM ficam sempre alimentados (~0,5–1 Ah/dia). No Beta, cortar a alimentação deles por MOSFET quando a ignição estiver desligada.
4. **Segurança física:** os fios do solenoide e do sensor são o ponto de ataque. No Beta: cabo blindado/armado, sensor de tampa adicional e tamper na caixa.
5. **SD × LoRa:** se o teste da fase 9 falhar, passar o SD para um barramento separado (ex.: SPI por software) no Beta.
6. **PCB:** no Beta, desenhar uma placa com TVS, fusível, conectores automotivos e plano de terra; deixar módulos só para LoRa/GSM/GPS.
7. **Script `generate_cad_diagram.py`:** tem os erros A01, A03–A06 e A11. Não regenerar o REV03 a partir dele.

---

## Anexo A: memória de cálculo

**Divisor VBAT/KL15 (150k/10k):** k = 10 / (150 + 10) = 0,0625.

| Bateria | ADC |
|---|---|
| 12,6 V | 0,79 V |
| 14,4 V | 0,90 V |
| 24,0 V | 1,50 V |
| 28,8 V | 1,80 V |
| 32,0 V | 2,00 V |

Fica abaixo de 2,45 V (faixa linear do ESP32 com atenuação 11/12 dB). Corrente no divisor a 32 V: 0,2 mA. Com 60 V (transiente), a corrente que entra no clamp é (60 − 3,3) / 150k = 0,38 mA, desprezível para o BAT43.

**Por que não o zener do R3:** um zener de 3,3 V tem corrente de fuga de dezenas de µA bem abaixo de 3,3 V. Com 100 kΩ em série, essa fuga distorce a leitura. Além disso, no R3 ele estava invertido (conduzia direto, ~0,7 V).

**Pull-up dos fins de curso:** 3,3 V / 4,7 kΩ = 0,7 mA de corrente de molhamento no microswitch, o suficiente para limpar o contato. Filtro: τ = 4,7 kΩ × 100 nF ≈ 0,5 ms. O 1 kΩ em série protege o GPIO de transientes do cabo.

**Pull-down do TRIG:** 10 kΩ mantém o MOSFET desligado enquanto o GPIO está em alta impedância (boot); consome 0,33 mA com a saída em nível alto.

**Flyback:** sem o diodo, a abertura da bobina (L·di/dt) gera picos de dezenas a centenas de volts no dreno do D4184 (40 V). O 1N4007 limita a ~13 V. O desligamento fica um pouco mais lento (~10–30 ms), irrelevante para a trava.

**F1:** pior caso no lado 24 V ≈ 1,55 A (seção 4.3) → fusível de 3 A com ~2× de margem. Em 12 V ≈ 3,1 A → 5 A.

**TVS:** P6KE36CA, tensão de trabalho 30,8 V (não conduz na carga normal de 28,8 V), ruptura ~34–38 V, grampeamento ~50 V no pulso nominal. Por isso C1 passa para 63 V, e o LM2596HV (60 V) fica protegido.

**VR1:** pico de 2,6 A em 5 V. O LM2596 de "3 A" entrega ~2–2,5 A contínuos sem dissipador. Com dissipador e com o C_GSM absorvendo as rajadas do GSM, atende. Se aquecer demais no teste da fase 11, passe o GSM para um buck dedicado.

## Anexo B: coordenadas de referência do desenho

O desenho R3 usa as mesmas coordenadas do script REV03 (unidade = mm, escala 1:1). Pontos para conferência com `_ID`:

| Ponto | X | Y |
|---|---|---|
| Canto inf. esq. da caixa do VR1 | 45 | 440 |
| Terminal +24V_PROT | 290 | 715 |
| J1 pino 1 (KL30) / 2 (KL15) / 3 (GND) | 65 | 715 / 675 / 640 |
| Caixa do ESP32 (cantos) | 370 / 590 | 245 / 795 |
| Pinos do ESP32, lado direito | 590 | G23=679, G22=653, G21=627, G19=601, G18=575, G5=549, G4=523, G2=497, G15=471, G16=419, G17=393 |
| Pinos do ESP32, lado esquerdo | 370 | 3V3=705, G36=653, G39=627, G34=601, G35=575, G32=549, G33=523, G25=497, G26=471, G27=445, G14=419, G12=393, G13=367, VIN=315 |
| Pinos LoRa (X=635) | 635 | 3V3=725, GND=710, NSS=695, SCK=680, MOSI=665, MISO=650 |
| Pinos SD (X=635) | 635 | VCC=575, GND=560, CS=545, SCK=530, MOSI=515, MISO=500 |
| Pinos RTC (X=635) | 635 | VCC=430, GND=415, SDA=400, SCL=385 |
| Pinos GPS / GSM (X=635) | 635 | GPS: VCC=298, GND=284, TXD=270 · GSM: VCC=208, GND=194, TXD=180 |
| Tabela BOM | 830–1180 | 245,5–835 |
| Faixa da legenda/carimbo (topo) | — | 145 |
