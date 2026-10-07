# EHR Motorista

Aplicativo mobile desenvolvido para a **EHR Solutions**, com foco no gerenciamento de operações de abastecimento de veículos de uma frota.

O aplicativo representa o fluxo utilizado pelo motorista para:

- autenticar-se no aplicativo;
- visualizar seus dados e o veículo vinculado;
- realizar validação facial;
- liberar a trava eletrônica do veículo;
- registrar o nível de combustível antes do abastecimento;
- registrar o nível de combustível após o abastecimento;
- bloquear novamente a trava;
- finalizar a operação;
- armazenar operações localmente;
- trabalhar em modo online ou offline;
- manter uma fila de operações pendentes para sincronização posterior.

> **Status atual:** protótipo funcional para demonstração e desenvolvimento. A API, a comunicação Bluetooth com a trava e a validação facial estão implementadas como **mocks/simulações**. O projeto não depende de um backend ou de uma trava física para executar o fluxo demonstrativo.

---

## 1. Sobre o projeto

O **EHR Motorista** é a aplicação mobile destinada ao motorista da solução de gestão de frota da EHR Solutions.

A proposta é centralizar no celular o processo de identificação do motorista e autorização de uma operação de abastecimento, utilizando recursos como:

- autenticação do motorista;
- identificação do veículo;
- autenticação facial;
- comunicação com uma trava eletrônica por Bluetooth;
- registro dos níveis de combustível;
- operação online/offline;
- armazenamento local;
- sincronização posterior com o servidor.

O aplicativo foi estruturado de forma que os serviços simulados possam futuramente ser substituídos por integrações reais.

---

## 2. Tecnologias utilizadas

### Aplicação

| Tecnologia | Versão utilizada |
|---|---|
| React Native | 0.86.3 |
| React | 19.2.3 |
| TypeScript | ~6.0.3 |
| Expo | ~57.0.26 |
| React Navigation | 6.x |
| AsyncStorage | 2.2.0 |
| Expo Camera | ~57.0.6 |
| Expo Secure Store | ~57.0.4 |
| Expo Location | ~57.0.20 |
| React Native Gesture Handler | ~2.32.0 |
| React Native Safe Area Context | ~5.7.0 |
| React Native Screens | ~4.26.0 |

### Ferramentas necessárias

Para executar o projeto localmente, recomenda-se ter instalado:

- **Node.js LTS**
- **npm**
- **Git**, caso o projeto seja obtido de um repositório
- **Expo CLI**, caso necessário pelo ambiente
- **Android Studio**, se for utilizar um emulador Android
- **Expo Go**, se for executar em um dispositivo físico através do Expo

> O projeto possui `package-lock.json`. Portanto, a instalação das dependências deve preferencialmente ser feita com `npm install` ou `npm ci`.

---

## 3. Estrutura do projeto

A aplicação está localizada no diretório:

```text
EHRSolution--APP-5.0/
└── ehr-driver-app/
```

A estrutura principal é:

```text
ehr-driver-app/
├── App.tsx
├── app.json
├── package.json
├── package-lock.json
├── tsconfig.json
└── src/
    ├── components/
    │   ├── Button.tsx
    │   ├── ConnectionStatus.tsx
    │   └── StatusBadge.tsx
    │
    ├── contexts/
    │   ├── AuthContext.tsx
    │   ├── ConnectionContext.tsx
    │   └── OperationContext.tsx
    │
    ├── hooks/
    │   ├── useAuth.ts
    │   ├── useBluetooth.ts
    │   └── useConnection.ts
    │
    ├── navigation/
    │   ├── AppNavigator.tsx
    │   └── types.ts
    │
    ├── repositories/
    │   └── operationRepository.ts
    │
    ├── screens/
    │   ├── LoginScreen.tsx
    │   ├── DashboardScreen.tsx
    │   ├── FacialAuthScreen.tsx
    │   ├── FuelOperationScreen.tsx
    │   └── OperationResultScreen.tsx
    │
    ├── services/
    │   ├── api/
    │   │   └── apiClient.ts
    │   ├── biometric/
    │   │   └── facialService.ts
    │   └── bluetooth/
    │       └── bleManager.ts
    │
    ├── storage/
    │   ├── secureStorage.ts
    │   └── syncQueue.ts
    │
    ├── theme/
    │   └── theme.ts
    │
    └── types/
        ├── auth.ts
        ├── driver.ts
        ├── operation.ts
        └── vehicle.ts
```

