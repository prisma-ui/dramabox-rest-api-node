import fs from "fs";
import axios from "axios";

let proxies = [];
let failedProxies = new Set(); // track proxies that returned 403
let lastRotatedProxy = null;

// ============================================
// LOADING
// ============================================

// Load proxies from a local file (one per line, e.g. http://user:pass@host:port)
export function loadLocalProxy() {
  try {
    const file = fs.readFileSync("./proxyList.txt", "utf-8");
    const loaded = file
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    proxies.push(...loaded);
    proxies = [...new Set(proxies)];
    console.log(`[ProxyManager] Loaded ${loaded.length} local proxies (total: ${proxies.length})`);
  } catch (err) {
    console.log("[ProxyManager] Cannot load proxyList.txt:", err.message);
  }
}

// Optionally load online proxy list (free proxies — less reliable)
export async function loadOnlineProxy() {
  try {
    const res = await axios.get(
      "https://proxylist.geonode.com/api/proxy-list?limit=20"
    );
    const online = res.data.data.map(
      (p) => `${p.protocols[0]}://${p.ip}:${p.port}`
    );

    proxies.push(...online);
    proxies = [...new Set(proxies)];

    console.log(`[ProxyManager] Added ${online.length} online proxies (total: ${proxies.length})`);
  } catch (error) {
    console.log("[ProxyManager] Failed to fetch online proxies:", error.message);
  }
}

// Add a single proxy programmatically
export function addProxy(proxyUrl) {
  if (proxyUrl && !proxies.includes(proxyUrl)) {
    proxies.push(proxyUrl);
    console.log(`[ProxyManager] Added proxy: ${proxyUrl}`);
  }
}

// ============================================
// SELECTION & ROTATION
// ============================================

// Get a random proxy, skipping ones that have recently failed
export function getRandomProxy() {
  const available = proxies.filter((p) => !failedProxies.has(p));

  // If all proxies are marked failed, reset and try again
  if (available.length === 0 && proxies.length > 0) {
    console.warn("[ProxyManager] ⚠️  All proxies marked failed — resetting failure list");
    failedProxies.clear();
    return proxies[Math.floor(Math.random() * proxies.length)];
  }

  if (available.length === 0) return null;

  const chosen = available[Math.floor(Math.random() * available.length)];
  lastRotatedProxy = chosen;
  return chosen;
}

// Mark a proxy as failed so it gets skipped on the next pick
export function markProxyFailed(proxyUrl) {
  if (proxyUrl) {
    failedProxies.add(proxyUrl);
    console.warn(`[ProxyManager] Marked proxy as failed: ${proxyUrl} (${failedProxies.size}/${proxies.length} failed)`);
  }
}

// Auto-rotate on an interval (optional, for long-running servers)
export function autoRotate(seconds = 30) {
  setInterval(() => {
    lastRotatedProxy = getRandomProxy();
    console.log("[ProxyManager] 🔄 Rotated proxy:", lastRotatedProxy);
  }, seconds * 1000);
}

export function getCurrentProxy() {
  return lastRotatedProxy || getRandomProxy();
}

export function getProxyStats() {
  return {
    total: proxies.length,
    failed: failedProxies.size,
    available: proxies.filter((p) => !failedProxies.has(p)).length,
  };
}
