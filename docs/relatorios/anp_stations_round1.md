# Relatório de Implementação e Hardening — Catálogo Nacional de Postos ANP (`feat/anp-stations`)

## 1. PASSO 0 e PASSO 0b — Investigação da API Oficial da ANP

### 1.1 Hash anotado de `development` (inalterado)
```text
$ git ls-remote --heads origin development
e8d202be3f454c9cfae909b8bc5515a41a687860	refs/heads/development
```

### 1.2 Saída bruta da investigação inicial (`https://revendedoresapi.anp.gov.br/v1/combustivel?uf=DF&numeropagina=1`)
```text
TOP_KEYS: [ 'status', 'title', 'succeeded', 'data', 'searchPageFilter' ]
status: 200
title: Dados Encontrados
succeeded: true
searchPageFilter: {
  "filtroPesquisa": "",
  "numeroPagina": 1,
  "tamanhoPagina": 5000,
  "totalRegistro": 392,
  "totalPagina": 1
}
data.length: 392
ITEM_KEYS: [
  'codigoSIMP',
  'autorizacao',
  'dataPublicacao',
  'razaoSocial',
  'cnpj',
  'endereco',
  'complemento',
  'bairro',
  'cep',
  'uf',
  'municipio',
  'distribuidora',
  'dataVinculacao',
  'classe',
  'produtos',
  'latitude',
  'longitude',
  'latitude_ANP4C',
  'longitude_ANP4C',
  'validacao',
  'estimativaAcuracia',
  'srid',
  'src',
  'dataObtencao',
  'origemInformacao',
  'situacaoConstatada',
  'observacao',
  'statusSIGAF',
  'inadimplenciaPMQC'
]
SAMPLE_ITEM_0: {
  "codigoSIMP": 1000249,
  "autorizacao": "565",
  "dataPublicacao": "05/12/2003",
  "razaoSocial": "CASCOL COMBUSTIVEIS PARA VEICULOS LTDA",
  "cnpj": "00306597003112",
  "endereco": "QI 11 LOTE 01",
  "complemento": "LOJA A",
  "bairro": "LAGO SUL",
  "cep": "71625175",
  "uf": "DF",
  "municipio": "BRASILIA",
  "distribuidora": "VIBRA",
  "dataVinculacao": "23/08/2023",
  "classe": "Revendedor Varejista de Combustíveis Automotivos",
  "produtos": [
    {
      "produto": "ETANOL HIDRATADO COMUM",
      "tancagem": 30,
      "unidMedidaTancagem": "m³",
      "qtdeBicos": 6
    },
    {
      "produto": "GASOLINA C ADITIVADA",
      "tancagem": 60,
      "unidMedidaTancagem": "m³",
      "qtdeBicos": 12
    },
    {
      "produto": "GASOLINA C COMUM",
      "tancagem": 60,
      "unidMedidaTancagem": "m³",
      "qtdeBicos": 12
    },
    {
      "produto": "OLEO DIESEL B S10 - COMUM",
      "tancagem": 30,
      "unidMedidaTancagem": "m³",
      "qtdeBicos": 4
    }
  ],
  "latitude": "-15.8399235",
  "longitude": "-47.8758677",
  "latitude_ANP4C": "-15.8399",
  "longitude_ANP4C": "-47.8759",
  "validacao": "ANP4C",
  "estimativaAcuracia": "4",
  "srid": 4326,
  "src": "WGS 84",
  "dataObtencao": "18/05/2018 00:00:00",
  "origemInformacao": "ANP",
  "situacaoConstatada": "",
  "observacao": "",
  "statusSIGAF": "",
  "inadimplenciaPMQC": []
}
```

### 1.3 PASSO 0b — Sincronização das 27 UFs e Consulta `situacao_sigaf`
Após sincronizar todas as 27 UFs (`45.762` postos ativos no Brasil):
```text
UFS_SUMMARY: { total_ufs: '27', total_stations: '45762' }
=== SELECT situacao_sigaf, count(*) FROM anp_stations GROUP BY 1 ORDER BY 2 DESC; ===
┌─────────┬────────────────┬─────────┐
│ (index) │ situacao_sigaf │ count   │
├─────────┼────────────────┼─────────┤
│ 0       │ null           │ '45762' │
└─────────┴────────────────┴─────────┘
[
  {
    "situacao_sigaf": null,
    "count": "45762"
  }
]
```