---

## 4. Responsabilidade dos principais diretórios

### `components/`

Contém componentes reutilizáveis da interface.

- `Button.tsx`: botão padrão utilizado nas telas.
- `ConnectionStatus.tsx`: apresenta o estado da conexão.
- `StatusBadge.tsx`: apresenta estados da operação e do sistema.

### `contexts/`

Contém os contextos globais da aplicação.

#### `AuthContext.tsx`

Responsável pelo estado de autenticação:

- login;
- logout;
- motorista autenticado;
- veículo vinculado;
- recuperação dos dados armazenados;
- controle do estado de carregamento.

#### `ConnectionContext.tsx`

Controla o estado de conexão da aplicação.

Também permite alternar manualmente entre:

```text
ONLINE
```

e

```text
OFFLINE
```

para testes do comportamento offline.

#### `OperationContext.tsx`

Controla o ciclo de vida de uma operação de abastecimento:

```text
STARTED
   ↓
UNLOCKED
   ↓
COMPLETED / PENDING_SYNC
   ↓
SYNCED
```

Também é responsável pela sincronização das operações pendentes.

---

## 5. Telas do aplicativo

### Login

Arquivo:

```text
src/screens/LoginScreen.tsx
```

Permite informar:

- CPF ou matrícula;
- senha.

A tela utiliza o serviço de autenticação simulado.

---

### Dashboard

Arquivo:

```text
src/screens/DashboardScreen.tsx
```

Apresenta informações do:

- motorista;
- veículo;
- status da conexão;
- status da trava;
- quantidade de operações pendentes de sincronização.

Também permite iniciar um novo abastecimento.

---

### Validação Facial

Arquivo:

```text
src/screens/FacialAuthScreen.tsx
```

Utiliza a câmera frontal do dispositivo.

O fluxo demonstrativo possui os estados:

```text
AGUARDANDO
CAPTURANDO
VALIDANDO
SUCESSO
FALHA
```

Após uma validação bem-sucedida, o motorista é encaminhado para a operação de abastecimento.

> A validação facial atual é simulada. Não existe, nesta versão, um modelo real de reconhecimento facial.

---

### Operação de Abastecimento

Arquivo:

```text
src/screens/FuelOperationScreen.tsx
```

Permite:

1. informar o nível de combustível antes do abastecimento;
2. liberar a trava;
3. realizar o abastecimento;
4. informar o nível de combustível depois do abastecimento;
5. bloquear a trava;
6. finalizar a operação.

O fluxo de comunicação Bluetooth também é simulado.

---

### Resultado da Operação

Arquivo:

```text
src/screens/OperationResultScreen.tsx
```

Exibe:

- ID da operação;
- nível inicial;
- nível final;
- status da sincronização.

---

## 6. Fluxo completo da aplicação

O fluxo principal é:

```text
┌───────────────┐
│     Login     │
└───────┬───────┘
        ↓
┌───────────────┐
│   Dashboard   │
└───────┬───────┘
        ↓
┌───────────────────┐
│ Validação Facial  │
└────────┬──────────┘
         ↓
┌──────────────────────┐
│ Operação Abastecimento│
└──────────┬───────────┘
           ↓
     ┌─────────────┐
     │ Liberar     │
     │ Trava (BLE) │
     └──────┬──────┘
            ↓
   Informar combustível
            ↓
     ┌─────────────┐
     │ Bloquear    │
     │ Trava (BLE) │
     └──────┬──────┘
            ↓
┌──────────────────────┐
│ Resultado da Operação│
└──────────────────────┘
```

---

## 7. Funcionamento online e offline

O projeto foi estruturado para suportar dois cenários.

### Modo online

Quando a aplicação está online:

1. a operação é registrada;
2. os dados são armazenados localmente;
3. a aplicação tenta sincronizar a operação com a API;
4. se a sincronização funcionar, o status passa para `SYNCED`.

Fluxo:

```text
Operação
   ↓
Armazenamento local
   ↓
API
   ↓
SYNCED
```

### Modo offline

Quando a aplicação está offline:

1. a operação continua sendo realizada;
2. os dados são armazenados localmente;
3. a operação recebe o status `PENDING_SYNC`;
4. a operação é colocada na fila de sincronização;
5. quando a conexão volta, a fila pode ser sincronizada.

