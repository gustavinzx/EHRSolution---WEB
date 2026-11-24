# -*- coding: utf-8 -*-
"""Gera R4_BLOCOS_NOVOS.dxf - blocos redesenhados da revisao R4 (Trava EHR).
Cada bloco e desenhado com o canto inferior esquerdo em (0,0) local e
deslocado para uma area propria do arquivo. Layers = nomes do desenho R3.
"""
import math

LAYERS = {
    '0': 7, 'CORPO_COMPONENTES': 7, 'TERMINAIS_PINOS': 4, 'TEXTO_PINAGEM': 7,
    'PWR_VEICULAR_24V': 1, 'PWR_REGULADA_5V': 30, 'PWR_LOGICA_3V3': 4,
    'PWR_GSM_5V': 20, 'PWR_SOLENOIDE_12V': 40, 'GND_CHASSI_TERRA': 8,
    'SINAIS_ACIONAMENTO': 2, 'SINAIS_SENSORES': 82, 'BOM_TABELA': 7,
    'LEGENDA_SIMBOLOGIA': 7, 'BUS_SPI_LORA_SD': 6,
}
DASHED = {'GND_CHASSI_TERRA'}

T = 'TEXTO_PINAGEM'


class Doc:
    def __init__(self):
        self.ents = []
        self.ox = 0.0
        self.oy = 0.0

    def origin(self, x, y):
        self.ox, self.oy = x, y

    def line(self, x1, y1, x2, y2, lay):
        self.ents.append(('LINE', lay, x1 + self.ox, y1 + self.oy, x2 + self.ox, y2 + self.oy))

    def circle(self, x, y, r, lay):
        self.ents.append(('CIRCLE', lay, x + self.ox, y + self.oy, r))

    def text(self, s, x, y, h, lay=T, align='L', rot=0.0):
        self.ents.append(('TEXT', lay, s, x + self.ox, y + self.oy, h, align, rot))

    def rect(self, x, y, w, h, lay):
        self.line(x, y, x + w, y, lay); self.line(x + w, y, x + w, y + h, lay)
        self.line(x + w, y + h, x, y + h, lay); self.line(x, y + h, x, y, lay)

    def poly(self, pts, lay, closed=False):
        for a, b in zip(pts, pts[1:]):
            self.line(a[0], a[1], b[0], b[1], lay)
        if closed:
            self.line(pts[-1][0], pts[-1][1], pts[0][0], pts[0][1], lay)

    # ---------------- simbolos ----------------
    def pin(self, x, y):
        self.circle(x, y, 1.2, 'TERMINAIS_PINOS')

    def junction(self, x, y, lay):
        self.circle(x, y, 1.5, lay)
        self.circle(x, y, 0.75, lay)

    def gnd(self, x, y, lead=6.0):
        L = 'GND_CHASSI_TERRA'
        self.line(x, y, x, y - lead, L)
        b = y - lead
        self.line(x - 7, b, x + 7, b, L)
        self.line(x - 4, b - 3, x + 4, b - 3, L)
        self.line(x - 2, b - 6, x + 2, b - 6, L)

    def gnd_small(self, x, y):
        L = 'GND_CHASSI_TERRA'
        self.line(x, y, x, y - 2, L)
        self.line(x - 4, y - 2, x + 4, y - 2, L)
        self.line(x - 2.5, y - 3.5, x + 2.5, y - 3.5, L)
        self.line(x - 1, y - 5, x + 1, y - 5, L)

    def res_v(self, x, ytop, ybot, lay, label=None, lh=2.4, body=10.0, w=4.6):
        mid = (ytop + ybot) / 2.0
        b1, b2 = mid + body / 2, mid - body / 2
        self.line(x, ytop, x, b1, lay)
        self.rect(x - w / 2, b2, w, body, lay)
        self.line(x, b2, x, ybot, lay)
        if label:
            self.text(label, x + w / 2 + 1.5, mid - lh / 2, lh)

    def res_h(self, xl, xr, y, lay, label=None, lh=2.4, body=12.0, w=4.6):
        mid = (xl + xr) / 2.0
        self.line(xl, y, mid - body / 2, y, lay)
        self.rect(mid - body / 2, y - w / 2, body, w, lay)
        self.line(mid + body / 2, y, xr, y, lay)
        if label:
            self.text(label, mid, y + w / 2 + 1.5, lh, align='C')

    def cap_v(self, x, ytop, ybot, lay, label=None, lh=2.4, gap=3.0, pw=7.0):
        mid = (ytop + ybot) / 2.0
        self.line(x, ytop, x, mid + gap / 2, lay)
        self.line(x - pw / 2, mid + gap / 2, x + pw / 2, mid + gap / 2, lay)
        self.line(x - pw / 2, mid - gap / 2, x + pw / 2, mid - gap / 2, lay)
        self.line(x, mid - gap / 2, x, ybot, lay)
        if label:
            self.text(label, x + pw / 2 + 1.5, mid - lh / 2, lh)

    def diode_v(self, x, y_anode, y_cath, lay, label=None, lh=2.2, tri=4.0, hw=3.0, schottky=False):
        """Diodo vertical: anodo em y_anode, catodo em y_cath (qualquer sentido)."""
        s = 1.0 if y_cath > y_anode else -1.0
        mid = (y_anode + y_cath) / 2.0
        ta = mid - s * tri / 2   # base do triangulo (lado anodo)
        tc = mid + s * tri / 2   # ponta (lado catodo)
        self.line(x, y_anode, x, ta, lay)
        self.poly([(x - hw, ta), (x + hw, ta), (x, tc)], lay, closed=True)
        self.line(x - hw, tc, x + hw, tc, lay)
        if schottky:
            self.line(x - hw, tc, x - hw, tc - s * 1.2, lay)
            self.line(x + hw, tc, x + hw, tc + s * 1.2, lay)
        self.line(x, tc, x, y_cath, lay)
        if label:
            self.text(label, x + hw + 1.5, mid - lh / 2, lh)

    def switch_na(self, x, y, lay='SINAIS_SENSORES'):
        """Chave NA horizontal com terminais em x-7 e x+7."""
        self.circle(x - 7, y, 1.2, lay)
        self.circle(x + 7, y, 1.2, lay)
        self.line(x - 6, y, x + 5, y + 5, lay)

    def solenoid(self, x, y, w=26.0, h=16.0, lay='SINAIS_ACIONAMENTO'):
        """Atuador solenoide (IEC 60617): retangulo com faixa diagonal e embolo."""
        self.rect(x, y, w, h, lay)
        self.line(x + 4, y, x + 10, y + h, lay)
        self.line(x + 7, y, x + 13, y + h, lay)
        # embolo / lingueta
        self.rect(x + w, y + h / 2 - 1.8, 7, 3.6, lay)