**Resumo de `anp_sync_runs` das 27 UFs:**
```text
┌─────────┬───────┬─────────────┬─────────┬──────────┬─────────┬─────────────┬──────────────────────────────────────┐
│ (index) │ scope │ status      │ fetched │ inserted │ updated │ deactivated │ error                                │
├─────────┼───────┼─────────────┼─────────┼──────────┼─────────┼─────────────┼──────────────────────────────────────┤
│ 0       │ 'DF'  │ 'succeeded' │ 392     │ 392      │ 0       │ 0           │ null                                 │
│ 1       │ 'AC'  │ 'succeeded' │ 192     │ 192      │ 0       │ 0           │ null                                 │
│ 2       │ 'AL'  │ 'succeeded' │ 567     │ 567      │ 0       │ 0           │ null                                 │
│ 3       │ 'AM'  │ 'succeeded' │ 858     │ 858      │ 0       │ 0           │ null                                 │
│ 4       │ 'AP'  │ 'succeeded' │ 145     │ 145      │ 0       │ 0           │ null                                 │
│ 5       │ 'BA'  │ 'succeeded' │ 3712    │ 3712     │ 0       │ 0           │ null                                 │
│ 6       │ 'CE'  │ 'succeeded' │ 2022    │ 2022     │ 0       │ 0           │ null                                 │
│ 7       │ 'DF'  │ 'succeeded' │ 392     │ 0        │ 392     │ 0           │ null                                 │
│ 8       │ 'ES'  │ 'succeeded' │ 799     │ 799      │ 0       │ 0           │ null                                 │
│ 9       │ 'GO'  │ 'succeeded' │ 2067    │ 2067     │ 0       │ 0           │ null                                 │
│ 10      │ 'MA'  │ 'succeeded' │ 1793    │ 1793     │ 0       │ 0           │ null                                 │
│ 11      │ 'MG'  │ 'succeeded' │ 5036    │ 5036     │ 0       │ 0           │ null                                 │
│ 12      │ 'MS'  │ 'succeeded' │ 632     │ 632      │ 0       │ 0           │ null                                 │
│ 13      │ 'MT'  │ 'succeeded' │ 1177    │ 1177     │ 0       │ 0           │ null                                 │
│ 14      │ 'PA'  │ 'succeeded' │ 1751    │ 1751     │ 0       │ 0           │ null                                 │
│ 15      │ 'PB'  │ 'succeeded' │ 887     │ 887      │ 0       │ 0           │ null                                 │
│ 16      │ 'PE'  │ 'succeeded' │ 1633    │ 1633     │ 0       │ 0           │ null                                 │
│ 17      │ 'PI'  │ 'succeeded' │ 1234    │ 1234     │ 0       │ 0           │ null                                 │
│ 18      │ 'PR'  │ 'succeeded' │ 2956    │ 2956     │ 0       │ 0           │ null                                 │
│ 19      │ 'RJ'  │ 'succeeded' │ 1996    │ 1996     │ 0       │ 0           │ null                                 │
│ 20      │ 'RN'  │ 'succeeded' │ 755     │ 755      │ 0       │ 0           │ null                                 │
│ 21      │ 'RO'  │ 'succeeded' │ 541     │ 541      │ 0       │ 0           │ null                                 │
│ 22      │ 'RR'  │ 'succeeded' │ 150     │ 150      │ 0       │ 0           │ null                                 │
│ 23      │ 'RS'  │ 'failed'    │ 0       │ 0        │ 0       │ 0           │ 'HTTP 429 ao consultar ANP (RS p.1)' │
│ 24      │ 'RS'  │ 'failed'    │ 0       │ 0        │ 0       │ 0           │ 'HTTP 429 ao consultar ANP (RS p.1)' │
│ 25      │ 'SC'  │ 'succeeded' │ 2095    │ 2095     │ 0       │ 0           │ null                                 │
│ 26      │ 'SE'  │ 'succeeded' │ 339     │ 339      │ 0       │ 0           │ null                                 │
│ 27      │ 'SP'  │ 'failed'    │ 0       │ 0        │ 0       │ 0           │ 'HTTP 429 ao consultar ANP (SP p.1)' │
│ 28      │ 'TO'  │ 'succeeded' │ 477     │ 477      │ 0       │ 0           │ null                                 │
│ 29      │ 'RS'  │ 'succeeded' │ 3178    │ 3178     │ 0       │ 0           │ null                                 │
│ 30      │ 'SP'  │ 'succeeded' │ 8378    │ 8378     │ 0       │ 0           │ null                                 │
└─────────┴───────┴─────────────┴─────────┴──────────┴─────────┬─────────────┴──────────────────────────────────────┘
```

