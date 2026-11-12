/** Location adapter for HA 2026.11 native energy components. Apache-2.0. */
const DOMAIN = "multi_location_energy";
const ENERGY_COMMANDS = new Set(["get_prefs", "save_prefs", "info", "validate", "solar_forecast"]);

// Match HA 2026.11's data/context/updateContext.ts: sensor updates must not
// invalidate reactive registry, translation or configuration consumers.
const CONTEXT_FIELDS = {
  hassRegistries: ["entities", "devices", "areas", "floors"],
  hassInternationalization: ["localize", "locale", "loadBackendTranslation", "loadFragmentTranslation", "language", "selectedLanguage", "translationMetadata"],
  hassApi: ["callService", "callApi", "callApiRaw", "callWS", "sendWS", "fetchWithAuth"],
  hassConnection: ["connection", "connected", "debugConnection", "hassUrl"],
  hassUi: ["themes", "selectedTheme", "panels", "panelUrl", "dockedSidebar", "kioskMode", "enableShortcuts", "vibrate", "suspendWhenHidden"],
  hassConfig: ["auth", "config", "user", "userData", "systemData"],
  hassFormatters: ["formatEntityState", "formatEntityStateToParts", "formatEntityAttributeValue", "formatEntityAttributeValueToParts", "formatEntityAttributeName", "formatEntityName"],
};

export function scopedContext(hass, context, previous) {
  const fields = CONTEXT_FIELDS[context];
  if (!fields) return hass[context];
  if (previous && fields.every(key => previous[key] === hass[key])) return previous;
  return Object.fromEntries(fields.map(key => [key, hass[key]]));
}

export function scopedMessage(message, locationId) {
  if (message.type?.startsWith("energy/")) {
    const command = message.type.slice(7);
    if (ENERGY_COMMANDS.has(command)) {
      return { ...message, type: `${DOMAIN}/${command}`, location_id: locationId };
    }
    // This native command accepts explicit statistic IDs and has no global prefs.
    if (command === "fossil_energy_consumption") return message;
    throw new Error(`Unsupported native energy command: ${message.type}`);
  }
  if (message.type?.startsWith("frontend/") && message.key === "energy") {
    const operation = message.type.slice(9);
    if (operation === "get_system_data") return { type: `${DOMAIN}/frontend/get`, location_id: locationId };
    if (operation === "set_system_data") return { type: `${DOMAIN}/frontend/set`, location_id: locationId, value: message.value };
    throw new Error(`Unsupported energy frontend command: ${message.type}`);
  }
  return message;
}

export function createLocationScope(initialHass, locationId, options = {}) {
  let current = initialHass;
  let sourceConfig, namedConfig;
  const cache = Object.create(null);
  const listeners = new Set();
  const dispatch = async (message) => {
    const mapped = scopedMessage(message, locationId);
    const result = await current.callWS(mapped);
    if (mapped.type === `${DOMAIN}/frontend/set`) {
      for (const listener of listeners) listener({ value: message.value });
    }
    if (mapped.type === `${DOMAIN}/save_prefs`) {
      // Invalidate both Now and historical collections; their native modules
      // refresh on the next render/subscription. Never touch the real connection.
      for (const value of Object.values(cache)) {
        if (value && typeof value === "object" && "prefs" in value) value.prefs = undefined;
      }
    }
    return result;
  };
  const subscription = (callback, message, ...args) => {
    if (message.type === "frontend/subscribe_system_data" && message.key === "energy") {
      listeners.add(callback);
      dispatch({ type: "frontend/get_system_data", key: "energy" }).then(callback).catch(() => {});
      return Promise.resolve(() => listeners.delete(callback));
    }
    return current.connection.subscribeMessage(callback, scopedMessage(message, locationId), ...args);
  };
  const connection = new Proxy(Object.create(null), {
    get(_target, key) {
      if (key === "sendMessagePromise") return dispatch;
      if (key === "subscribeMessage") return subscription;
      if (Object.hasOwn(cache, key)) return cache[key];
      // Native collections live on connection properties beginning with _energy.
      if (typeof key === "string" && key.startsWith("_energy")) return undefined;
      const value = current.connection[key];
      return typeof value === "function" ? value.bind(current.connection) : value;
    },
    set(_target, key, value) {
      cache[key] = value;
      if (typeof key === "string" && key.startsWith("_energy")) options.onCollection?.(key, value);
      return true;
    },
    deleteProperty(_target, key) { delete cache[key]; return true; },
    has(_target, key) { return Object.hasOwn(cache, key) || (typeof key !== "string" || !key.startsWith("_energy")) && key in current.connection; },
  });
  return {
    locationId,
    connection,
    update(hass) {
      current = hass;
      if (sourceConfig !== hass.config || !namedConfig) {
        sourceConfig = hass.config;
        namedConfig = options.name ? { ...hass.config, location_name: options.name } : hass.config;
      }
      const config = namedConfig;
      return new Proxy(hass, {
        get(target, key) {
          if (key === "callWS") return dispatch;
          if (key === "connection") return connection;
          if (key === "panelUrl") return `energy-locations/${locationId}`;
          if (key === "config") return config;
          return Reflect.get(target, key);
        },
      });
    },
    dispose() {
      listeners.clear();
      // Native children unsubscribe when detached. Cancel timers left in the
      // disconnected collection's grace period, without mutating global state.
      for (const value of Object.values(cache)) {
        if (!value || typeof value !== "object") continue;
        for (const timer of ["_refreshTimeout", "_updatePeriodTimeout"]) {
          if (value[timer] !== undefined) clearTimeout(value[timer]);
        }
      }
    },
  };
}