def build():
    d = Doc()
    A = 'SINAIS_ACIONAMENTO'
    VS = 'PWR_SOLENOIDE_12V'
    S = 'SINAIS_SENSORES'
    P24 = 'PWR_VEICULAR_24V'
    SPI = 'BUS_SPI_LORA_SD'

    # ================================================================
    # A) BLOCO [POTENCIA]  - area 370..590 x 155..235 (sem moldura, como no R3)
    # ================================================================
    d.origin(370, 155)
    d.text('[POTENCIA] 2x DRIVER D4184 + MINI TRAVAS SOLENOIDE', 6, 71, 3.2)
    d.line(84, 63, 98, 63, VS)
    d.pin(98, 63)
    d.text('V_SOL +12V (VR2 - BLOCO 2)', 101, 62, 2.4, VS)
    chans = [(36.0, 'G25', '1', 'R5', 'D4', 'SOL1'), (8.0, 'G26', '2', 'R6', 'D5', 'SOL2')]
    for yb, gpio, n, rpd, dfb, sol in chans:
        ys = yb + 16
        d.pin(6, ys)
        d.text(f'{gpio} -> TRIG{n} ({sol})', 3, ys + 2.2, 2.0, A)
        d.line(6, ys, 40, ys, A)
        d.junction(22, ys, A)
        d.res_v(22, ys, yb + 4, A, f'{rpd} 10k', lh=2.0, body=6.0, w=3.6)
        d.gnd_small(22, yb + 4)
        d.rect(40, yb + 2, 40, 20, 'CORPO_COMPONENTES')
        d.text(f'M{n} D4184', 43, yb + 17.5, 2.3)
        d.text('TRIG', 42, ys - 2.6, 1.8)
        d.text('GND', 42, yb + 5.3, 1.8)
        d.pin(40, ys)
        d.pin(40, yb + 6)
        d.line(40, yb + 6, 34, yb + 6, 'GND_CHASSI_TERRA')
        d.gnd_small(34, yb + 6)
        for py, lb in ((yb + 20, 'VIN+'), (yb + 16, 'OUT+'), (yb + 8, 'OUT-'), (yb + 4, 'VIN-')):
            d.pin(80, py)
            d.text(lb, 78.5, py - 0.9, 1.8, align='R')
        d.line(80, yb + 20, 84, yb + 20, VS)
        d.line(84, yb + 20, 84, 63, VS)
        d.line(80, yb + 4, 92, yb + 4, 'GND_CHASSI_TERRA')
        d.gnd_small(92, yb + 4)
        d.line(80, yb + 16, 140, yb + 16, A)
        d.line(80, yb + 8, 140, yb + 8, A)
        d.junction(115, yb + 16, A)
        d.junction(115, yb + 8, A)
        d.diode_v(115, yb + 8, yb + 16, A, f'{dfb} 1N4007', lh=1.8, tri=3.6, hw=2.6)
        d.pin(140, yb + 16)
        d.pin(140, yb + 8)
        d.text('+', 136.5, yb + 17.2, 2.0, A)
        d.text('-', 136.5, yb + 4.2, 2.0, A)
        d.line(140, yb + 16, 146, yb + 16, A)
        d.line(140, yb + 8, 146, yb + 8, A)
        d.solenoid(146, yb + 4, w=24, h=16, lay=A)
        d.text(sol, 160, yb + 10.8, 2.4, A)
        d.text('MINI TRAVA 12V', 179, yb + 14.2, 1.9)
        d.text('FAIL-SECURE', 179, yb + 10.4, 1.9)
        d.text(f'J{1 + int(n)} / SW{n}', 179, yb + 6.6, 1.9)
    d.junction(84, 56, VS)

    # ================================================================
    # B) BLOCO 3 - area 25..330 x 155..360 (sem moldura)
    # ================================================================
    d.origin(25, 155)
    d.text('[BLOCO 3] MONITOR VBAT / IGNICAO (ADC) & FINS DE CURSO', 5, 192, 3.8)

    def adc_row(y, sub, src, r_top, r_bot, cap, d_up, d_dn, dest, rsub_y):
        d.text(sub, 5, rsub_y, 2.4)
        d.text(src, 5, y + 3.2, 2.4, P24)
        d.line(5, y, 26, y, P24)
        d.res_h(26, 50, y, S, r_top, lh=2.2)
        d.line(50, y, 290, y, S)
        d.junction(62, y, S)
        d.res_v(62, y, y - 18, S, r_bot, lh=2.2)
        d.gnd(62, y - 18, lead=2)
        d.junction(84, y, S)
        d.cap_v(84, y, y - 16, S, cap, lh=2.2)
        d.gnd(84, y - 16, lead=4)
        d.junction(140, y, S)
        d.diode_v(140, y, y + 14, S, d_up, lh=2.0, schottky=True)
        d.line(135, y + 14, 145, y + 14, 'PWR_LOGICA_3V3')
        d.text('+3.3V', 147, y + 13, 2.2, 'PWR_LOGICA_3V3')
        d.diode_v(140, y - 16, y, S, d_dn, lh=2.0, schottky=True)
        d.gnd(140, y - 16, lead=3)
        d.pin(290, y)
        d.text(dest, 170, y + 3.2, 2.6, S)

    adc_row(163, 'MONITOR BATERIA: DIVISOR 150k/10k (32V -> 2,0V) + 100nF + CLAMP BAT43',
            '+24V_PROT', 'R1 150k 1%', 'R2 10k 1%', 'C3 100nF',
            'D6 BAT43', 'D7 BAT43', 'VBAT_ADC -> ESP32 G32', 183)
    adc_row(110, 'IGNICAO KL15: SO LEITURA (KL15 NAO ALIMENTA A PLACA)',
            'KL15 (J1-2)', 'R7 150k 1%', 'R8 10k 1%', 'C4 100nF',
            'D8 BAT43', 'D9 BAT43', 'KL15_SENSE -> ESP32 G39 (VN)', 129)
    d.text('FINS DE CURSO DAS LINGUETAS (NA - FECHA C/ LINGUETA ESTENDIDA = TRAVADA):', 110, 64, 2.3)
    for y, sw, rpu, rs, c, dest in ((54.0, 'SW1 (LINGUETA SOL1)', 'R3 4k7', 'R9 1k', 'C5 100nF',
                                     'FC_TRAVA1 -> ESP32 G35'),
                                    (24.0, 'SW2 (LINGUETA SOL2)', 'R4 4k7', 'R10 1k', 'C6 100nF',
                                     'FC_TRAVA2 -> ESP32 G36 (VP)')):
        rail = y - 8
        d.switch_na(25, y)
        d.text(sw, 4, y + 6.5, 2.3)
        d.line(18, y, 18, rail, 'GND_CHASSI_TERRA')
        d.line(10, rail, 84, rail, 'GND_CHASSI_TERRA')
        d.gnd(10, rail, lead=3)
        d.line(32, y, 290, y, S)
        d.junction(45, y, S)
        d.res_v(45, y + 17, y, S, rpu, lh=2.1, body=8.0, w=3.8)
        d.line(41, y + 17, 49, y + 17, 'PWR_LOGICA_3V3')
        d.text('+3.3V', 51, y + 16, 2.1, 'PWR_LOGICA_3V3')
        d.junction(84, y, S)
        d.cap_v(84, y, rail, S, None, gap=2.0, pw=6.0)
        d.text(c, 87.5, y - 5.6, 2.0)
        d.junction(84, rail, 'GND_CHASSI_TERRA')
        d.res_h(200, 220, y, S, rs, lh=2.1, body=8.0, w=3.6)
        d.pin(290, y)
        d.text(dest, 228, y + 3.0, 2.5, S)
    d.text('Cabo par trancado ate a trava; C5/C6 no conector da placa', 110, 3.5, 2.0)

    # ================================================================
    # C) BLOCO 1/2: nova alimentacao do VR1 + VR2 + KL15 + GSM 5V
    # ================================================================
    d.origin(0, 0)
    # VR1 passa a ser alimentado pelo +24V_PROT (antes vinha do KL30 bruto)
    d.line(290, 715, 315, 715, P24)
    d.line(315, 715, 315, 580, P24)
    d.junction(315, 618, P24)
    d.line(315, 580, 35, 580, P24)
    d.line(35, 580, 35, 495, P24)
    d.text('+24V_PROT -> VR1 (IN+)', 60, 582.5, 2.4, P24)
    # KL15 como sinal
    d.line(65, 675, 80, 675, P24)
    d.pin(80, 675)
    d.text('KL15 -> BLOCO 3 (R7)', 83, 674, 2.4, P24)
    # GSM: D3 removido (jumper) no layer do GSM
    d.line(188, 415, 202, 415, 'PWR_GSM_5V')
    # VR2 (origem 200,588)
    d.origin(200, 588)
    d.rect(0, 0, 95, 36, 'CORPO_COMPONENTES')
    d.text('VR2 BUCK LM2596HV', 4, 21, 2.6)
    d.text('Vin 4,5-60V | Vout 12,0V 3A', 4, 15.5, 2.0)
    for (x, y, lb, al) in ((95, 30, 'IN+', 'R'), (95, 8, 'IN-', 'R'), (0, 30, 'OUT+ (12V)', 'L'),
                           (0, 8, 'OUT-', 'L')):
        d.pin(x, y)
        d.text(lb, x - 2 if al == 'R' else x + 2, y - 3.6, 2.0, align=al)
    d.line(95, 30, 115, 30, P24)
    d.line(95, 8, 102, 8, 'GND_CHASSI_TERRA')
    d.gnd(102, 8, lead=2)
    d.line(0, 30, -18, 30, VS)
    d.junction(-10, 30, VS)
    d.cap_v(-10, 30, 8, VS, None, gap=2.6, pw=6.0)
    d.text('+', -6.5, 21.5, 2.0, VS)
    d.text('C_SOL', -32, 20, 2.0)
    d.text('470uF/25V', -32, 16.5, 2.0)
    d.line(0, 8, -10, 8, 'GND_CHASSI_TERRA')
    d.junction(-10, 8, 'GND_CHASSI_TERRA')
    d.gnd(-10, 8, lead=2)
    d.pin(-18, 30)
    d.text('V_SOL', -30, 32, 2.4, VS)

    # ================================================================
    # D) BARRAMENTOS SPI - novas colunas (elimina curtos do R3)
    # ================================================================
    d.origin(0, 0)
    # LORA_NSS (G5): coluna x=600
    d.line(590, 549, 600, 549, SPI); d.line(600, 549, 600, 695, SPI); d.line(600, 695, 635, 695, SPI)
    # SCK (G18): coluna x=630
    d.line(590, 575, 630, 575, SPI); d.line(630, 530, 630, 680, SPI)
    d.line(630, 680, 635, 680, SPI); d.line(630, 530, 635, 530, SPI); d.junction(630, 575, SPI)
    # SD_CS (G13): coluna x=595
    d.line(355, 235, 595, 235, SPI); d.line(595, 235, 595, 545, SPI); d.line(595, 545, 635, 545, SPI)

    # ================================================================
    # E) MODULOS: pinos e rotulos novos (LoRa, SD, GPS, GSM)
    # ================================================================
    def rpin(y, txt, lay):
        d.pin(800, y)
        d.text(txt, 797, y - 1.2, 2.4, lay, align='R')
    rpin(710, 'DIO0 -> ESP32 G4', SPI)
    rpin(695, 'RESET <- ESP32 G27', SPI)
    d.text('R11 10k p/ 3V3', 666, 693.6, 2.0, SPI)
    d.text('C_LORA 100uF + C8 100nF', 666, 723.6, 2.0, 'PWR_LOGICA_3V3')
    d.text('R12 10k p/ 3V3', 666, 543.6, 2.0, SPI)
    rpin(284, 'RXD <- ESP32 G33', 'BUS_UART_TELEMETRIA')
    rpin(208, 'VDD (NIVEL) <- 3V3', 'PWR_LOGICA_3V3')
    rpin(194, 'RXD <- ESP32 G17', 'BUS_UART_TELEMETRIA')
    rpin(180, 'RST: NC', T)

    # ================================================================
    # F) BOM R4 - 350 x 589,5 com canto inf. esq. em (830, 245,5)
    # ================================================================
    d.origin(830, 245.5)
    bw, bh = 350.0, 589.5
    B = 'BOM_TABELA'
    d.rect(0, 0, bw, bh, B)
    d.text('LISTA DE MATERIAIS / BILL OF MATERIALS (BOM) - REV. 04', 10, bh - 15, 4.5)
    d.line(0, bh - 22, bw, bh - 22, B)
    for x, s_ in ((4, 'IT'), (21, 'QTD'), (41, 'REF'), (75, 'COMPONENTE / MODELO'),
                  (190, 'ESPECIFICACAO TECNICA / APLICACAO')):
        d.text(s_, x, bh - 32, 3.0)
    d.line(0, bh - 37, bw, bh - 37, B)
    items = BOM_ITEMS
    row_y = bh - 47.5
    step = 15.0
    for i, (q, ref, comp, spec) in enumerate(items, 1):
        d.text(f'{i:02d}', 4, row_y, 2.6, B)
        d.text(q, 25, row_y, 2.6, B)
        d.text(ref, 40, row_y, 2.4, B)
        d.text(comp, 73, row_y, 2.5, B)
        d.text(spec, 188, row_y, 2.2, B)
        d.line(0, row_y - 4.5, bw, row_y - 4.5, B)
        row_y -= step
    tab_bot = row_y + step - 4.5
    for x in (18, 38, 70, 185):
        d.line(x, tab_bot, x, bh - 22, B)
    ny = tab_bot - 8.5
    d.text('NOTAS DE REVISAO R4:', 4, ny, 3.0)
    for k, s_ in enumerate(NOTAS):
        d.text(s_, 4, ny - 7.0 * (k + 1), 2.3)

    # ================================================================
    # G) SIMBOLOS DA LEGENDA (fora da folha) - mover p/ a legenda
    # ================================================================
    for cx, cy in ((1300, 100), (1300, 60)):
        d.origin(0, 0)
        d.line(cx - 3, cy, cx + 3, cy, '0'); d.line(cx, cy - 3, cx, cy + 3, '0')
    d.origin(1300, 100)
    d.solenoid(-12, -6, w=18, h=12, lay=A)
    d.text('Mini Trava Solenoide', 22, 1, 2.8)
    d.text('Fail-secure 12V (V_SOL)', 22, -6, 2.3)
    d.origin(1300, 60)
    d.diode_v(0, -7, 7, S, None, schottky=True)
    d.text('Diodo Schottky BAT43', 22, 1, 2.8)
    d.text('Clamp ADC (3V3 / GND)', 22, -6, 2.3)
    d.origin(0, 0)
    d.text('SIMBOLOS P/ LEGENDA: COPYBASE pela cruz e colar no centro do simbolo antigo', 1250, 130, 3.0, '0')
    d.text('Apagar as cruzes (layer 0) depois de posicionar', 1250, 122, 2.5, '0')
    return d