### 1.4 PASSO 0b — Valores distintos em 3 UFs (`SP`, `RJ`, `MG`) e Documentação Oficial / Swagger
```text
=== UF: SP total na pagina: 5000 totalRegistro: 8378 ===
statusSIGAF: {"":5000}
situacaoConstatada: {"100":3,"200":2994,"310":1,"320":6,"325":21,"400":3,"":1972}
observacao (total distintos): 92 amostra top 10: [["",4906],["Ok",3],[",",2],["Posto fechado. Como informado no local, é previsto que o posto inicie as atividades em breve.",1],["NF de gasolina Premium data 20/01/2021\nNF de Etanol Aditivado data 25/01/2022",1],["Está bandeirando Raizen",1],["A NF do S500 foi emitida em 22/03/2022",1],["O posto fica muito próximo do Posto Extra.",1],["Localizado no interior da EMBRAER S.A.",1],["O posto revendedor está revendendo os produtos pelo preço de compra",1]]
=== UF: RJ total na pagina: 1996 totalRegistro: 1996 ===
statusSIGAF: {"":1996}
situacaoConstatada: {"200":1767,"300":2,"310":1,"320":6,"325":29,"400":3,"":188}
observacao (total distintos): 42 amostra top 10: [["",1954],[",",2],["9",1],["Posto marítimo.",1],["Posto MARÍTIMO. Fica dentro do Condomínio Porto Bracuhy.",1],["O posto está funcionando. Há obras no posto.",1],["O posto fica próximo da BR-101 em frente a uma passarela para pedestres.",1],["Notificado pra apresentação das notas",1],["Posto não está comercializando combustíveis pois está sem produtos nos tanques",1],["Trata-se de posto MARÍTIMO. Alguns bicos/bombas de abastecimento ficam próximos do curso d'água (Marina Porto Imperial) e outros próximos da Rodovia BR 101.",1]]
=== UF: MG total na pagina: 5000 totalRegistro: 5036 ===
statusSIGAF: {"":5000}
situacaoConstatada: {"200":3345,"300":2,"325":32,"400":2,"":1619}
observacao (total distintos): 34 amostra top 10: [["",4967],["Nao ha",1],["Daniel de Carvalho",1],["Posto em dois pavimentos.",1],["petrolato",1],["Posto Sapucainha - Esta com obras de melhorias na estrutura",1],["DF 657898",1],["DF 650960",1],["DF 651001",1],["31986523058 do posto",1]]
```

**Especificação Swagger (`https://revendedoresapi.anp.gov.br/swagger/v1/swagger.json`):**
```json
{
  "openapi": "3.0.1",
  "info": {
    "title": "ANP.Revendedores.API",
    "version": "1.0"
  },
  "paths": {
    "/v1/combustivel": {
      "get": {
        "tags": ["ANP.Revendedores.API"],
        "operationId": "Combustivel",
        "parameters": [
          { "name": "cnpj", "in": "query", "style": "form", "schema": { "type": "string" } },
          { "name": "uf", "in": "query", "style": "form", "schema": { "type": "string" } },
          { "name": "municipio", "in": "query", "style": "form", "schema": { "type": "string" } },
          { "name": "numeropagina", "in": "query", "style": "form", "schema": { "type": "integer", "format": "int32", "default": 1 } }
        ],
        "responses": { "200": { "description": "OK" } }
      }
    }
  },
  "components": {}
}
```