Fluxo:

```text
Operação
   ↓
Armazenamento local
   ↓
Fila de sincronização
   ↓
PENDING
   ↓
Conexão restaurada
   ↓
API
   ↓
SYNCED
```

---

## 8. Armazenamento local

O projeto utiliza duas formas principais de armazenamento.

### Secure Store

Arquivo:

```text
src/storage/secureStorage.ts
```

Utilizado para armazenar informações relacionadas à autenticação, como:

- token;
- dados do motorista.

Tecnologia:

```text
expo-secure-store
```

### AsyncStorage

Utilizado para armazenar:

- operações realizadas;
- fila de sincronização.

Tecnologia:

```text
@react-native-async-storage/async-storage
```

---

## 9. Integrações simuladas

A versão atual do projeto possui três integrações importantes simuladas.

### API

Arquivo:

```text
src/services/api/apiClient.ts
```

O cliente atualmente simula:

```text
login()
validateBiometrics()
syncOperation()
```

Não existe, nesta versão, uma API Node.js/Express efetivamente conectada.

O código já possui uma abstração que permite substituir posteriormente o mock por chamadas HTTP reais.

---

### Bluetooth

Arquivo:

```text
src/services/bluetooth/bleManager.ts
```

Atualmente simula:

```text
checkBluetoothState()
connectToLock()
unlockLock()
lockLock()
getLockStatus()
```

Todas as operações retornam resultados simulados.

Portanto, para executar o projeto localmente, **não é necessário possuir a trava eletrônica física**.

---

### Biometria facial

Arquivo:

```text
src/services/biometric/facialService.ts
```

O serviço possui dois comportamentos:

- online: simula uma validação através da API;
- offline: simula uma validação local/on-device.

A validação atualmente retorna sucesso de forma simulada.

---

## 10. Dados de teste

O login atual é simulado.

A tela já inicia preenchida com:

```text
CPF/Matrícula: 123.456.789-00
Senha: 123456
```

Como o `apiClient` atual não valida uma senha específica, qualquer identificador diferente de:

```text
error
```

é aceito pelo mock.

Para testar o tratamento de erro, utilize:

```text
CPF/Matrícula: error
```

Isso gera:

```text
Credenciais inválidas.
```

### Motorista simulado

O login retorna um motorista de demonstração:

```text
Nome: Carlos Eduardo Santos
CPF: 123.456.789-00
Matrícula: MTR-9942
```

### Veículo simulado

```text
Modelo: Constellation 24.280
Marca: Volkswagen
Placa: EHR-2A26
ID BLE: BLE-TRAVA-EHR-01
```

Esses dados estão definidos diretamente no serviço mock da aplicação.

---

# 11. Como executar o projeto na sua máquina

## 11.1 Pré-requisitos

Instale:

1. Node.js LTS
2. npm
3. Android Studio, se quiser usar emulador Android

Para verificar o Node.js:

```bash
node --version
```

Para verificar o npm:

```bash
npm --version
```

---

## 11.2 Entrar no diretório do aplicativo

Depois de extrair o projeto:

```bash
cd EHRSolution--APP-5.0/ehr-driver-app
```

No Windows, por exemplo:

```powershell
cd .\EHRSolution--APP-5.0\ehr-driver-app
```

Confirme se está no diretório correto:

```bash
dir
```

ou no Linux/macOS:

```bash
ls
```

Você deve encontrar arquivos como:

```text
App.tsx
app.json
package.json
package-lock.json
src/
```

---

## 11.3 Instalar as dependências

Execute:

```bash
npm install
```

Como o projeto possui `package-lock.json`, outra opção é:

```bash
npm ci
```

O `npm ci` é recomendado quando se deseja instalar exatamente as versões registradas no lockfile.

Depois da instalação, a pasta:

```text
node_modules/
```

será criada.

---

# 12. Iniciar o projeto

Execute:

```bash
npm start
```

ou:

```bash
npx expo start
```

O Expo iniciará o servidor de desenvolvimento e exibirá o QR Code e as opções disponíveis.

---

# 13. Executar no navegador

O projeto possui suporte configurado para web.

Execute:

```bash
npm run web
```

ou:

```bash
npx expo start --web
```

