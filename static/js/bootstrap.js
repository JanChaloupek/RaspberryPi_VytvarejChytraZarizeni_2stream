// static/js/bootstrap.js
import { getUserInfo } from './user.js';
import { loadSensors } from './sensors.js';
import { startAutoRefresh } from './refresh.js';

window.addEventListener('DOMContentLoaded', async () => {
  console.debug('[bootstrap] DOMContentLoaded');

  const user = await getUserInfo();
  console.info('[bootstrap] user info:', user);

  if (user.role === 'admin') {
    import('./logs.js').then(m => m.init?.()).catch(console.error);
  }

  await loadSensors();
  startAutoRefresh();
});
