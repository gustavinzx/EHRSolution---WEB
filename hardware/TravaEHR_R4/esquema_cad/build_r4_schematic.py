# -*- coding: utf-8 -*-
"""
Script de automação para compilação e montagem da Revisão R4 da Trava EHR.
Lê o esquema R3 base (ESQUEMA_ELETRICO_LORA_TRAVA_EHR_REV03.dxf),
aplica com rigor as remoções, substituições e integrações especificadas
em DESCRITIVO_TECNICO_R4_TRAVA_EHR.md e gera:
  1. R4 FLUXOGRAMA COMUNICACAO LORA E SISTEMA DE BLOQUEIO EHR.dxf (CAD completo R4)
  2. R4 FLUXOGRAMA COMUNICACAO LORA E SISTEMA DE BLOQUEIO EHR.png (Render de alta resolução)
  3. R4 FLUXOGRAMA COMUNICACAO LORA E SISTEMA DE BLOQUEIO EHR-Model.pdf (PDF para plotagem)
  4. R4 FLUXOGRAMA COMUNICACAO LORA E SISTEMA DE BLOQUEIO EHR.dwg (Cópia base do DWG)
"""

import os
import shutil
import ezdxf
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

DIR_R4 = r"g:\Meu Drive\PLB_INTERNO\PLB - Operacional\EHR TRAVA ABASTECIMENTO TANQUE CAMINHAO\PROTOTIPO ALFA\FLUXOGRAMA\ALFA R4"
DIR_R3 = r"g:\Meu Drive\PLB_INTERNO\PLB - Operacional\EHR TRAVA ABASTECIMENTO TANQUE CAMINHAO\PROTOTIPO ALFA\FLUXOGRAMA\ALFA R3"
DIR_SUPERADOS = r"g:\Meu Drive\PLB_INTERNO\PLB - Operacional\EHR TRAVA ABASTECIMENTO TANQUE CAMINHAO\PROTOTIPO ALFA\FLUXOGRAMA\SUPERADOS"

PATH_R3_DXF = os.path.join(DIR_SUPERADOS, "ESQUEMA_ELETRICO_LORA_TRAVA_EHR_REV03.dxf")
PATH_R3_DWG = os.path.join(DIR_R3, "R3 FLUXOGRAMA COMUNICAÇÃOLORA E SISTEMA DE BLOQUEIO EHRdwg.dwg")
PATH_BLOCKS_R4_DXF = os.path.join(DIR_R4, "R4_BLOCOS_NOVOS.dxf")

OUT_DXF = os.path.join(DIR_R4, "R4 FLUXOGRAMA COMUNICACAO LORA E SISTEMA DE BLOQUEIO EHR.dxf")
OUT_DWG = os.path.join(DIR_R4, "R4 FLUXOGRAMA COMUNICACAO LORA E SISTEMA DE BLOQUEIO EHR.dwg")
OUT_PNG = os.path.join(DIR_R4, "R4 FLUXOGRAMA COMUNICACAO LORA E SISTEMA DE BLOQUEIO EHR.png")
OUT_PDF = os.path.join(DIR_R4, "R4 FLUXOGRAMA COMUNICACAO LORA E SISTEMA DE BLOQUEIO EHR-Model.pdf")

def in_box(x, y, x1, y1, x2, y2):
    return (x1 - 0.05 <= x <= x2 + 0.05) and (y1 - 0.05 <= y <= y2 + 0.05)

