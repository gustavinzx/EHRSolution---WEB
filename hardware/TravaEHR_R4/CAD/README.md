# Modelos CAD de Montagem - Trava EHR (Revisão ALFA Q / P)

Arquivos de montagem mecânica (SolidWorks Assembly `.SLDASM`) enviados pelo diretor de hardware Rafael (`PROTOTIPO ALFA/MONTAGEM`):

| Arquivo | Descrição Técnica | Função no Protótipo |
|---|---|---|
| `AFA-Q-EHR-TTC.SLDASM` | Montagem geral da Trava de Tampa de Caminhão - Revisão Alfa Q | Conjunto mecânico final da carcaça, encaixe dos dois solenoides, fins de curso e canaletas de fiação |
| `ALFA P-EHR-TTC.SLDASM` | Montagem geral da Trava de Tampa de Caminhão - Revisão Alfa P | Revisão anterior de referência comparativa |
| `Solenoid_Lock_V3.SLDASM` | Subconjunto dos atuadores solenoide duplos (12V Fail-Secure) | Posicionamento das bobinas, curso da lingueta e suporte de fixação |

### Documentação de Montagem Relacionada
- **Guia Ilustrado de Montagem:** [`Guia_de_Montagem_Trava_EHR.pdf`](../Guia_de_Montagem_Trava_EHR.pdf) (34 páginas com os 13 passos de cabeamento e comissionamento).
- **Firmware ESP32:** [`TravaEHR_R4.ino`](../TravaEHR_R4.ino) (implementa o timing de 50ms entre solenoides, debounce de SW1/SW2 e telemetria).