BOM_ITEMS = [
    ('1', 'U1', 'ESP32 DEVKIT V1 (WROOM-32)', 'MCU 240MHz WiFi/BLE - conferir 30 ou 38 pinos'),
    ('1', 'U2', 'LORA RA-01H / RFM95W (SX1276)', '915-928MHz SPI + antena SMA 915 (pigtail IPEX)'),
    ('1', 'U3', 'GPS NEO-6M (GY-GPS6MV2)', 'UART 9600bps, VCC 3-5V, antena ceramica'),
    ('1', 'U4', 'SIM800L EVB V2.0 (5V)', 'GSM/GPRS UART, VDD=3V3 (nivel), pico 2A'),
    ('1', 'U5', 'RTC DS3231 (ZS-042)', 'I2C 3V3 + CR2032 - remover circuito de carga'),
    ('1', 'U6', 'MODULO MICRO SD (SPI)', 'VCC 5V; testar MISO junto com o LoRa'),
    ('1', 'VR1', 'BUCK LM2596HV 5,0V 3A', 'Vin 4,5-60V + dissipador - logica e GSM'),
    ('1', 'VR2', 'BUCK LM2596HV 12,0V 3A', 'Vin 4,5-60V - alimentacao solenoides V_SOL'),
    ('2', 'M1,M2', 'MODULO MOSFET D4184', 'Chave low-side 1 canal p/ solenoide (TRIG 3V3)'),
    ('2', 'SOL1,2', 'MINI TRAVA SOLENOIDE 12V', 'Fail-secure, lingueta chanfrada, pulso <=5s'),
    ('2', 'SW1,2', 'MICROSWITCH KW12 NA', 'Fim de curso lingueta SOL1 / SOL2'),
    ('1', 'F1', 'FUSIVEL MINI ATO 3A', 'Porta-fusivel estanque (5A em caminhao 12V)'),
    ('1', 'F0', 'FUSIVEL EM LINHA 5A', 'Junto a bateria (protecao do chicote KL30)'),
    ('1', 'D1', 'TVS P6KE36CA', 'Bidirecional 600W - transientes ISO 7637-2'),
    ('1', 'D2', 'SCHOTTKY 1N5822', '3A 40V - anti-inversao de polaridade'),
    ('2', 'D4,D5', 'DIODO 1N4007', 'Flyback na bobina de cada solenoide (K no +)'),
    ('4', 'D6..D9', 'SCHOTTKY BAT43 (DO-35)', 'Clamp ADC ao 3V3/GND (VBAT e KL15)'),
    ('1', 'C1', 'ELETROLITICO 470uF 63V', 'Filtro entrada +24V_PROT, low ESR'),
    ('1', 'C_GSM', 'ELETROLITICO 1000uF 16V', 'Buffer pico 2A junto ao pino 5V do SIM800L'),
    ('1', 'C_SOL', 'ELETROLITICO 470uF 25V', 'Saida do VR2 (V_SOL)'),
    ('1', 'C_LORA', 'ELETROLITICO 100uF 10V', 'Junto ao pino 3V3 do modulo LoRa'),
    ('7', 'C2..C8', 'CERAMICO 100nF 50V', 'C2 entr., C3 VBAT, C4 KL15, C5/C6 FC, C7 GSM, C8 LoRa'),
    ('2', 'R1,R7', 'RESISTOR 150k 1% 1/4W', 'Divisor VBAT / KL15 (parte superior)'),
    ('2', 'R2,R8', 'RESISTOR 10k 1% 1/4W', 'Divisor VBAT / KL15 (parte inferior)'),
    ('2', 'R3,R4', 'RESISTOR 4k7 5% 1/4W', 'Pull-up fins de curso ao 3V3'),
    ('2', 'R5,R6', 'RESISTOR 10k 5% 1/4W', 'Pull-down TRIG D4184 (G25 / G26)'),
    ('2', 'R9,R10', 'RESISTOR 1k 5% 1/4W', 'Serie GPIO fins de curso (G35 / G36)'),
    ('2', 'R11,R12', 'RESISTOR 10k 5% 1/4W', 'Pull-up LORA_NSS (G5) e SD_CS (G13)'),
    ('1', 'J1', 'BORNE AUTOMOTIVO 3P 5,08', '1: KL30  2: KL15 (sinal)  3: GND chassi'),
    ('4', 'J2..J5', 'CONECTOR 2 VIAS TRAVADO', 'J2/J3 solenoides, J4/J5 fins de curso'),
    ('1', 'BZ1,Q1', 'BUZZER 5V + 2N2222', 'Alarme G15 (R13 1k base, R14 10k B-E) - opc.'),
    ('3', 'ANT1..3', 'ANTENAS LORA/GSM/GPS', 'LoRa 915 SMA, GSM quad-band, GPS ceramica'),
]
NOTAS = [
    'R4.1 Atuador: motor TT/ponte H substituido por 2 mini travas solenoide + 2 D4184.',
    'R4.2 VR1 alimentado do +24V_PROT (R3 ligava direto no KL30, sem F1/D1/D2).',
    'R4.3 Corrigidos curtos de barramento: MISO x SD_CS, SCK x 3V3, NSS x SDA.',
    'R4.4 DZ1 (invertido) trocado por clamp BAT43; divisor VBAT 150k/10k.',
    'R4.5 KL15 so como sinal (G39). GSM SIM800L V2.0 em 5V; D3 removido.',
    'R4.6 G2=LED, G27=LORA_RST, G14/G12 sem uso. Rotulos iguais = mesmo no.',
]


