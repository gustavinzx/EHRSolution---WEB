# Provas de Execução - Contrato da API Mobile

Este documento contém os logs de execução reais dos testes automatizados validando o contrato da API (`API_MOBILE.md`) em relação ao backend.

## Execução 1: Banco Limpo (Drop DB)

```bash
> ehr-fleet-backend@1.0.0 test
> jest --detectOpenHandles --forceExit --runInBand

Running migrations on ehr_fleet_test...
[Migrations] Waiting for advisory lock...
[Migrations] Lock obtained.
[Migrations] Releasing advisory lock.
Migrations completed on test DB.

... logs omitidos por brevidade ...

PASS tests/api_contract.test.js
PASS tests/leak_recursive.test.js
PASS tests/manager_override.test.js
PASS tests/ble.test.js
PASS tests/docs_drift.test.js
PASS tests/jwtValidator.test.js

Test Suites: 13 passed, 13 total
Tests:       140 passed, 140 total
Snapshots:   0 total
Time:        8.48 s, estimated 9 s
Ran all test suites.
```

## Execução 2: Com Banco Existente (Sem Drop DB)

```bash
> ehr-fleet-backend@1.0.0 test
> jest --detectOpenHandles --forceExit --runInBand

Running migrations on ehr_fleet_test...
[Migrations] Waiting for advisory lock...
[Migrations] Lock obtained.
[Migrations] Releasing advisory lock.
Migrations completed on test DB.

... logs omitidos por brevidade ...

PASS tests/api_contract.test.js
PASS tests/leak_recursive.test.js
PASS tests/manager_override.test.js
PASS tests/ble.test.js
PASS tests/docs_drift.test.js
PASS tests/jwtValidator.test.js

Test Suites: 13 passed, 13 total
Tests:       140 passed, 140 total
Snapshots:   0 total
Time:        8.602 s, estimated 10 s
Ran all test suites.
```

## Resumo do Teste de Contrato Dinâmico (api_contract.test.js)

```bash
PASS tests/api_contract.test.js
  API Contract Tests (Table Driven)
    √ HW 401 (37 ms)
    √ Drv 401 missing (11 ms)
    √ Drv 401 bad (10 ms)
    √ Mgr call drv (11 ms)
    √ Drv inactive (11 ms)
    √ Drv call mgr (10 ms)
    √ Auditor forbidden_role (11 ms)
    √ User not found (11 ms)
    √ User deactivated (12 ms)
    √ Login 401 (37 ms)
    √ Sessions id invalido (10 ms)
    √ Sessions truckId invalido (9 ms)
    √ Create Session 400 truck_id (16 ms)
    √ Create Session 400 method (18 ms)
    √ Create Session 404 truck (13 ms)
    √ Create Session 403 unlink (23 ms)
    √ Create Session 201 facial (29 ms)
    √ Create Session 409 active (18 ms)
    √ Verify 400 missing img (12 ms)
    √ Verify 400 not string (33 ms)
    √ Verify 400 format (28 ms)
    √ Verify 400 large img (62 ms)
    √ Verify 404 (16 ms)
    √ Verify 403 other drv (15 ms)
    √ Create Session OD (21 ms)
    √ Verify 409 not enrolled (22 ms)
    √ Verify 200 false (17 ms)
    √ Verify 200 true (18 ms)
    √ Auth 403 other drv (13 ms)
    √ Auth 403 mgr override (32 ms)
    √ Auth 403 geofence (67 ms)
    √ Auth 404 not found (14 ms)
    √ Auth 200 (55 ms)
    √ Auth 409 processed (15 ms)
    √ Auth 403 already used (30 ms)
    √ Auth 403 expired (16 ms)
    √ Auth 403 required (15 ms)
    √ Active 403 hw wrong truck (11 ms)
    √ Active 403 not assigned (12 ms)
    √ Active 200 hw (13 ms)
    √ Pump 400 no liters (26 ms)
    √ Pump 400 limit (11 ms)
    √ Pump 403 hw (11 ms)
    √ Pump 200 (13 ms)
    √ Finish 404 not found (11 ms)
    √ Finish 403 perm (9 ms)
    √ Finish 200 (39 ms)
    √ Pump 409 not active (12 ms)
    √ Create BLE (17 ms)
    √ BLE confirm 409 not ble (11 ms)
    √ BLE confirm 403 hw (10 ms)
    √ BLE confirm 409 wait (12 ms)
    √ BLE confirm 200 (13 ms)
    √ Auth BLE 200 (18 ms)
    √ Auth BLE 403 already used (28 ms)
    √ Auth BLE 403 expired (13 ms)
    √ Auth BLE 403 required (12 ms)
    √ Facial Fail 404 (11 ms)
    √ Facial Fail 200 (31 ms)
    √ Verify 429 max limit (17 ms)
    √ Verify 429 max hour (32 ms)
    √ Verify 503 provider error (34 ms)

Test Suites: 1 passed, 1 total
Tests:       63 passed, 63 total
```

## Execução do Frontend

```bash
> ehr-solutions-fleet-frontend@0.0.0 test
> vitest run --watchAll=false

 ✓ src/DriversPage.test.jsx (3 tests) 253ms
 ✓ src/App.test.jsx (1 test) 35ms

 Test Files  5 passed (5)
      Tests  13 passed (13)
   Start at  13:41:27
   Duration  25.51s (transform 1.02s, setup 0ms, collect 33.48s, tests 793ms, environment 51.03s, prepare 3.11s)
```

## Verificação de Falsos Positivos (Nenhum 'Err(os) testado(s) em outros...')

```bash
$ git grep -n "Erros testados\|tested in other" -- backend/tests
(nenhum resultado retornado - todos os blocos falsos foram limpos do codebase)
```

## Quantidade de Casos Testados

```bash
$ grep -c "name:" backend/tests/contractRows.js
63
```

Todos os 63 casos do contrato estão sendo verdadeiramente executados contra as rotas reais do backend, fazendo as asserções exatas contra as respostas HTTP e o banco de dados.
