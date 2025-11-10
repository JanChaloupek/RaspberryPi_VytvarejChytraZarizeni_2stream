// static/js/user.js
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