def export(d, path):
    out = []
    w = out.append
    w('0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n')
    w('0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLTYPE\n70\n2\n')
    w('0\nLTYPE\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0.0\n')
    w('0\nLTYPE\n2\nDASHED\n70\n0\n3\nDashed __ __\n72\n65\n73\n2\n40\n10.0\n49\n6.0\n49\n-4.0\n')
    w('0\nENDTAB\n0\nTABLE\n2\nLAYER\n70\n%d\n' % len(LAYERS))
    for n, c in LAYERS.items():
        w('0\nLAYER\n2\n%s\n70\n0\n62\n%d\n6\n%s\n' % (n, c, 'DASHED' if n in DASHED else 'CONTINUOUS'))
    w('0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n')
    for e in d.ents:
        if e[0] == 'LINE':
            _, L, x1, y1, x2, y2 = e
            w('0\nLINE\n8\n%s\n10\n%.3f\n20\n%.3f\n30\n0.0\n11\n%.3f\n21\n%.3f\n31\n0.0\n' % (L, x1, y1, x2, y2))
        elif e[0] == 'CIRCLE':
            _, L, x, y, r = e
            w('0\nCIRCLE\n8\n%s\n10\n%.3f\n20\n%.3f\n30\n0.0\n40\n%.3f\n' % (L, x, y, r))
        else:
            _, L, s, x, y, h, al, rot = e
            w('0\nTEXT\n8\n%s\n10\n%.3f\n20\n%.3f\n30\n0.0\n40\n%.3f\n1\n%s\n' % (L, x, y, h, s))
            if rot:
                w('50\n%.1f\n' % rot)
            if al in ('C', 'R'):
                w('72\n%d\n11\n%.3f\n21\n%.3f\n31\n0.0\n' % (1 if al == 'C' else 2, x, y))
    w('0\nENDSEC\n0\nEOF\n')
    with open(path, 'w', encoding='ascii', errors='strict') as f:
        f.write(''.join(out))