**O que diz a documentação oficial da ANP (`api-revendedores-manual-usuario.pdf`, v1.0, 13/12/2024, pp. 3, 8, 10 e 12):**
- **`statusSIGAF`**:
  - Páginas 3 e 8: *"Status SIGAF - Situação retornada da API do SIGAF (Interdição ou Desinterdição)."*
  - Páginas 10 e 12 (capturas de tela oficiais de exemplo): `"statusSIGAF": "interdição parcial"`.
  - Na API em produção atual, todos os 45.762 postos retornam `statusSIGAF: ""` (vazio).
- **`situacaoConstatada`**:
  - Na resposta da API, retorna códigos numéricos em texto (`""`, `"100"`, `"200"`, `"300"`, `"310"`, `"320"`, `"325"`, `"400"`).
  - Na página 8 do manual oficial consta apenas *"Situação Constatada – Situação Constatada do posto de combustíveis"*, sem tabela de domínio dos códigos (**significado não confirmado**).
- **`observacao`**:
  - Na resposta da API, retorna string vazia `""` na quase totalidade dos registros ou anotações livres de campo/fiscalização/georreferenciamento.
  - Na página 8 do manual oficial consta apenas *"Observação – Observação do posto de combustíveis"*, sem padronização estruturada (**significado não confirmado**).

---

## 2. Tabela de Rastreabilidade

### 2.1 Rodada 1 (`A1..E3`)
| Item | Arquivo:Linha | Prova | Resultado | Não Resolvido |
| :--- | :--- | :--- | :--- | :--- |
| **R1-A1** | `backend/src/migrations/014_anp_stations.sql:1-46` | Migration idempotente criando `anp_stations`, `anp_sync_runs` e 4 índices. | Concluído | Nenhum |
| **R1-B1..B4** | `backend/src/services/anpSync.js:11-398`, `backend/scripts/anpSync.js:1-106`, `backend/package.json:10`, `backend/.env.example:21-23`, `README.md:29-55` | Serviço, CLI, normalização (CNPJ 14 dígitos, CEP 8 dígitos, coords do Brasil) e transação por UF. | Concluído | Nenhum |
| **R1-C1..C5** | `backend/src/controllers/anpController.js:1-299`, `backend/src/routes/anp.js:1-10`, `backend/src/index.js:126` | Rotas `/api/anp/stations`, `summary`, `in-bounds` e `:cnpj` com lista explícita de campos permitidos. | Concluído | Nenhum |
| **R1-D1..D2** | `frontend/src/pages/StationsPage.jsx:40-1058`, `frontend/src/components/AnpStationsMap.jsx:1-145` | Aba `"ANP (Brasil)"`, filtros, mapa `in-bounds`, aviso `truncated` e gaveta de detalhes. | Concluído | Nenhum |
| **R1-E1..E3** | `backend/tests/anp_stations.test.js:1-857`, `frontend/src/StationsPage.test.jsx:1-317`, `docs/relatorios/anp_stations_round1.md` | Testes automatizados backend/frontend, fixture real e documentação. | Concluído | Nenhum |