O aplicativo será aberto no navegador.

> Algumas funcionalidades específicas de dispositivo, principalmente câmera, Bluetooth e recursos nativos, não representam o mesmo comportamento quando executadas no navegador. Para testar o fluxo mobile completo, prefira Android/iOS.

---

# 14. Executar em um celular Android

Uma das formas mais simples para testar a interface é utilizar o **Expo Go**, desde que o ambiente instalado seja compatível com a versão do SDK utilizada pelo projeto.

### Passo 1 — instalar o Expo Go

Instale o Expo Go no celular Android.

### Passo 2 — iniciar o projeto

No computador:

```bash
npm start
```

### Passo 3 — conectar o celular

Certifique-se de que:

- computador e celular estejam na mesma rede;
- o servidor Expo esteja em execução.

Depois, abra o Expo Go e utilize o QR Code apresentado pelo Expo.

---

# 15. Executar em emulador Android

Para utilizar um emulador:

### 1. Instale o Android Studio

Configure:

- Android SDK;
- Android SDK Platform;
- Android Emulator;
- um dispositivo virtual Android (AVD).

### 2. Inicie o emulador

Abra o Android Studio e inicialize um dispositivo virtual.

### 3. Execute o projeto

Dentro de:

```text
ehr-driver-app/
```

execute:

```bash
npm run android
```

ou:

```bash
npx expo start --android
```

O Expo tentará abrir o aplicativo no emulador Android disponível.

---

# 16. Primeiro teste do aplicativo

Depois de iniciar o aplicativo:

### 1. Login

Utilize:

```text
CPF/Matrícula: 123.456.789-00
Senha: 123456
```

Clique em:

```text
Entrar
```

### 2. Dashboard

Você verá:

- dados do motorista;
- veículo;
- status da conexão;
- status da trava;
- quantidade de operações pendentes.

Clique em:

```text
INICIAR ABASTECIMENTO
```

### 3. Validação facial

Permita o acesso à câmera.

Clique em:

```text
Capturar e Validar
```

A validação será simulada e deverá resultar em sucesso.

### 4. Operação

Informe o nível inicial de combustível.

Exemplo:

```text
25
```

Clique:

```text
LIBERAR TRAVA
```

A comunicação Bluetooth será simulada.

Depois informe o nível final.

Exemplo:

```text
70
```

Clique:

```text
FECHAR TRAVA E FINALIZAR
```

### 5. Resultado

O aplicativo apresentará o resumo da operação.

---

# 17. Testando o modo offline

O projeto possui um mecanismo de simulação de conexão para testar o comportamento offline.

A conexão é controlada pelo:

```text
ConnectionContext.tsx
```

O estado pode ser alternado entre:

```text
ONLINE
```

e:

```text
OFFLINE
```

No modo offline, uma operação concluída pode ser armazenada na fila de sincronização:

```text
@ehr_sync_queue
```

Quando a conexão estiver disponível novamente, a aplicação poderá executar:

```text
synchronizePending()
```

para tentar sincronizar as operações pendentes.

---

# 18. Scripts disponíveis

Os scripts estão definidos no `package.json`.

### Iniciar Expo

```bash
npm start
```

### Android

```bash
npm run android
```

### iOS

```bash
npm run ios
```

### Web

```bash
npm run web
```

---

# 19. Arquitetura simplificada

A aplicação segue uma separação por responsabilidades:

```text
                  ┌───────────────────┐
                  │      Screens      │
                  │  Interface/UI     │
                  └─────────┬─────────┘
                            │
                            ↓
                  ┌───────────────────┐
                  │     Contexts      │
                  │ Estado da aplicação│
                  └─────────┬─────────┘
                            │
             ┌──────────────┼──────────────┐
             ↓              ↓              ↓
        ┌─────────┐    ┌──────────┐   ┌──────────┐
        │ Services│    │Repository│   │ Storage  │
        └────┬────┘    └────┬─────┘   └────┬─────┘
             │              │              │
             ↓              ↓              ↓
           API             Dados         Local
           BLE           operações       Secure/
        Biometria                       AsyncStorage
```

---

# 20. Pontos que ainda são mock/simulação

É importante diferenciar o protótipo da versão de produção.

