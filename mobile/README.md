# EHR Solutions - Aplicativo Motorista

## Autenticação BLE

A confirmação do BLE é feita pelo HARDWARE via `POST /sessions/:id/ble-confirmed` e a parte real depende do protocolo da trava.
No momento o app apenas cria a sessão `ble_fallback` e aguarda o status `active`.
