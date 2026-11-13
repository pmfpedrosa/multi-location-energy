/** Wraps installed native HA cards with an explicitly location-scoped context. */
import { acquireCardScope } from "./card-scope.js?v=0.4.0-beta.1";
import { scopedContext } from "./scope.js?v=0.4.0-beta.1";

export const CARD_TYPES = [
  "energy-distribution", "energy-date-selection", "energy-usage-graph",
  "energy-sources-table", "energy-solar-graph", "energy-sankey",
  "energy-devices-graph", "energy-devices-detail-graph", "energy-grid-balance",
  "energy-grid-neutrality-gauge", "energy-self-sufficiency-gauge",
  "energy-solar-consumed-gauge", "energy-carbon-consumed-gauge",
  "energy-gas-graph", "energy-water-graph", "water-sankey",
  "power-sources-graph", "power-sankey",
  "energy-generator-graph", "energy-generator-contribution",
];
const contexts = new Set(["hassConnection", "hassApi", "hassConfig", "hassUi", "hassInternationalization", "hassFormatters", "hassRegistries", "connection", "locale", "localize"]);

export async function getLocations(hass) {
  if (!hass.user?.is_admin) throw new Error("Energy Locations cards require an administrator account.");
  return hass.callWS({ type: "multi_location_energy/locations/list" });
}

export function validateConfig(config) {
  if (!config || typeof config.location_id !== "string" || !config.location_id.trim()) throw new Error("Select an Energy Location.");
  const cardType = config.card_type || "energy-distribution";
  if (!CARD_TYPES.includes(cardType)) throw new Error(`Unsupported native energy card: ${cardType}`);
  if (config.date_group !== undefined && (typeof config.date_group !== "string" || !config.date_group.trim() || config.date_group.length > 100)) throw new Error("Date group must contain 1–100 characters.");
  if (config.options !== undefined && (!config.options || typeof config.options !== "object" || Array.isArray(config.options))) throw new Error("Native options must be an object.");
  if (["type", "collection_key", "link_dashboard"].some(key => Object.hasOwn(config.options || {}, key))) throw new Error("Native options cannot override type, collection_key or link_dashboard.");
  return { ...config, card_type: cardType, options: { ...config.options } };
}

export async function helpers(hass) {
  if (!/^2026\.11\./.test(hass.config.version)) throw new Error("Energy Locations cards require Home Assistant 2026.11.x.");
  // Lovelace normally owns this helper. The fallback supports direct cold loads.
  if (!window.loadCardHelpers) {
    const resolver = document.createElement("partial-panel-resolver");
    resolver.hass = hass;
    const routes = resolver._getRoutes?.(hass.panels).routes;
    const route = routes?.lovelace || Object.values(routes || {}).find(item => item.tag === "ha-panel-lovelace");
    if (!route?.load) throw new Error("Native dashboard card loader is unavailable.");
    await route.load();
  }
  if (!window.loadCardHelpers) throw new Error("Native dashboard card loader is unavailable.");
  return window.loadCardHelpers();
}