| Recurso | Situação atual |
|---|---|
| Login | Simulado |
| API | Simulada |
| Token | Gerado como mock |
| Validação facial | Simulada |
| Bluetooth | Simulado |
| Trava eletrônica | Não integrada fisicamente |
| Sincronização com servidor | Simulada |
| Armazenamento local | Implementado |
| Fila offline | Implementada |
| Navegação | Implementada |
| Interface mobile | Implementada |
| Fluxo de abastecimento | Implementado |

---

# 21. Próximos passos para produção

Para transformar o protótipo em uma aplicação integrada, os principais pontos são:

### Backend

Substituir o:

```text
src/services/api/apiClient.ts
```

por uma implementação HTTP real.

Exemplo de arquitetura futura:

```text
Aplicativo Mobile
       │
       ↓
API REST
       │
       ├── Autenticação
       ├── Motoristas
       ├── Veículos
       ├── Operações
       ├── Abastecimentos
       └── Sincronização
```

### Bluetooth real

Substituir:

```text
src/services/bluetooth/bleManager.ts
```

por uma implementação utilizando uma biblioteca BLE compatível com o hardware da trava.

A implementação real deverá contemplar:

- descoberta do dispositivo;
- conexão;
- identificação do serviço;
- identificação das características;
- envio do comando de abertura;
- envio do comando de fechamento;
- leitura do estado da trava;
- tratamento de timeout;
- perda de conexão;
- reconexão;
- tratamento de erros.

### Biometria real

Substituir a validação simulada por:

- serviço de reconhecimento facial;
- ou modelo on-device;
- ou API de biometria;
- armazenamento seguro das informações necessárias;
- mecanismos de proteção contra fraude/liveness, se aplicável.

### API e segurança

Para produção, também será necessário implementar:

- autenticação real;
- expiração e renovação de token;
- HTTPS;
- tratamento de sessão;
- autorização por usuário;
- validação dos dados;
- logs;
- auditoria;
- tratamento de erros;
- políticas de segurança.

---

# 22. Solução de problemas

## Erro ao instalar dependências

Remova as dependências instaladas e faça uma nova instalação:

```bash
rm -rf node_modules
npm install
```

No Windows PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules
npm install
```

Se necessário, limpe o cache do Expo:

```bash
npx expo start -c
```

---

## Expo não abre o projeto

Tente:

```bash
npx expo start -c
```

Depois escolha novamente o destino:

```text
Android
Web
Expo Go
```

---

## Alterações não aparecem no aplicativo

Reinicie o Metro/Expo limpando o cache:

```bash
npx expo start -c
```

---

## Câmera não funciona

Verifique se a permissão da câmera foi concedida ao aplicativo.

O projeto já declara a permissão no `app.json`:

```text
CAMERA
```

No Android, também verifique as permissões do aplicativo nas configurações do sistema.

---

## Bluetooth não funciona

Na versão atual, isso é esperado em relação ao hardware real.

O arquivo:

```text
src/services/bluetooth/bleManager.ts
```

é um **mock**.

Portanto, a aplicação consegue demonstrar o fluxo sem realmente se conectar a uma trava Bluetooth.

---

# 23. Comandos rápidos

Depois de clonar/extrair o projeto:

```bash
cd EHRSolution--APP-5.0/ehr-driver-app
npm install
npm start
```

Para Android:

```bash
npm run android
```

Para Web:

```bash
npm run web
```

Para limpar o cache:

```bash
npx expo start -c
```

---

# 24. Resumo

O **EHR Motorista** é um protótipo de aplicativo mobile para gerenciamento de abastecimento de veículos de uma frota.

O projeto já possui a estrutura de:

- autenticação;
- gerenciamento de motorista;
- vínculo com veículo;
- dashboard;
- validação facial;
- operação de abastecimento;
- controle de trava;
- Bluetooth;
- armazenamento local;
- modo online/offline;
- fila de sincronização;
- navegação entre telas.

A arquitetura foi organizada para permitir que os serviços simulados sejam posteriormente substituídos por integrações reais com:

```text
API Backend
     +
Serviço de Biometria
     +
Trava Bluetooth
     +
Banco de Dados
```

Para executar a versão atual localmente, basta instalar as dependências e iniciar o Expo:

```bash
cd EHRSolution--APP-5.0/ehr-driver-app
npm install
npm start
```

A versão atual pode ser executada sem backend e sem hardware físico, pois essas integrações estão simuladas no código.
