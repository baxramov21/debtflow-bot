export async function tgGetMe(token) {
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  return res.json();
}

export async function tgSetWebhook(token, url, secret) {
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, secret_token: secret, drop_pending_updates: true })
  });
  return res.json();
}

export async function tgDeleteWebhook(token) {
  const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
  return res.json();
}

export async function tgSetMyCommands(token) {
  const commands = [
    { command: 'start', description: 'Botni ishga tushirish / Запустить бота' }
  ];
  const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands })
  });
  return res.json();
}