### 2.2 Rodada 2 — Hardening de Sincronização e Interdição (`A1..C3`)
| Item | Arquivo:Linha | Prova | Resultado | Não Resolvido |
| :--- | :--- | :--- | :--- | :--- |
| **A1** | `backend/src/services/anpSync.js:209-374` | Trava de desativação em `syncUf`: verifica `(a)` `totalNormalizedCount === totalRawCount`, `(b)` `seenCnpjs.size >= expectedTotalRegistro` e `(c)` queda `<= 20%` dos postos ativos da UF. Se qualquer condição falhar, mantém o upsert (`COMMIT`), não desativa ninguém (`deactivated = 0`), grava `status = 'partial'` com a razão em `error` em `anp_sync_runs` e imprime aviso na CLI. | Concluído | Nenhum |
| **A2** | `backend/scripts/anpSync.js:19-24`, `backend/src/services/anpSync.js:193,332`, `README.md:45-50` | Flag `--allow-mass-deactivation` na CLI liberando conscientemente a condição `(c)` e documentada no `README.md`. | Concluído | Nenhum |
| **A3** | `backend/src/services/anpSync.js:399-435`, `backend/scripts/anpSync.js:55-93` | `syncAll` captura falhas por UF, continua sincronizando as demais UFs, lista todas as falhas no final e define `process.exitCode = 1`. | Concluído | Nenhum |
| **B1** | `backend/src/services/anpStatus.js:1-47`, `README.md:51-53` | Função `isInterdicted(valor)` normalizando texto (minúsculas, sem acentos): `"interdicao"` (e variações) => `true`; `"desinterdicao"` => `false`; vazio => `false`; valor desconhecido => `false` com registro em `console.warn` para análise. Documentada no `README.md`. | Concluído | Nenhum |
| **B2** | `backend/src/controllers/anpController.js:2,38`, `frontend/src/pages/StationsPage.jsx:41,1006-1008`, `frontend/src/components/AnpStationsMap.jsx:112` | Campo booleano `interdicted` incluído nas respostas de `/api/anp/stations`, `:cnpj` e `in-bounds`; frontend consome `station.interdicted` sem regex no selo, no drawer e no `AnpStationsMap`. | Concluído | Nenhum |
| **B3** | `docs/relatorios/anp_stations_round1.md:107-178` | Explicado no relatório que na base ativa atual da ANP todos os 45.762 registros trazem `statusSIGAF: ""` (`situacao_sigaf: null`), enquanto o Manual do Usuário oficial da ANP especifica `"Interdição"` / `"Desinterdição"` / `"interdição parcial"`. | Concluído | Nenhum |
| **C1** | `backend/tests/anp_stations.test.js:295-577` | Testes cobrindo resposta truncada (`2 de 10` => `status: 'partial'`, `deactivated: 0`), registro inválido no meio (`status: 'partial'`, `deactivated: 0`), remoção legítima (`1 de 10` => `deactivated: 1`), queda `> 20%` bloqueada e liberada com `--allow-mass-deactivation`, e `syncAll` continuando nas demais UFs com `process.exitCode = 1`. | Concluído | Nenhum |
| **C2** | `backend/tests/anp_stations.test.js:198-235,781-824`, `frontend/src/StationsPage.test.jsx:44-55,79-175` | Testes unitários de `isInterdicted`, testes de contrato dos endpoints (`interdicted: true/false`) e testes Vitest do selo no frontend a partir do booleano. | Concluído | Nenhum |
| **C3** | `docs/relatorios/anp_stations_round1.md:220-325` | Lista de suítes corrigida com as linhas `PASS` literais extraídas da execução real do Jest e explicação da diferença em relação à versão anterior. | Concluído | Nenhum |

---

## 3. Explicação da Diferença na Lista de Suítes (Item C3)

Na versão anterior deste relatório, como o log intermediário da tarefa em background do Jest havia sido truncado pelo runner (`<truncated 526 lines>`), 4 nomes de suítes intermediárias haviam sido reconstruídos manualmente com nomes de outra branch (`alerts_lifecycle.test.js`, `anomaly.test.js`, `telemetry.test.js`, `audit_fixes.test.js`).

Conforme verificado via `ls backend/tests` e `git status --ignored`, os 15 arquivos reais de teste existentes em `backend/tests` nesta branch (`feat/anp-stations`, criada a partir de `main`) são:
- `anp_stations.test.js`
- `api_contract.test.js`
- `ble.test.js`
- `divergence.test.js`
- `docs_drift.test.js`
- `driver_actions.test.js`
- `driver_fleet_hardening.test.js`
- `facial.test.js`
- `facial_extra.test.js`
- `hardening.test.js`
- `jwtValidator.test.js`
- `leak_recursive.test.js`
- `manager_override.test.js`
- `migrations.test.js`
- `roles.test.js`

**Saída bruta de `git status --ignored` e listagem de `backend/tests`:**
```text
$ git status --ignored
On branch feat/anp-stations
Your branch is up to date with 'origin/feat/anp-stations'.

Ignored files:
  (use "git add -f <file>..." to include in what will be committed)
	backend/.env
	backend/dev.log
	backend/node_modules/
	frontend/.env
	frontend/dist/
	frontend/node_modules/
	mobile/.env
	mobile/.expo/
	mobile/node_modules/

nothing to commit, working tree clean

$ Get-ChildItem backend/tests | Select-Object Name
Name
----
fixtures
anp_stations.test.js
api_contract.test.js
ble.test.js
clean.js
contractRows.js
divergence.test.js
docs_drift.test.js
driver_actions.test.js
driver_fleet_hardening.test.js
envSetup.js
facial_extra.test.js
facial.test.js
globalSetup.js
hardening.test.js
jwtValidator.test.js
leak_recursive.test.js
manager_override.test.js
migrations.test.js
roles.test.js
```

