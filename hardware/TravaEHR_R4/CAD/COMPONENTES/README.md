# Componentes e Peças CAD - Trava EHR (Protótipo ALFA)

Conjunto de peças mecânicas modeladas em SolidWorks (`.SLDPRT`), arquivos intercambiáveis (`.step`, `.stl`, `.ipt`) e subconjuntos comerciais enviados pelo diretor de hardware Rafael (`PROTOTIPO ALFA/COMPONENTES`):

### Peças do Conjunto Principal (Bocal Ø4" e Articulações)
| Arquivo | Descrição | Função no Sistema |
|---|---|---|
| `0 - BOCAL TESTE Ø4POL.SLDPRT` | Bocal de teste para tanque de combustível Ø4" | Acoplamento no bocal de abastecimento do tanque do caminhão |
| `1 - TAMPA ARTICULADA Ø4POL.SLDPRT` | Tampa articulada principal Ø4" | Fechamento superior com eixo articulado e alojamento para mola |
| `2 - CONTRA TAMPA ARTICULADA Ø4POL.SLDPRT` | Contra-tampa articulada interna | Ranhuras de engate das linguetas dos solenoides e batentes dos fins de curso |
| `3 - MOTORREDUTOR TRAVA.SLDPRT` | Suporte e carcaça do motorredutor TT | *Legado R3* (substituído pelos solenoides duplos na revisão R4) |
| `4 - CORPO PROTEÇÃO TRAVA.SLDPRT` | Carcaça envoltória de proteção | Proteção física contra impactos, poeira e respingos de combustível |
| `5 - CABEÇA DE COMUNICAÇÃO.SLDPRT` | Cúpula superior de telemetria | Alojamento das antenas LoRa 915MHz, GPS, GSM e difusor do LED de status |
| `MONTAGEM TRAVA ALFA P1.SLDASM` | Montagem preliminar Alfa P1 | Montagem de estudo inicial |

### Subpastas Técnicas
1. **`COMERCIAL/`**: Contém o atuador solenoide comercial 12V fail-secure em formato CAD (`atuador trava.SLDPRT`, `Solenoid_Lock_V3.step`, `Solenoid_Lock_V3.SLDASM`).
2. **`MOLA TORCAO EHR/`**: Estudo paramétrico e malhas para impressão/fabricação da mola de torção de retorno nas bitolas de arame 1.0mm (`_t10.stl`), 1.2mm (`_t12.step`, `_t12.stl`) e 1.5mm (`_t15.stl`).
3. **`MOTORREDUTOR TRAVA/`**: Fotos de referência do motor DC amarelo com caixa de redução e modelo CAD `.step` do motor utilizado no protótipo R3.
