# Doinp Bet Logger: guia rápido

Extensão para Chrome, Edge, Brave, Opera e Firefox que percebe as apostas que você faz e as
registra para você:
- **Onde funciona:** em casas de apostas, exchanges (a favor / contra) e mercados de previsão
  (Polymarket, Kalshi).
- **Para onde vão:** para um arquivo CSV ou para o
  [betting tracker da Doinp](https://doinp.com.br/tools/betting-tracker).

## Privacidade
- **Só lê a página.** Nunca clica, digita ou envia nada no site da casa.
- **Não coleta dados.** Tudo fica no seu navegador. Não existe servidor, conta nem estatística
  de uso.
- **O navegador bloqueia qualquer conexão das páginas da extensão** (`connect-src 'none'` no
  `manifest.json`), e um teste falha se aparecer código de rede.
- **Apagar os dados:** Ajustes → Apagar todos os dados.
- O código é aberto para você conferir. Detalhes em [PRIVACY.md](PRIVACY.md) (em inglês).

## Instalar (Chrome, Edge, Brave, Opera)
1. Baixe o repositório (**Code → Download ZIP**) e descompacte.
2. Abra `chrome://extensions` e ligue o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e escolha a pasta descompactada (a que tem o
   `manifest.json`).
4. Para atualizar: troque a pasta pela versão nova e clique em ↻ no card da extensão. Seus
   dados continuam lá.

**Firefox:** o Firefox normal só instala extensões assinadas pela Mozilla. Para testar, use
**Carregar extensão temporária** em `about:debugging` (fica até fechar o Firefox). Para uso
permanente sem assinatura, use o Firefox Developer Edition. Detalhes no [README](README.md).

## Como usar
1. **Aposte normalmente.** Ao confirmar a aposta, chega uma notificação: **Salvar** ou
   **Descartar**.
2. **Apostas pendentes** esperam o resultado em Histórico → Pendentes. Na casa, abra
   **Minhas apostas** e use **Capturar → Importar desta página** para liquidá-las.
3. **Exportar:** **Exportar CSV** é o padrão; importe o arquivo no tracker em Apostas →
   Importar. **Enviar ao tracker** manda as apostas direto e pode virar o padrão em Ajustes.
4. **Exchanges:** informe a **Comissão %** da exchange em Ajustes → Casas de apostas. Apostas
   **contra** entram no tracker como a aposta a favor equivalente, com o mesmo lucro.

## A casa não foi detectada?
1. Abra Ajustes → Diagnóstico.
2. Use **Copiar registro** e **Snapshot de teste** (dá para fazer com o cupom aberto, sem
   apostar).
3. Abra uma issue no GitHub com os dois. Revise antes: o snapshot contém o texto do cupom.
