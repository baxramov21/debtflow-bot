import { config } from 'dotenv';
config({ path: '.env.local' });

async function run() {
  const url = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const headers = process.env.CRON_SECRET ? { 'Authorization': `Bearer ${process.env.CRON_SECRET}` } : {};

  console.log(`Triggering daily cron at ${url}/api/cron/daily...`);
  try {
    let res = await fetch(`${url}/api/cron/daily`, { headers });
    let data = await res.json();
    console.log('Daily cron response:', data);
  } catch (err) {
    console.error('Daily cron failed:', err.message);
  }

  console.log(`\nTriggering frequent cron at ${url}/api/cron/frequent...`);
  try {
    let res = await fetch(`${url}/api/cron/frequent`, { headers });
    let data = await res.json();
    console.log('Frequent cron response:', data);
  } catch (err) {
    console.error('Frequent cron failed:', err.message);
  }
}

run();