def build_r4():
    print("Iniciando compilação do Esquema Elétrico R4...")
    
    # 0. Copiar DWG base conforme especificado na Seção 0 do MD
    if os.path.exists(PATH_R3_DWG):
        shutil.copy2(PATH_R3_DWG, OUT_DWG)
        print(f"Copiado DWG R3 -> {OUT_DWG}")
    
    # 1. Carregar DXF R3 base e DXF de blocos R4
    doc_r3 = ezdxf.readfile(PATH_R3_DXF)
    msp_r3 = doc_r3.modelspace()
    
    doc_blocks = ezdxf.readfile(PATH_BLOCKS_R4_DXF)
    msp_blocks = doc_blocks.modelspace()
    
    # 2. Atualizar layers
    if 'PWR_GSM_4V' in doc_r3.layers:
        l = doc_r3.layers.get('PWR_GSM_4V')
        l.dxf.name = 'PWR_GSM_5V'
        l.dxf.color = 20
        print("Layer PWR_GSM_4V renomeado para PWR_GSM_5V")
    
    if 'PWR_SOLENOIDE_12V' not in doc_r3.layers:
        doc_r3.layers.new('PWR_SOLENOIDE_12V', dxfattribs={'color': 40, 'linetype': 'CONTINUOUS'})
        print("Criado layer PWR_SOLENOIDE_12V (cor 40)")
        
    for e in msp_r3:
        if e.dxf.layer == 'PWR_GSM_4V':
            e.dxf.layer = 'PWR_GSM_5V'
            
    # 3. Identificar e remover entidades superadas (Seção 5.1 do MD)
    to_delete = []
    
    for e in msp_r3:
        t = e.dxftype()
        # 5.1.1 Bloco [POTENCIA] inteiro (362,158 a 598,233)
        if t == 'TEXT' and in_box(e.dxf.insert.x, e.dxf.insert.y, 362, 158, 598, 233):
            to_delete.append(e)
        elif t == 'LINE' and in_box(e.dxf.start.x, e.dxf.start.y, 362, 158, 598, 233) and in_box(e.dxf.end.x, e.dxf.end.y, 362, 158, 598, 233):
            to_delete.append(e)
        elif t == 'CIRCLE' and in_box(e.dxf.center.x, e.dxf.center.y, 362, 158, 598, 233):
            to_delete.append(e)

        # 5.1.2 Bloco 3 inteiro (18,150 a 333,360)
        elif t == 'TEXT' and in_box(e.dxf.insert.x, e.dxf.insert.y, 18, 150, 333, 360):
            to_delete.append(e)
        elif t == 'LINE' and in_box(e.dxf.start.x, e.dxf.start.y, 18, 150, 333, 360) and in_box(e.dxf.end.x, e.dxf.end.y, 18, 150, 333, 360):
            to_delete.append(e)
        elif t == 'CIRCLE' and in_box(e.dxf.center.x, e.dxf.center.y, 18, 150, 333, 360):
            to_delete.append(e)

        # 5.1.3 Tabela BOM inteira (828,193 a 1182,837)
        elif t == 'TEXT' and in_box(e.dxf.insert.x, e.dxf.insert.y, 828, 193, 1182, 837):
            to_delete.append(e)
        elif t == 'LINE' and in_box(e.dxf.start.x, e.dxf.start.y, 828, 193, 1182, 837) and in_box(e.dxf.end.x, e.dxf.end.y, 828, 193, 1182, 837):
            # Preserva a moldura externa da prancha
            if not (abs(e.dxf.start.x - 1180) < 0.2 and abs(e.dxf.end.x - 1180) < 0.2) and not (abs(e.dxf.start.y - 835) < 0.2 and abs(e.dxf.end.y - 835) < 0.2):
                to_delete.append(e)

        # 5.1.4 Diodo D3 e texto 'D3 1N5822' (187.5,409 a 202.5,425)
        elif t == 'TEXT' and in_box(e.dxf.insert.x, e.dxf.insert.y, 187.5, 409, 202.5, 425):
            to_delete.append(e)
        elif t == 'LINE' and in_box(e.dxf.start.x, e.dxf.start.y, 187.5, 409, 202.5, 425) and in_box(e.dxf.end.x, e.dxf.end.y, 187.5, 409, 202.5, 425):
            to_delete.append(e)

        # 5.1.5 Fio vertical vermelho de (35,715) a (35,495)
        elif t == 'LINE' and abs(e.dxf.start.x - 35) < 0.2 and abs(e.dxf.end.x - 35) < 0.2 and abs(min(e.dxf.start.y, e.dxf.end.y) - 495) < 1.0 and abs(max(e.dxf.start.y, e.dxf.end.y) - 715) < 1.0:
            to_delete.append(e)

        # 5.1.6 Junção em (35,715)
        elif t == 'CIRCLE' and abs(e.dxf.center.x - 35) < 0.2 and abs(e.dxf.center.y - 715) < 0.2:
            to_delete.append(e)

        # Fios sobrepostos de barramento
        elif t == 'LINE':
            p1 = (round(e.dxf.start.x, 1), round(e.dxf.start.y, 1))
            p2 = (round(e.dxf.end.x, 1), round(e.dxf.end.y, 1))
            pts = {p1, p2}
            # 5.1.7 NSS
            if pts in [{(590.0, 549.0), (610.0, 549.0)}, {(610.0, 549.0), (610.0, 695.0)}, {(610.0, 695.0), (635.0, 695.0)}]:
                to_delete.append(e)
            # 5.1.8 SCK
            elif pts in [{(590.0, 575.0), (625.0, 575.0)}, {(625.0, 575.0), (625.0, 680.0)}, {(625.0, 680.0), (635.0, 680.0)},
                         {(625.0, 575.0), (625.0, 530.0)}, {(625.0, 530.0), (635.0, 530.0)}]:
                to_delete.append(e)
            # 5.1.9 SD_CS
            elif pts in [{(355.0, 235.0), (620.0, 235.0)}, {(620.0, 235.0), (620.0, 545.0)}, {(620.0, 545.0), (635.0, 545.0)}]:
                to_delete.append(e)

        # 5.1.8 junção SCK em (625, 575)
        elif t == 'CIRCLE' and abs(e.dxf.center.x - 625) < 0.2 and abs(e.dxf.center.y - 575) < 0.2:
            to_delete.append(e)

        # 5.11 Legenda - Símbolo Motor antigo em (680, 59)
        elif t == 'CIRCLE' and abs(e.dxf.center.x - 680) < 0.5 and abs(e.dxf.center.y - 59) < 0.5:
            to_delete.append(e)
        elif t == 'TEXT' and e.dxf.text == 'M' and abs(e.dxf.insert.x - 680) < 0.5 and abs(e.dxf.insert.y - 55.5) < 1.0:
            to_delete.append(e)
        elif t == 'CIRCLE' and abs(e.dxf.center.y - 59) < 0.5 and (abs(e.dxf.center.x - 673) < 0.5 or abs(e.dxf.center.x - 687) < 0.5):
            to_delete.append(e)
            
        # 5.11 Legenda - Símbolo Zener antigo em (520, 107)
        elif t == 'LINE' and in_box(e.dxf.start.x, e.dxf.start.y, 515, 100, 525, 114) and in_box(e.dxf.end.x, e.dxf.end.y, 515, 100, 525, 114):
            to_delete.append(e)

    for e in to_delete:
        msp_r3.delete_entity(e)
    print(f"Removidas {len(to_delete)} entidades superadas com sucesso.")

    # 4. Integrar blocos novos do R4_BLOCOS_NOVOS.dxf
    #    Para a área G (símbolos da legenda fora da folha X >= 1200):
    #    - O solenoide (ref 1300, 100) move para (680, 59) -> dx=-620, dy=-41
    #    - O BAT43 (ref 1300, 60) move para (520, 107) -> dx=-780, dy=+47
    #    - Textos e cruzes da área G são descartados
    inserted_count = 0
    for e in msp_blocks:
        t = e.dxftype()
        lay = e.dxf.layer
        if t == 'LINE':
            # Verificar se está na Área G (X >= 1200)
            if e.dxf.start.x >= 1200:
                if lay == '0':
                    continue # cruzes descartadas
                elif lay == 'SINAIS_ACIONAMENTO': # solenoide
                    dx, dy = -620.0, -41.0
                elif lay == 'SINAIS_SENSORES': # diodo BAT43
                    dx, dy = -780.0, +47.0
                else:
                    continue
            else:
                dx, dy = 0.0, 0.0
            
            p1 = (e.dxf.start.x + dx, e.dxf.start.y + dy, e.dxf.start.z)
            p2 = (e.dxf.end.x + dx, e.dxf.end.y + dy, e.dxf.end.z)
            msp_r3.add_line(p1, p2, dxfattribs={'layer': lay})
            inserted_count += 1
            
        elif t == 'CIRCLE':
            dx, dy = 0.0, 0.0
            center = (e.dxf.center.x + dx, e.dxf.center.y + dy, e.dxf.center.z)
            msp_r3.add_circle(center, e.dxf.radius, dxfattribs={'layer': lay})
            inserted_count += 1
            
        elif t == 'TEXT':
            if e.dxf.insert.x >= 1200:
                continue # Textos auxiliares fora da folha são descartados
            dx, dy = 0.0, 0.0
            insert = (e.dxf.insert.x + dx, e.dxf.insert.y + dy, e.dxf.insert.z)
            attribs = {'layer': lay, 'height': e.dxf.height, 'rotation': e.dxf.rotation, 'insert': insert}
            txt_e = msp_r3.add_text(e.dxf.text, dxfattribs=attribs)
            txt_e.dxf.halign = e.dxf.halign
            txt_e.dxf.valign = e.dxf.valign
            if e.dxf.hasattr('align_point') and e.dxf.align_point is not None:
                txt_e.dxf.align_point = (e.dxf.align_point.x + dx, e.dxf.align_point.y + dy, e.dxf.align_point.z)
            inserted_count += 1
            
    print(f"Inseridas {inserted_count} entidades dos blocos R4.")

    # 5. Aplicar todas as substituições textuais nas entidades restantes
    text_replacements = {
        # Bloco 1 (Entrada)
        '2: +24V (KL15)': '2: KL15 (SINAL)',
        'D1 (P6KE36A)': 'D1 P6KE36CA',
        'C1 470uF/50V': 'C1 470uF/63V',
        
        # Bloco 2 (Reguladores e GSM)
        '[BLOCO 2] REGULADOR DC-DC STEP-DOWN & CONDICIONADOR GSM': '[BLOCO 2] REGULADORES DC-DC (VR1 5V / VR2 12V) & BUFFER GSM',
        'MODULO DC-DC STEP-DOWN': 'VR1 BUCK LM2596HV',
        'LM2596 HV / MP1584': 'Vin 4,5-60V / Vout 5,0V 3A',
        'Vin: 9-36V | Vout: 5.0V 3A': '+ DISSIPADOR (LOGICA + GSM)',
        '+4.1V_GSM (SIM800L VCC)': '+5V_GSM (SIM800L V2.0 - PINO 5V)',
        'C_GSM 1000uF': 'C_GSM 1000uF/16V + C7 100nF',
        
        # Bloco ESP32
        'IO -> LORA_RST': 'LED STATUS (ONBOARD)',
        'IO_RES (STATUS LED)': 'IO -> LORA_RST',
        'SENSOR_VP <- FC_DESTRAV': 'FC_TRAVA2 (SW2) - POLLING',
        'SENSOR_VN (RESERVA)': 'KL15_SENSE (IGNICAO)',
        'INPUT ONLY <- FC_TRAVADO': 'FC_TRAVA1 (SW1)',
        'ADC1_CH4 <- SINAL_VBAT': 'ADC1_CH4 <- VBAT_ADC',
        'DAC1 -> DRV_GATE1 (ABRIR)': 'SAIDA -> TRIG1 D4184 (SOL1)',
        'DAC2 -> DRV_GATE2 (FECHAR)': 'SAIDA -> TRIG2 D4184 (SOL2)',
        'PWM -> DRV_VELOCIDADE': 'LIVRE (PWM NO BOOT)',
        'HSPI_MISO (RESERVA)': 'NC - PINO DE BOOT',
        'HSPI_MOSI -> SD_CS': 'IO -> SD_CS (R12)',
        'VSPI CS -> LORA_NSS': 'VSPI CS -> LORA_NSS (R11)',
        'HSPI_CS / BUZZER ALARME': 'IO -> BUZZER Q1 (OPCIONAL)',
        'ENTRADA +5.0V STEP-DOWN': 'ENTRADA +5.0V (VR1)',
        'ESP32 DEVKIT V1 (38 PINOS) - DUAL CORE 240MHz': 'ESP32 DEVKIT V1 (WROOM-32) - DIAGRAMA LOGICO',
        
        # Módulos Periféricos (Blocos 4 a 7)
        'MODULO LORA RA-02': 'MODULO LORA RA-01H / RFM95W',
        'SX1276 915MHz SPI + CSS': 'SX1276 915-928MHz SPI (AU915)',
        'Buffer 74LVC125 SPI FAT32': 'SPI FAT32 - VCC 5V (REG. ONBOARD)',
        'MODEM GSM SIM800L': 'MODEM GSM SIM800L V2.0 (5V)',
        'VCC (+4.1V GSM)': '5V <- +5V_GSM',
        
        # Legenda de Simbologia
        'Motor DC Redutor TT': 'Mini Trava Solenoide',
        'Trava 3 palhetas 120 graus': 'Fail-secure 12V (V_SOL)',
        'Diodo Zener 3.3V': 'Diodo Schottky BAT43',
        'Clamp sobretensao ADC': 'Clamp ADC (3V3 / GND)',
        'Supressao indutiva motor': 'Supressao indutiva solenoide',
        'Diodo TVS P6KE36A': 'Diodo TVS P6KE36CA',
        'Sensoriamento mecanico': 'Lingueta travada = contato fechado',
        
        # Carimbo
        'REV: REV. 03': 'REV: REV. 04',
        'DATA: 10/2026': 'DATA: 23/10/2026',
        'TITULO: ESQUEMA ELETRICO E TELEMETRIA LORA': 'TITULO: ESQUEMA ELETRICO - COMUNICACAO LORA/GSM & TRAVA SOLENOIDE',
        'DWG/DXF: ESQUEMA_ELETRICO_LORA_TRAVA_EHR.DXF': 'DWG/DXF: R4 FLUXOGRAMA COMUNICACAO LORA E SISTEMA DE BLOQUEIO EHR.dwg',
        
        # Notas técnicas de engenharia
        '2. SUPRESSAO TRANSIENTES: Diodo TVS P6KE36A absorve picos de carga': '2. SUPRESSAO TRANSIENTES: Diodo TVS P6KE36CA absorve picos de carga',
        '5. MECANICA DA TRAVA: Acionamento radial com 3 palhetas giratorias': '5. MECANICA DA TRAVA: 2 mini travas solenoide 12V fail-secure (bobina <= 1A).',
        '   (120 graus). Fim de curso calibrado p/ parada precisa via firmware.': '   Lingueta chanfrada c/ travamento automatico e contato SW1/SW2 NA.'
    }
    
    rep_count = 0
    for e in msp_r3:
        if e.dxftype() == 'TEXT':
            cur = e.dxf.text.strip()
            for old_t, new_t in text_replacements.items():
                if cur == old_t:
                    e.dxf.text = new_t
                    rep_count += 1
                    break
                    
    print(f"Substituições de texto aplicadas: {rep_count}")
    
    # Adicionar texto opcional/recomendado F0 na bateria
    msp_r3.add_text('F0 5A NO CHICOTE (JUNTO A BATERIA)', dxfattribs={
        'layer': 'PWR_VEICULAR_24V',
        'height': 2.2,
        'insert': (12.0, 722.0, 0.0)
    })
    
    # 6. Salvar DXF final
    doc_r3.saveas(OUT_DXF)
    print(f"DXF R4 salvo com sucesso em: {OUT_DXF}")
    
    # 7. Renderizar Preview de Alta Resolução em PNG e PDF
    print("Gerando preview de alta resolução...")
    col = {
        'PWR_VEICULAR_24V': '#cc0000',
        'PWR_REGULADA_5V': '#ee7700',
        'PWR_LOGICA_3V3': '#0099aa',
        'PWR_GSM_5V': '#ddaa00',
        'PWR_SOLENOIDE_12V': '#c05000',
        'GND_CHASSI_TERRA': '#666666',
        'SINAIS_ACIONAMENTO': '#b08800',
        'SINAIS_SENSORES': '#229922',
        'TERMINAIS_PINOS': '#0099aa',
        'TEXTO_TITULOS': '#c08800',
        'TEXTO_SUBTITULOS': '#227722',
        'TEXTO_PINAGEM': '#111111',
        'TEXTO_NOTAS': '#007788',
        'BOM_TABELA': '#111111',
        'MOLDURA_PRANCHA': '#111111',
        'CARIMBO_ABNT': '#111111',
        'LEGENDA_SIMBOLOGIA': '#111111',
        'CORPO_COMPONENTES': '#222222',
        'BUS_SPI_LORA_SD': '#bb00bb',
        'BUS_I2C_RTC': '#228822',
        'BUS_UART_TELEMETRIA': '#0055cc',
        '0': '#0000cc',
    }
    
    fig, ax = plt.subplots(figsize=(32, 22.6), dpi=120)
    fig.patch.set_facecolor('white')
    ax.set_facecolor('white')
    
    for e in msp_r3:
        lay = e.dxf.layer
        c = col.get(lay, '#222222')
        t = e.dxftype()
        if t == 'LINE':
            ls = '--' if lay == 'GND_CHASSI_TERRA' else '-'
            lw = 0.9 if 'PWR' in lay or 'MOLDURA' in lay or 'BUS' in lay else 0.6
            ax.plot([e.dxf.start.x, e.dxf.end.x], [e.dxf.start.y, e.dxf.end.y],
                    color=c, lw=lw, linestyle=ls)
        elif t == 'CIRCLE':
            ax.add_patch(plt.Circle((e.dxf.center.x, e.dxf.center.y), e.dxf.radius,
                                    fill=False, color=c, lw=0.6))
        elif t == 'TEXT':
            rot = e.dxf.rotation
            halign = e.dxf.halign
            ha = 'center' if halign == 1 else ('right' if halign == 2 else 'left')
            px = e.dxf.align_point.x if halign != 0 and e.dxf.hasattr('align_point') and e.dxf.align_point is not None else e.dxf.insert.x
            py = e.dxf.align_point.y if halign != 0 and e.dxf.hasattr('align_point') and e.dxf.align_point is not None else e.dxf.insert.y
            fs = max(3.5, e.dxf.height * 2.1)
            weight = 'bold' if 'TITULO' in lay or 'CARIMBO' in lay else 'normal'
            ax.text(px, py, e.dxf.text, fontsize=fs, color=c, ha=ha, va='baseline',
                    rotation=rot, fontweight=weight, family='sans-serif')
                    
    ax.set_xlim(5, 1195)
    ax.set_ylim(5, 845)
    ax.set_aspect('equal')
    ax.axis('off')
    
    plt.subplots_adjust(left=0.01, right=0.99, top=0.99, bottom=0.01)
    fig.savefig(OUT_PNG, dpi=130, bbox_inches='tight')
    fig.savefig(OUT_PDF, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"PNG gerado em: {OUT_PNG}")
    print(f"PDF gerado em: {OUT_PDF}")
    print("Processo R4 concluído com sucesso!")

if __name__ == '__main__':
    build_r4()
