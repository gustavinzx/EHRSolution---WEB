# Fabricação CAM / Impressão 3D - Trava EHR (Protótipo ALFA)

Arquivos G-code gerados no **OrcaSlicer 2.4.2** enviados pelo diretor de hardware Rafael (`PROTOTIPO ALFA/CAM`), fatiados e validados especificamente para impressoras Creality K1 Series com filamento **ABS** (alta resistência química a combustível diesel e estabilidade térmica automotiva):

| Arquivo G-code | Peça / Função | Impressora Alvo | Filamento | Temp. Bico / Mesa | Camadas / Altura Máx. | Tempo Estimado | Peso Material |
|---|---|---|---|---|---|---|---|
| `01 -  CORPO K1MAX.gcode` | Corpo principal de fixação da carcaça da Trava EHR | **Creality K1 Max** (mesa 300×300 mm) | ABS Genérico (1.04 g/cm³) | 260 °C / 100 °C | 761 camadas (182,64 mm) | 6h 17min 47s | 133,72 g (~44,8 m) |
| `02 - ATUADORES K1C.gcode` | Guias internas e suportes dos atuadores | **Creality K1C** (mesa 220×220 mm) | ABS Genérico (1.04 g/cm³) | 260 °C / 105 °C | 143 camadas (34,32 mm) | 3h 19min 12s | 57,92 g (~19,4 m) |
| `03 - BOCAL K1C.gcode` | Bocal / Flange de adaptação do tanque Ø4" | **Creality K1C** (mesa 220×220 mm) | ABS Genérico (1.04 g/cm³) | 260 °C / 105 °C | 221 camadas (53,04 mm) | 2h 20min 53s | 71,49 g (~24,0 m) |
| `04 RETRABALHO CONTRA TAMPA E PALHETA K1C.gcode` | Contra-tampa articulada e palhetas radiais retrabalhadas | **Creality K1C** (mesa 220×220 mm) | ABS Genérico (1.04 g/cm³) | 260 °C / 105 °C | 143 camadas (34,32 mm) | 2h 17min 12s | 41,64 g (~13,9 m) |

### Resumo Consolidado de Fabricação
- **Material Total Necessário:** 304,77 g de filamento ABS (1 carretel padrão de 1 kg é suficiente para fabricar 3 conjuntos completos).
- **Tempo Total de Impressão Acumulado:** 14h 15min 04s.
- **Preparação da Mesa:** Recomenda-se adesivo líquido ou fixador térmico específico para ABS e câmara fechada para evitar delaminação (*warping*).
