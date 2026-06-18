# Envio de Email no Histórico de Pagamentos — Mailto

## Contexto

O sistema possuía um fluxo de envio de comprovantes via **VBA Script** (Excel + Outlook Clássico no Windows). Com a migração para MacBook, o Outlook Clássico não está disponível, tornando o fluxo VBA inoperante no Mac.

A solução adotada foi adicionar uma segunda opção de envio via **Mailto**, que funciona com qualquer cliente de email configurado no sistema operacional (Outlook Moderno, Apple Mail, etc.), sem necessidade de APIs externas ou cadastros adicionais.

---

## O que foi alterado

### `src/app/historico/email-vba-dialog.tsx`

Arquivo principal do fluxo de email. As mudanças adicionam uma camada de seleção de método sem remover nem alterar o fluxo VBA existente.

**Novas adições:**

- **Tipo `Step`** (`'method' | 'vba' | 'mailto'`): controla em qual etapa do dialog o usuário está.
- **Tela de seleção de método** (step `'method'`): ao abrir o dialog, o usuário vê dois cards — *VBA Script* e *Mailto* — com botão de voltar no header após a escolha.
- **Função `generateMailtoLink(p)`**: gera um link `mailto:` com destinatário, assunto (`Comprovante de Pagamento`) e corpo pré-preenchido (nome, descrição, valor em USDT e hash da transação), tudo URL-encoded.
- **Estado `mailtoGerados`**: lista de links gerados após clicar em "Gerar links de email".
- **Função `handleAbrirEmails()`**: gera os links mailto para os pagamentos selecionados, chama `marcarEmailsEnviados` no banco e dispara `router.refresh()` após a conclusão.
- **Step `'mailto'`**: UI idêntica ao fluxo VBA na seleção de pagamentos, mas sem campo de remetente. O botão "Gerar links de email" gera os links e exibe uma lista clicável — um item por prestador — que abre o cliente de email padrão com o email já montado.
- **`router.refresh()`** chamado dentro do `startTransition` após `await marcarEmailsEnviados`, garantindo que o banco já foi atualizado antes do refresh da página.

**Fluxo do usuário (Mailto):**

1. Clicar em **Enviar Email** → selecionar **Mailto**
2. Selecionar os pagamentos desejados (apenas USDT/USDC com hash e email pendente)
3. Clicar em **Gerar links de email**
4. Clicar em cada nome na lista gerada → Outlook abre com email pré-preenchido
5. Trocar a caixa de envio para a conta correta e confirmar o envio
6. Os pagamentos são marcados como `email_enviado = true` automaticamente

**Observação sobre remetente:** O protocolo `mailto:` não suporta definir o campo `From`. O usuário deve selecionar manualmente a caixa de envio correta no Outlook ao abrir cada email.

---

### `src/app/historico/page.tsx`

- Adicionado `export const dynamic = 'force-dynamic'` para desabilitar o cache do Next.js nesta rota, garantindo que os dados do banco sejam sempre buscados frescos.
- Adicionado o componente `<RefreshButton />` ao lado do botão "Enviar Email".

---

### `src/app/historico/refresh-button.tsx` *(novo)*

Componente cliente simples com um botão **Atualizar** que executa `window.location.reload()`. Permite ao usuário forçar a atualização dos status de email na página após o envio.

---

## Decisões técnicas

| Decisão | Motivo |
|---|---|
| Manter VBA + adicionar Mailto | VBA ainda funciona no Windows; não havia motivo para remover |
| `window.location.reload()` no botão Atualizar | `router.refresh()` do Next.js não estava invalidando o cache corretamente no ambiente local |
| `force-dynamic` na página | Evita que o Next.js sirva dados em cache após atualizações no banco |
| Sem campo de remetente no Mailto | `mailto:` não suporta `From`; o cliente de email usa a conta padrão configurada |
| Links clicáveis por prestador | Mais confiável que abrir múltiplas janelas via JavaScript, que pode ser bloqueado pelo browser |
| `marcarEmailsEnviados` chamado ao gerar links | Mesmo comportamento do VBA — marca como enviado no momento em que o usuário inicia o envio |
