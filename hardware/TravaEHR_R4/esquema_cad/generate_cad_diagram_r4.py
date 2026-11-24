# -*- coding: utf-8 -*-
"""
Gerador de Diagrama Eletrico Industrial DXF para AutoCAD (Revisao 04)
Projeto: TRAVA ELETRÔNICA DE ABASTECIMENTO TANQUE CAMINHÃO EHR
Cliente/Setor: PLB Operacional - Sistema EHR
Autoria: dj (ANON / MAHI68)
Data: 23/10/2026
Formato: DXF AutoCAD R12 (Compativel com AutoCAD 2000 a 2027)

Atualizacoes Rev 04:
- Substituicao de atuador: 2 mini travas solenoide 12V fail-secure + 2 drivers MOSFET D4184
- Regulador VR1 (5V) alimentado por +24V_PROT (corrigida falha de protecao do R3)
- Adicao do regulador VR2 (LM2596HV 12V 3A) para alimentacao das solenoides (rede V_SOL)
- Separacao das colunas verticais do barramento SPI/I2C (eliminados curtos do R3)
- Monitor de bateria e ignicao KL15 com divisor 150k/10k, filtro 100nF e clamp Schottky BAT43
- Fins de curso com pull-up 4k7, filtro 100nF e resistor serie de 1k (imunidade a ruido)
- SIM800L V2.0 direto em 5V com buffer 1000uF + 100nF (removido diodo D3)
- LoRa SX1276 Ra-01H / RFM95W (915-928MHz AU915) com pinos DIO0 e RESET roteados
- Pinagem ESP32 corrigida para respeitar strapping pins de boot (G2, G12, G14)
- BOM completa com 32 itens atualizados e 6 notas de revisao R4
"""

import os
import sys

