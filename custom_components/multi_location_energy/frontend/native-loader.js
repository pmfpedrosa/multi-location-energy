/** Version-pinned lazy loader. Uses detached native routers, never global patches. */
let loading;
export function loadNativeEnergy(hass) {
  loading ||= (async () => {
    if (!/^2026\.11\./.test(hass.config.version)) throw new Error("This preview requires Home Assistant 2026.11.x.");
    const resolver = document.createElement("partial-panel-resolver");
    resolver.hass = hass;
    if (typeof resolver._getRoutes !== "function") throw new Error("The native panel loader changed. This frontend version needs a compatibility update.");
    const routes = resolver._getRoutes(hass.panels).routes;
    const energyRoute = routes.energy || Object.values(routes).find(route => route.tag === "ha-panel-energy");
    if (!energyRoute?.load || !routes.config?.load) throw new Error("Native Energy and Settings panels must be enabled.");
    await Promise.all([energyRoute.load(), routes.config.load()]);
    const settingsRouter = document.createElement("ha-panel-config");
    settingsRouter.hass = hass;
    const loadSettings = settingsRouter.routerOptions?.routes?.energy?.load;
    if (!loadSettings) throw new Error("The native energy settings loader changed.");
    await loadSettings();
    await Promise.all([customElements.whenDefined("ha-panel-energy"), customElements.whenDefined("ha-config-energy")]);
  })().catch(error => { loading = undefined; throw error; });
  return loading;
}
