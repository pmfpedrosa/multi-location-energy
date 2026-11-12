import { CARD_TYPES, getLocations } from "./location-card.js?v=0.3.0-beta.3";

class LocationCardEditor extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: "open" }); this._locations = []; }
  setConfig(config) { this._config = structuredClone(config); this._render(); }
  set hass(hass) {
    const changed = this._hass?.connection !== hass.connection;
    this._hass = hass;
    if (changed) this._load();
  }
  async _load() {
    const connection = this._hass.connection;
    try {
      const locations = await getLocations(this._hass);
      if (connection !== this._hass.connection) return;
      this._locations = locations; this._error = "";
    } catch (error) { this._error = error.message || String(error); }
    this._render();
  }
  _change(patch) {
    this._config = { ...this._config, ...patch };
    this.dispatchEvent(new CustomEvent("config-changed", { bubbles: true, composed: true, detail: { config: this._config } }));
  }
  _render() {
    if (!this._config) return;
    this.shadowRoot.innerHTML = `<style>
      :host{display:block}label{display:flex;flex-direction:column;gap:8px;margin:16px 0}input,select,textarea{box-sizing:border-box;width:100%;padding:12px;font:inherit;color:var(--primary-text-color);background:var(--card-background-color);border:1px solid var(--divider-color);border-radius:8px}p{font-size:13px;color:var(--secondary-text-color)}[role=alert]{color:var(--error-color)}textarea{min-height:100px}
      </style><label>Location<select id="location" aria-label="Location"><option value="">Select a location</option></select></label>
      <label>Native card<select id="kind" aria-label="Native card"></select></label>
      <label>Title (optional)<input id="title"></label>
      <label>Date group (optional)<input id="group" maxlength="100"></label>
      <p>Cards in the same dashboard and date group share date and comparison selections. Use a different group for independent dates. Power Sankey always shows live readings and ignores the selected date; use Energy Sankey for a selected period.</p>
      <details><summary>Advanced native options</summary><p>JSON options accepted by the selected native card. Type, collection key and dashboard links are managed automatically.</p><label>Native options<textarea id="options" spellcheck="false"></textarea></label></details>
      <p role="alert" id="error"></p>`;
    const locationSelect = this.shadowRoot.querySelector("#location");
    for (const location of this._locations) {
      const option = document.createElement("option"); option.value = location.id; option.textContent = location.name;
      locationSelect.append(option);
    }
    if (this._config.location_id && !this._locations.some(item => item.id === this._config.location_id)) {
      const option = document.createElement("option"); option.value = this._config.location_id; option.textContent = "Current location (loading or unavailable)"; locationSelect.append(option);
    }
    locationSelect.value = this._config.location_id || "";
    locationSelect.onchange = () => this._change({ location_id: locationSelect.value });
    const kind = this.shadowRoot.querySelector("#kind");
    for (const type of CARD_TYPES) {
      const option = document.createElement("option"); option.value = type;
      option.textContent = type.replace(/^energy-/, "").replaceAll("-", " ").replace(/^./, letter => letter.toUpperCase());
      if (type === "energy-sankey") option.textContent = "Energy Sankey (selected period, kWh)";
      if (type === "power-sankey") option.textContent = "Power Sankey (live, W)";
      kind.append(option);
    }
    kind.value = this._config.card_type || "energy-distribution";
    kind.onchange = () => this._change({ card_type: kind.value });
    const title = this.shadowRoot.querySelector("#title"); title.value = this._config.options?.title || "";
    title.onchange = () => { const options = { ...this._config.options }; if (title.value.trim()) options.title = title.value.trim(); else delete options.title; this._change({ options }); };
    const group = this.shadowRoot.querySelector("#group"); group.value = this._config.date_group || "";
    group.onchange = () => { const next = { ...this._config }; if (group.value.trim()) next.date_group = group.value.trim(); else delete next.date_group; this._config = next; this._change({}); };
    const options = this.shadowRoot.querySelector("#options"); options.value = JSON.stringify(this._config.options || {}, null, 2);
    options.onchange = () => {
      try {
        const value = JSON.parse(options.value || "{}");
        if (!value || typeof value !== "object" || Array.isArray(value) || ["type", "collection_key", "link_dashboard"].some(key => Object.hasOwn(value, key))) throw new Error("Enter an options object without type, collection_key or link_dashboard.");
        this.shadowRoot.querySelector("#error").textContent = "";
        this._change({ options: value });
      } catch (error) { this.shadowRoot.querySelector("#error").textContent = error.message; }
    };
    this.shadowRoot.querySelector("#error").textContent = this._error || "";
  }
}
if (!customElements.get("multi-location-energy-card-editor")) customElements.define("multi-location-energy-card-editor", LocationCardEditor);