def preview(d, path):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    col = {'PWR_VEICULAR_24V': '#d00', 'PWR_REGULADA_5V': '#e80', 'PWR_LOGICA_3V3': '#0aa',
           'PWR_SOLENOIDE_12V': '#c50', 'GND_CHASSI_TERRA': '#777', 'SINAIS_ACIONAMENTO': '#b90',
           'SINAIS_SENSORES': '#2a2', 'TERMINAIS_PINOS': '#0aa', '0': '#00f'}
    fig, ax = plt.subplots(figsize=(30, 30))
    for e in d.ents:
        c = col.get(e[1], '#111')
        if e[0] == 'LINE':
            ax.plot([e[2], e[4]], [e[3], e[5]], color=c, lw=0.6)
        elif e[0] == 'CIRCLE':
            ax.add_patch(plt.Circle((e[2], e[3]), e[4], fill=False, color=c, lw=0.5))
        else:
            _, L, s, x, y, h, al, rot = e
            ha = {'L': 'left', 'C': 'center', 'R': 'right'}[al]
            ax.text(x, y, s, fontsize=h * 2.05, color=c, ha=ha, va='baseline',
                    family='DejaVu Sans Condensed' if False else 'sans-serif', rotation=rot)
    ax.set_aspect('equal'); ax.axis('off')
    fig.savefig(path, dpi=110, bbox_inches='tight')


if __name__ == '__main__':
    import sys
    doc = build()
    export(doc, sys.argv[1])
    preview(doc, sys.argv[2])
    print('ok', len(doc.ents))