export class MultiLocationEnergyCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = '<style>:host{display:block;height:100%;min-width:0}#body{height:100%}#body>*{display:block;height:100%;min-width:0}.error{padding:16px;color:var(--error-color);border:1px solid var(--divider-color);border-radius:12px}</style><div id="body"></div>';
    this._body = this.shadowRoot.querySelector("#body");
    this._revision = 0;
    this._subscribers = new Set();
    this.addEventListener("context-request", event => {
      if (!contexts.has(event.context)) return;
      event.stopPropagation();
      if (!this._lease || !this._hass) return;
      let previous, initialized = false;
      const notify = () => {
        const scoped = this._lease.update(this._hass);
        const value = scopedContext(scoped, event.context, previous);
        if (initialized && value === previous) return;
        previous = value;
        initialized = true;
        event.callback(value, () => this._subscribers.delete(notify));
      };
      if (event.subscribe) this._subscribers.add(notify);
      notify();
    });
  }
  static async getConfigElement() {
    await import("./location-card-editor.js?v=0.4.0-beta.1");
    return document.createElement("multi-location-energy-card-editor");
  }
  static async getStubConfig(hass) {
    const locations = await getLocations(hass);
    return { type: "custom:multi-location-energy-card", location_id: locations[0]?.id || "", card_type: "energy-distribution" };
  }
  setConfig(config) {
    this._config = validateConfig(config);
    this._reset();
    this._start();
  }
  set hass(hass) {
    const changed = this._hass && (this._hass.connection !== hass.connection || this._hass.panelUrl !== hass.panelUrl || this._hass.user?.id !== hass.user?.id);
    this._hass = hass;
    if (changed) this._reset();
    if (!hass.user?.is_admin) { this._reset(); this._error(new Error("Energy Locations cards require an administrator account.")); return; }
    if (this._child && this._lease) {
      this._child.hass = this._lease.update(hass);
      for (const notify of this._subscribers) notify();
    }
    this._start();
  }
  get hass() { return this._hass; }
  connectedCallback() { this._start(); }
  disconnectedCallback() { this._reset(); }
  getCardSize() { return this._child?.getCardSize?.() ?? (this._config?.card_type === "energy-date-selection" ? 1 : 4); }
  getGridOptions() { return this._child?.getGridOptions?.() ?? { columns: 12, min_columns: 6 }; }
  _reset() {
    this._revision++;
    this._starting = false;
    this._failed = false;
    this._body.replaceChildren();
    this._child = undefined;
    this._subscribers.clear();
    this._lease?.release();
    this._lease = undefined;
  }
  _error(error) {
    this._failed = true;
    const box = document.createElement("div");
    box.className = "error"; box.setAttribute("role", "alert");
    box.textContent = error.message || String(error);
    this._body.replaceChildren(box);
  }
  async _start() {
    if (!this.isConnected || !this._config || !this._hass || this._starting || this._child || this._failed) return;
    this._starting = true;
    const revision = this._revision;
    try {
      const hass = this._hass;
      const [locations, native] = await Promise.all([getLocations(hass), helpers(hass)]);
      if (revision !== this._revision || !this.isConnected) return;
      const location = locations.find(item => item.id === this._config.location_id);
      if (!location) throw new Error("This Energy Location no longer exists. Select a location in the card editor.");
      const group = JSON.stringify([hass.panelUrl || window.location.pathname, this._config.date_group || "default"]);
      this._lease = acquireCardScope(hass, location, group);
      const config = { ...this._config.options, type: this._config.card_type, collection_key: this._lease.key };
      const prefs = await this._lease.update(this._hass).callWS({type:'energy/get_prefs'});
      let generatorTag;
      if(prefs.energy_sources.some(source=>source.type==='generator') || config.type.startsWith('energy-generator-')) {
        const extension=await import('./generator-extension.js?v=0.4.0-beta.1');
        const extendedNative=await extension.loadGeneratorCards(this._hass,native);
        if (revision !== this._revision || !this.isConnected) return;
        extension.initializeGeneratorCollection(extendedNative,this._lease.update(this._hass),this._lease.key);
        if(extension.GENERATOR_CARDS.has(config.type)||config.type.startsWith('energy-generator-'))generatorTag=`mle-hui-${config.type}-card`;
        this.style.setProperty('--energy-generator-color','#009688');
      }
      if (revision !== this._revision || !this.isConnected) return;
      if (config.type === "energy-distribution") {
        config.title ??= location.name;
        config.link_dashboard = false;
      }
      if(!generatorTag)native.createCardElement(config);
      // Helpers return a loading placeholder until the native card is defined.
      await customElements.whenDefined(generatorTag || `hui-${config.type}-card`);
      if (revision !== this._revision || !this.isConnected) return;
      this._child = generatorTag ? document.createElement(generatorTag) : native.createCardElement(config);
      if(generatorTag)this._child.setConfig(config);
      this._child.hass = this._lease.update(this._hass);
      this._body.replaceChildren(this._child);
    } catch (error) {
      if (revision !== this._revision) return;
      this._lease?.release(); this._lease = undefined;
      this._error(error);
    } finally { if (revision === this._revision) this._starting = false; }
  }
}

if (!customElements.get("multi-location-energy-card")) customElements.define("multi-location-energy-card", MultiLocationEnergyCard);
window.customCards ||= [];
if (!window.customCards.some(item => item.type === "multi-location-energy-card")) window.customCards.push({
  type: "multi-location-energy-card", name: "Location Energy", preview: true,
  description: "Native Energy cards for a selected Energy Location.",
});
