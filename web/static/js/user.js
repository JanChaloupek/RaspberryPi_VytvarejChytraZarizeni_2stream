// static/js/user.js
// Modul pro získání informací o aktuálně přihlášeném uživateli.
// ----------------------------------------------------
// Účel:
// - Volá backend endpoint /api/me.
// - Vrací JSON s informacemi o uživateli (username, role).
// - Pokud volání selže, loguje chybu a vrací fallback { role: 'user' }.
//
// Závislosti:
// - Backend musí poskytovat endpoint /api/me.
//   Očekávaný formát odpovědi: { username: "...", role: "admin" }
//
// Exportované funkce:
// - getUserInfo(): asynchronní funkce pro načtení informací o uživateli.

/**
 * getUserInfo()
 * ----------------------------------------------------
 * Načte informace o aktuálním uživateli z backendu.
 * - Volá /api/me pomocí fetch().
 * - Pokud odpověď není OK, vyhodí chybu.
 * - Vrací JSON s informacemi o uživateli.
 * - Pokud dojde k chybě, zaloguje ji a vrátí fallback { role: 'user' }.
 *
 * @returns {Promise<{username?: string, role: string}>}
 *   Objekt s informacemi o uživateli.
 *   - username: jméno uživatele (pokud je dostupné)
 *   - role: role uživatele (např. 'admin', 'user')
 */
export async function getUserInfo() {
  try {
    const res = await fetch('/api/me');
    if (!res.ok) throw new Error(`Failed to fetch /api/me: ${res.status}`);
    return await res.json(); // očekává { username: "...", role: "admin" }
  } catch (e) {
    console.error('getUserInfo failed', e);
    return { role: 'user' }; // fallback
  }
}