---

## 4. Saídas Brutas de Verificação Final

### 4.1 `node --check` nos arquivos `.js` alterados
```text
$ node --check src/index.js ; node --check src/services/anpSync.js ; node --check src/services/anpStatus.js ; node --check src/controllers/anpController.js ; node --check src/routes/anp.js ; node --check scripts/anpSync.js ; node --check tests/anp_stations.test.js ; echo "NODE_CHECK_EXIT=$LASTEXITCODE"
NODE_CHECK_EXIT=0
```

### 4.2 `DROP DATABASE IF EXISTS ehr_fleet_test` e `npm test` COMPLETO do Backend (2 execuções seguidas — linhas `PASS`/`FAIL` literais)

**1ª Execução (após `DROP DATABASE IF EXISTS ehr_fleet_test`):**
```text
DROP DATABASE IF EXISTS ehr_fleet_test executed.
PASS tests/anp_stations.test.js
PASS tests/api_contract.test.js
PASS tests/driver_fleet_hardening.test.js
PASS tests/facial.test.js
PASS tests/roles.test.js
PASS tests/facial_extra.test.js
PASS tests/hardening.test.js
PASS tests/divergence.test.js
PASS tests/leak_recursive.test.js
PASS tests/driver_actions.test.js
PASS tests/migrations.test.js
PASS tests/manager_override.test.js
PASS tests/ble.test.js
PASS tests/docs_drift.test.js
PASS tests/jwtValidator.test.js
Test Suites: 15 passed, 15 total
Tests:       207 passed, 207 total
Snapshots:   0 total
Time:        29.543 s
Ran all test suites.
```

**2ª Execução (consecutiva):**
```text
PASS tests/anp_stations.test.js
PASS tests/api_contract.test.js
PASS tests/driver_actions.test.js
PASS tests/leak_recursive.test.js
PASS tests/roles.test.js
PASS tests/migrations.test.js
PASS tests/facial.test.js
PASS tests/driver_fleet_hardening.test.js
PASS tests/hardening.test.js
PASS tests/manager_override.test.js
PASS tests/facial_extra.test.js
PASS tests/divergence.test.js
PASS tests/ble.test.js
PASS tests/docs_drift.test.js
PASS tests/jwtValidator.test.js
Test Suites: 15 passed, 15 total
Tests:       207 passed, 207 total
Snapshots:   0 total
Time:        22.489 s, estimated 29 s
Ran all test suites.
```

### 4.3 `npm test` e `npm run build` do Frontend
```text
> vitest run
 RUN  v3.2.7 C:/Users/gsds0/Desktop/EHR-Solutions-Web/frontend
 ✓ src/FuelingTable.test.jsx (1 test) 534ms
 ✓ src/DriverModal.test.jsx (2 tests) 1114ms
 ✓ src/StationsPage.test.jsx (3 tests) 1104ms
 ✓ src/Roles.test.jsx (7 tests) 594ms
 ✓ src/FacialAttemptsPage.test.jsx (1 test) 439ms
 ✓ src/DriversPage.test.jsx (3 tests) 703ms
 ✓ src/App.test.jsx (1 test) 58ms
 Test Files  7 passed (7)
      Tests  18 passed (18)
   Start at  01:23:32
   Duration  18.22s (transform 2.84s, setup 0ms, collect 29.65s, tests 4.55s, environment 66.28s, prepare 6.19s)
```

```text
> vite build
vite v5.4.21 building for production...
✓ 2569 modules transformed.
dist/index.html                     1.22 kB │ gzip:   0.66 kB
dist/assets/index-39j02iYT.css     27.35 kB │ gzip:   9.50 kB
dist/assets/index-D8IPueMl.js   1,031.89 kB │ gzip: 299.47 kB
✓ built in 17.72s
```