class DXFDocument:
    def __init__(self, filepath):
        self.filepath = filepath
        self.entities = []
        self.layers = {
            '0': (7, 'CONTINUOUS'),
            'MOLDURA_PRANCHA': (7, 'CONTINUOUS'),
            'CARIMBO_ABNT': (7, 'CONTINUOUS'),
            'LEGENDA_SIMBOLOGIA': (7, 'CONTINUOUS'),
            'PWR_VEICULAR_24V': (1, 'CONTINUOUS'),      # Vermelho (12V/24V)
            'PWR_REGULADA_5V': (30, 'CONTINUOUS'),      # Laranja (5.0V)
            'PWR_LOGICA_3V3': (4, 'CONTINUOUS'),        # Ciano (3.3V)
            'PWR_GSM_5V': (20, 'CONTINUOUS'),           # Amarelo/Dourado (5.0V GSM)
            'PWR_SOLENOIDE_12V': (40, 'CONTINUOUS'),    # Castanho/Laranja Escuro (12V Solenoide)
            'GND_CHASSI_TERRA': (8, 'DASHED'),          # Cinza Escuro
            'BUS_SPI_LORA_SD': (6, 'CONTINUOUS'),       # Magenta (SPI)
            'BUS_I2C_RTC': (3, 'CONTINUOUS'),           # Verde (I2C)
            'BUS_UART_TELEMETRIA': (5, 'CONTINUOUS'),   # Azul (UART GPS/GSM)
            'SINAIS_ACIONAMENTO': (2, 'CONTINUOUS'),    # Amarelo (Drivers Solenoide)
            'SINAIS_SENSORES': (82, 'CONTINUOUS'),      # Verde Claro (Fins de curso e ADC)
            'CORPO_COMPONENTES': (7, 'CONTINUOUS'),     # Branco
            'TERMINAIS_PINOS': (4, 'CONTINUOUS'),       # Ciano
            'TEXTO_TITULOS': (2, 'CONTINUOUS'),         # Amarelo
            'TEXTO_SUBTITULOS': (3, 'CONTINUOUS'),      # Verde
            'TEXTO_PINAGEM': (7, 'CONTINUOUS'),         # Branco
            'TEXTO_NOTAS': (4, 'CONTINUOUS'),           # Ciano
            'BOM_TABELA': (7, 'CONTINUOUS')             # Branco
        }

    def line(self, x1, y1, x2, y2, layer='0'):
        self.entities.append(('LINE', layer, float(x1), float(y1), float(x2), float(y2)))

    def circle(self, cx, cy, r, layer='0'):
        self.entities.append(('CIRCLE', layer, float(cx), float(cy), float(r)))

    def junction(self, cx, cy, r=1.5, layer='0'):
        self.circle(cx, cy, r, layer)
        self.circle(cx, cy, r * 0.5, layer)

    def terminal_pin(self, cx, cy, r=1.2, layer='TERMINAIS_PINOS'):
        self.circle(cx, cy, r, layer)

    def text(self, txt, x, y, height=3.5, layer='0', align='LEFT', rotation=0):
        clean_txt = str(txt).replace('\n', ' ')
        self.entities.append(('TEXT', layer, clean_txt, float(x), float(y), float(height), align, float(rotation)))

    def rect(self, x, y, w, h, layer='0'):
        self.line(x, y, x + w, y, layer)
        self.line(x + w, y, x + w, y + h, layer)
        self.line(x + w, y + h, x, y + h, layer)
        self.line(x, y + h, x, y, layer)

    def gnd_symbol(self, x, y, layer='GND_CHASSI_TERRA', lead=6.0):
        self.line(x, y, x, y - lead, layer)
        b = y - lead
        self.line(x - 7, b, x + 7, b, layer)
        self.line(x - 4, b - 3, x + 4, b - 3, layer)
        self.line(x - 2, b - 6, x + 2, b - 6, layer)

    def gnd_small(self, x, y, layer='GND_CHASSI_TERRA'):
        self.line(x, y, x, y - 2, layer)
        self.line(x - 4, y - 2, x + 4, y - 2, layer)
        self.line(x - 2.5, y - 3.5, x + 2.5, y - 3.5, layer)
        self.line(x - 1, y - 5, x + 1, y - 5, layer)

    def diode_symbol(self, x, y, direction='RIGHT', label='1N5822', layer='PWR_VEICULAR_24V', text_h=2.8):
        if direction == 'RIGHT':
            self.line(x - 7, y, x - 3, y, layer)
            self.line(x + 3, y, x + 7, y, layer)
            self.line(x - 3, y - 4, x - 3, y + 4, layer)
            self.line(x - 3, y + 4, x + 3, y, layer)
            self.line(x - 3, y - 4, x + 3, y, layer)
            self.line(x + 3, y - 4.5, x + 3, y + 4.5, layer)
            if label:
                self.text(label, x, y + 6.0, text_h, 'TEXTO_NOTAS', align='CENTER')
        elif direction == 'DOWN':
            self.line(x, y + 7, x, y + 3, layer)
            self.line(x, y - 3, x, y - 7, layer)
            self.line(x - 4, y + 3, x + 4, y + 3, layer)
            self.line(x + 4, y + 3, x, y - 3, layer)
            self.line(x - 4, y + 3, x, y - 3, layer)
            self.line(x - 4.5, y - 3, x + 4.5, y - 3, layer)
            if label:
                self.text(label, x + 6.5, y - 1.0, text_h, 'TEXTO_NOTAS')

    def diode_v(self, x, y_anode, y_cath, layer='SINAIS_SENSORES', label=None, lh=2.0, tri=4.0, hw=3.0, schottky=False):
        s = 1.0 if y_cath > y_anode else -1.0
        mid = (y_anode + y_cath) / 2.0
        ta = mid - s * tri / 2
        tc = mid + s * tri / 2
        self.line(x, y_anode, x, ta, layer)
        # Triângulo
        self.line(x - hw, ta, x + hw, ta, layer)
        self.line(x - hw, ta, x, tc, layer)
        self.line(x + hw, ta, x, tc, layer)
        # Barra de catodo
        self.line(x - hw, tc, x + hw, tc, layer)
        if schottky:
            self.line(x - hw, tc, x - hw, tc - s * 1.2, layer)
            self.line(x + hw, tc, x + hw, tc + s * 1.2, layer)
        self.line(x, tc, x, y_cath, layer)
        if label:
            self.text(label, x + hw + 1.5, mid - lh / 2, lh, 'TEXTO_NOTAS')

    def tvs_symbol(self, x, y, layer='PWR_VEICULAR_24V', label='P6KE36CA', text_h=2.8):
        self.line(x, y + 8, x, y + 4, layer)
        self.line(x, y - 4, x, y - 8, layer)
        self.line(x - 3.5, y + 4, x + 3.5, y + 4, layer)
        self.line(x - 3.5, y + 4, x, y + 0.5, layer)
        self.line(x + 3.5, y + 4, x, y + 0.5, layer)
        self.line(x - 3.5, y, x + 3.5, y, layer)
        self.line(x - 3.5, y, x - 3.5, y + 2, layer)
        self.line(x + 3.5, y, x + 3.5, y - 2, layer)
        self.line(x - 3.5, y - 4, x + 3.5, y - 4, layer)
        self.line(x - 3.5, y - 4, x, y - 0.5, layer)
        self.line(x + 3.5, y - 4, x, y - 0.5, layer)
        if label:
            self.text(label, x + 6.5, y - 1.0, text_h, 'TEXTO_NOTAS')

    def fuse_symbol(self, x, y, w=14, h=5, label='F1 3A', layer='PWR_VEICULAR_24V', text_h=2.8):
        self.line(x - 6, y, x, y, layer)
        self.rect(x, y - h/2, w, h, layer)
        self.line(x, y, x + w, y, layer)
        self.line(x + w, y, x + w + 6, y, layer)
        if label:
            self.text(label, x + w/2, y + 4.5, text_h, 'TEXTO_NOTAS', align='CENTER')

    def cap_polar_symbol(self, x, y, label='470uF', layer='PWR_VEICULAR_24V', text_h=2.8):
        self.line(x, y + 8, x, y + 2, layer)
        self.line(x - 4.5, y + 2, x + 4.5, y + 2, layer)
        self.line(x - 4.5, y - 2, x + 4.5, y - 2, layer)
        self.line(x, y - 2, x, y - 8, layer)
        self.text('+', x + 4, y + 3.5, 2.8, layer)
        if label:
            self.text(label, x + 7.0, y - 1.0, text_h, 'TEXTO_NOTAS')

    def cap_ceramic_symbol(self, x, y, label='100nF', layer='CORPO_COMPONENTES', text_h=2.8):
        self.line(x, y + 7, x, y + 1.8, layer)
        self.line(x - 4.0, y + 1.8, x + 4.0, y + 1.8, layer)
        self.line(x - 4.0, y - 1.8, x + 4.0, y - 1.8, layer)
        self.line(x, y - 1.8, x, y - 7, layer)
        if label:
            self.text(label, x + 6.5, y - 1.0, text_h, 'TEXTO_NOTAS')

    def resistor_symbol(self, x, y, orientation='V', length=14, label='10k', layer='SINAIS_SENSORES', text_h=2.8):
        if orientation == 'V':
            self.line(x, y + length/2 + 4, x, y + length/2, layer)
            self.rect(x - 2.8, y - length/2, 5.6, length, layer)
            self.line(x, y - length/2, x, y - length/2 - 4, layer)
            if label:
                self.text(label, x + 4.5, y - 1.0, text_h, 'TEXTO_NOTAS')
        else:
            self.line(x - length/2 - 4, y, x - length/2, y, layer)
            self.rect(x - length/2, y - 2.8, length, 5.6, layer)
            self.line(x + length/2, y, x + length/2 + 4, y, layer)
            if label:
                self.text(label, x, y + 4.5, text_h, 'TEXTO_NOTAS', align='CENTER')

    def switch_symbol(self, x, y, label='FC_TRAVA1', state='NA', layer='SINAIS_SENSORES', text_h=2.8):
        self.terminal_pin(x - 7, y, 1.2, layer)
        self.terminal_pin(x + 7, y, 1.2, layer)
        if state == 'NA':
            self.line(x - 6.0, y, x + 5.0, y + 5.0, layer)
        else:
            self.line(x - 6.0, y, x + 6.0, y, layer)
        if label:
            self.text(label, x, y + 7.5, text_h, 'TEXTO_NOTAS', align='CENTER')

    def antenna_symbol(self, x, y, layer='BUS_SPI_LORA_SD', label='ANT 915MHz', text_h=2.8):
        self.line(x, y, x, y + 10, layer)
        self.line(x, y + 10, x - 4.5, y + 16, layer)
        self.line(x, y + 10, x + 4.5, y + 16, layer)
        self.line(x - 4.5, y + 16, x + 4.5, y + 16, layer)
        if label:
            self.text(label, x, y + 19, text_h, 'TEXTO_NOTAS', align='CENTER')

    def solenoid_symbol(self, x, y, w=24.0, h=16.0, label='SOL1', layer='SINAIS_ACIONAMENTO', text_h=2.4):
        self.rect(x, y, w, h, layer)
        self.line(x + 4, y, x + 10, y + h, layer)
        self.line(x + 7, y, x + 13, y + h, layer)
        self.rect(x + w, y + h / 2 - 1.8, 7, 3.6, layer)
        if label:
            self.text(label, x + w / 2, y + h / 2 - 1.0, text_h, layer, align='CENTER')

    def export(self):
        with open(self.filepath, 'w', encoding='ascii', errors='ignore') as f:
            f.write('0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n')
            f.write('0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLTYPE\n70\n2\n')
            f.write('0\nLTYPE\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0.0\n')
            f.write('0\nLTYPE\n2\nDASHED\n70\n0\n3\nDashed line __ __ __\n72\n65\n73\n2\n40\n10.0\n49\n6.0\n49\n-4.0\n')
            f.write('0\nENDTAB\n0\nTABLE\n2\nLAYER\n70\n' + str(len(self.layers)) + '\n')
            for name, (color, ltype) in self.layers.items():
                f.write(f'0\nLAYER\n2\n{name}\n70\n0\n62\n{color}\n6\n{ltype}\n')
            f.write('0\nENDTAB\n0\nENDSEC\n')
            f.write('0\nSECTION\n2\nENTITIES\n')
            for ent in self.entities:
                if ent[0] == 'LINE':
                    _, lay, x1, y1, x2, y2 = ent
                    f.write(f'0\nLINE\n8\n{lay}\n10\n{x1:.3f}\n20\n{y1:.3f}\n30\n0.0\n11\n{x2:.3f}\n21\n{y2:.3f}\n31\n0.0\n')
                elif ent[0] == 'CIRCLE':
                    _, lay, cx, cy, r = ent
                    f.write(f'0\nCIRCLE\n8\n{lay}\n10\n{cx:.3f}\n20\n{cy:.3f}\n30\n0.0\n40\n{r:.3f}\n')
                elif ent[0] == 'TEXT':
                    _, lay, txt, x, y, h, align, rot = ent
                    f.write(f'0\nTEXT\n8\n{lay}\n10\n{x:.3f}\n20\n{y:.3f}\n30\n0.0\n40\n{h:.3f}\n1\n{txt}\n')
                    if rot != 0:
                        f.write(f'50\n{rot:.1f}\n')
                    if align == 'CENTER':
                        f.write(f'72\n1\n11\n{x:.3f}\n21\n{y:.3f}\n31\n0.0\n')
                    elif align == 'RIGHT':
                        f.write(f'72\n2\n11\n{x:.3f}\n21\n{y:.3f}\n31\n0.0\n')
            f.write('0\nENDSEC\n0\nEOF\n')
        print(f"DXF exportado com sucesso: {self.filepath}")

if __name__ == '__main__':
    print("generate_cad_diagram_r4 modulo carregado com sucesso.")
