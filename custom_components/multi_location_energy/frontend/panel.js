import { createLocationScope } from "./scope.js?v=0.2.1";
import { loadNativeEnergy } from "./native-loader.js?v=0.2.1";
import "./generators.js?v=0.2.1";

const API = "multi_location_energy";
const ROOT = "/energy-locations";

function navigate(path) {
  history.pushState(null, "", path);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
}

class MlePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `<style>
      :host{display:flex;flex-direction:column;height:100%;color:var(--primary-text-color);background:var(--primary-background-color)}
      header{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--divider-color);flex-wrap:wrap}
      h1{font-size:20px;margin:0 auto 0 0}select,input,button{font:inherit;color:inherit;background:var(--card-background-color);border:1px solid var(--divider-color);border-radius:8px;padding:9px 12px}
      button{cursor:pointer}button:disabled{opacity:.5;cursor:wait}.message{padding:20px;max-width:780px;margin:0 auto;line-height:1.6}
      .error{color:var(--error-color)}main{flex:1;min-height:0;overflow:auto;position:relative;contain:layout paint}main>ha-panel-energy,main>ha-config-energy{display:block;min-height:100%}
      .notice{padding:6px 16px;font-size:12px;color:var(--secondary-text-color);border-bottom:1px solid var(--divider-color)}
      #alert:empty{display:none}#alert{padding:12px 16px}dialog{background:var(--card-background-color);color:inherit;border:1px solid var(--divider-color);border-radius:12px;max-width:420px}dialog input{display:block;margin:16px 0;width:90%}.actions{display:flex;gap:8px;justify-content:flex-end}
    </style><header><ha-icon-button id="menu"></ha-icon-button><h1>Energy Locations</h1><select id="locations" aria-label="Location"></select><button id="dashboard">Dashboard</button><button id="settings">Configure</button><button id="rename">Rename</button><button id="create">Add location</button></header>
    <div class="notice">Preview · Home Assistant 2026.11 · Administrator access</div><div id="alert" role="status"></div><main><div class="message">Loading locations…</div></main><div id="dialogs"></div>
    <dialog id="name-dialog"><form><h2 id="dialog-title"></h2><label>Location name<input id="name" maxlength="100" required autocomplete="off"></label><div class="actions"><button type="button" id="cancel">Cancel</button><button type="submit">Save</button></div></form></dialog>`;
    this._main = this.shadowRoot.querySelector("main");
    this._dialogRoot = this.shadowRoot.querySelector("#dialogs");
    this._locations = [];
    this._contextSubscribers = new Set();
    this.addEventListener("context-request", event => {
      const keys = ["hassConnection", "connection", "hassApi", "hassInternationalization", "localize", "locale"];
      if (!keys.includes(event.context)) return;
      event.stopPropagation();
      if (!this._scope) return;
      const notify = () => {
        const scoped = this._scope.update(this._withTranslations(this._hass));
        const value = ["connection", "localize", "locale"].includes(event.context) ? scoped[event.context] : scoped;
        event.callback(value, () => this._contextSubscribers.delete(notify));
      };
      if (event.subscribe) this._contextSubscribers.add(notify);
      notify();
    });
    this._renderRevision = 0;
    this._onRoute = () => this._renderContent().catch(error => this._error(error));
    this.shadowRoot.querySelector("#locations").onchange = event => navigate(`${ROOT}/${event.target.value}/electricity`);
    this.shadowRoot.querySelector("#dashboard").onclick = () => this._go(false);
    this.shadowRoot.querySelector("#settings").onclick = () => this._go(true);
    const generators = document.createElement("button");
    generators.id = "generators"; generators.textContent = "Generators";
    generators.onclick = () => { const { location } = this._selection(); if (location) navigate(`${ROOT}/${location.id}/generators`); };
    this.shadowRoot.querySelector("#settings").after(generators);
    this.shadowRoot.querySelector("#create").onclick = () => this._nameDialog(false);
    this.shadowRoot.querySelector("#rename").onclick = () => this._nameDialog(true);
    this.shadowRoot.querySelector("#cancel").onclick = () => this.shadowRoot.querySelector("dialog").close();
    this.shadowRoot.querySelector("form").onsubmit = event => this._saveName(event);
    this.addEventListener("show-dialog", event => this._showScopedDialog(event), true);
    this.addEventListener("click", event => this._routeNativeLink(event), true);
    this.shadowRoot.querySelector("#menu").path = "M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z";
    this.shadowRoot.querySelector("#menu").setAttribute("aria-label", "Open sidebar");
    this.shadowRoot.querySelector("#menu").onclick = () => this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }));
  }

  set hass(hass) {
    const replacedConnection = this._hass && this._hass.connection !== hass.connection;
    this._hass = hass;
    if (this._scope) {
      const scoped = this._scope.update(this._withTranslations(hass));
      if (this._child) this._child.hass = scoped;
      for (const dialog of this._dialogRoot.children) dialog.hass = scoped;
      for (const notify of this._contextSubscribers) notify();
    }
    if (replacedConnection && this._started) { this._mountKey = undefined; this._onRoute(); }
    if (!this._started && this.isConnected) this._start();
  }
  get hass() { return this._hass; }
  _withTranslations(hass) {
    if (!this._nativeLocalize) return hass;
    return { ...hass, localize: (...args) => hass.localize(...args) || this._nativeLocalize(...args) };
  }
  set route(route) { this._route = route; if (this._started) this._onRoute(); }
  set narrow(narrow) { this._narrow = narrow; if (this._child) this._child.narrow = narrow; }
  set panel(panel) { this._panel = panel; }
  connectedCallback() {
    window.addEventListener("location-changed", this._onRoute);
    window.addEventListener("popstate", this._onRoute);
    if (this._hass && !this._started) this._start();
  }
  disconnectedCallback() {
    window.removeEventListener("location-changed", this._onRoute);
    window.removeEventListener("popstate", this._onRoute);
    this._main.replaceChildren();
    this._dialogRoot.replaceChildren();
    this._contextSubscribers.clear();
    this._scope?.dispose();
    this._scope = undefined;
    this._child = undefined;
    this._mountKey = undefined;
    this._started = false;
  }
  async _start() {
    this._started = true;
    try {
      if (!this._hass.user?.is_admin) throw new Error("Administrator access is required for this preview.");
      await this._refreshLocations();
      this._nativeLocalize = await loadNativeEnergy(this._hass);
      await this._renderContent();
    } catch (error) { this._error(error); this._started = false; }
  }
  _error(error) {
    const box = this.shadowRoot.querySelector("#alert");
    box.className = "error";
    box.textContent = error.message || String(error);
  }
  _call(command, args = {}) { return this._hass.callWS({ type: `${API}/${command}`, ...args }); }
  async _refreshLocations() {
    this._locations = await this._call("locations/list");
    const select = this.shadowRoot.querySelector("select");
    select.replaceChildren(...this._locations.map(location => {
      const option = document.createElement("option"); option.value = location.id; option.textContent = location.name; return option;
    }));
  }
  _selection() {
    const parts = window.location.pathname.slice(ROOT.length).split("/").filter(Boolean);
    return { location: this._locations.find(item => item.id === parts[0]) || this._locations[0], settings: parts[1] === "configure", tab: (parts[1] === "configure" ? parts[2] : parts[1]) || "electricity" };
  }
  _go(settings) {
    const { location } = this._selection();
    if (location) navigate(`${ROOT}/${location.id}/${settings ? "configure/" : ""}electricity`);
  }
  async _renderContent() {
    if (!this._hass || !this._started || !customElements.get("ha-panel-energy")) return;
    const revision = ++this._renderRevision;
    const { location, settings, tab } = this._selection();
    for (const id of ["settings", "dashboard", "rename"]) this.shadowRoot.querySelector(`#${id}`).disabled = !location;
    if (!location) {
      this._main.innerHTML = '<div class="message"><h2>Independent energy dashboards for every location</h2><p>Add a location, then select its grid, solar, battery, gas, water and device measurements in Configure.</p></div>';
      return;
    }
    this.shadowRoot.querySelector("select").value = location.id;
    this.shadowRoot.querySelector("#generators").disabled = !location;
    const key = `${location.id}:${settings}:${tab === "generators"}`;
    if (this._mountKey === key && this._child) {
      this._child.route = { prefix: `${ROOT}/${location.id}${settings ? "/configure" : ""}`, path: `/${tab}` };
      return;
    }
    const prefs = await this._call("get_prefs", { location_id: location.id });
    if (revision !== this._renderRevision || !this.isConnected) return;
    this._main.replaceChildren(); this._dialogRoot.replaceChildren(); this._scope?.dispose();
    this._contextSubscribers.clear();
    this._scope = createLocationScope(this._hass, location.id);
    const scopedHass = this._scope.update(this._withTranslations(this._hass));
    if (tab === "generators") {
      const child = document.createElement("mle-generators");
      this._mountKey = key; this._child = child; this._main.append(child);
      await child.configure(scopedHass, location.id, prefs);
      return;
    }
    const generators = await this._call("generators/get", { location_id: location.id });
    if (revision !== this._renderRevision || !this.isConnected) return;
    if (generators.length && !settings && tab === "electricity") {
      this._mountKey = undefined;
      navigate(`${ROOT}/${location.id}/generators`);
      return;
    }
    if (generators.length && !settings) {
      const notice = document.createElement("div"); notice.className = "notice";
      notice.textContent = "This native view excludes generator electricity. Open Generators for the complete grid, solar, generator, battery and load balance, including gas consumption and efficiency.";
      this._main.append(notice);
    }
    if (!settings && !prefs.energy_sources.length && !prefs.device_consumption.length && !prefs.device_consumption_water.length) {
      this._mountKey = undefined; this._child = undefined;
      const content = document.createElement("div"); content.className = "message";
      const heading = document.createElement("h2"); heading.textContent = location.name;
      const text = document.createElement("p"); text.textContent = "This location has no energy sources yet. Configure its measurements, or copy the current native Energy settings into this empty location.";
      const configure = document.createElement("button"); configure.textContent = "Configure location"; configure.onclick = () => this._go(true);
      const importButton = document.createElement("button"); importButton.textContent = "Copy native Energy settings";
      importButton.onclick = async () => { importButton.disabled = true; try { await this._call("import_native", { location_id: location.id }); await this._renderContent(); } catch(error) {this._error(error);} finally { importButton.disabled = false; } };
      content.append(heading, text, configure, document.createTextNode(" "), importButton); this._main.append(content); return;
    }
    const child = document.createElement(settings ? "ha-config-energy" : "ha-panel-energy");
    child.hass = scopedHass; child.narrow = this._narrow; child.isWide = !this._narrow;
    child.route = { prefix: `${ROOT}/${location.id}${settings ? "/configure" : ""}`, path: `/${tab}` };
    child.panel = { ...this._panel, url_path: `energy-locations/${location.id}` };
    if (!settings) {
      child._navigateConfig = event => { event?.stopPropagation(); navigate(`${ROOT}/${location.id}/configure/${["gas", "water"].includes(tab) ? tab : "electricity"}`); };
      const nativeSet = child._setLovelace.bind(child);
      child._setLovelace = async () => { await nativeSet(); if(child._lovelace) child._lovelace.urlPath = `energy-locations/${location.id}`; };
    } else {
      const nativeUpdated = child.updated?.bind(child);
      child.updated = changed => {
        nativeUpdated?.(changed);
        const subpage = child.shadowRoot?.querySelector("hass-tabs-subpage");
        if (subpage) {
          subpage.tabs = subpage.tabs.map(item => ({ ...item, path: item.path.replace("/config/energy", `${ROOT}/${location.id}/configure`) }));
          subpage.setAttribute("back-path", `${ROOT}/${location.id}/electricity`);
        }
      };
    }
    this._mountKey = key; this._child = child; this._main.append(child);
    this.shadowRoot.querySelector("#alert").textContent = "";
  }
  _routeNativeLink(event) {
    const link = event.composedPath().find(node => node instanceof HTMLAnchorElement && node.href);
    if (!link) return;
    const url = new URL(link.href, location.origin);
    if (url.origin !== location.origin) return;
    const { location: selected } = this._selection();
    if (!selected) return;
    let target;
    if (url.pathname.startsWith("/config/energy")) target = `${ROOT}/${selected.id}/configure/${url.pathname.split("/")[3] || "electricity"}`;
    else if (url.pathname.startsWith("/energy/")) target = `${ROOT}/${selected.id}/${url.pathname.split("/")[2]}`;
    else if (url.pathname === "/config/lovelace/dashboards") target = `${ROOT}/${selected.id}/electricity`;
    if (target) { event.preventDefault(); event.stopImmediatePropagation(); navigate(target); }
  }
  async _showScopedDialog(event) {
    if (!this._scope || !event.detail?.dialogTag) return;
    event.stopPropagation();
    const scope = this._scope;
    try {
      const { dialogTag, dialogImport, dialogParams } = event.detail;
      if (dialogImport) await dialogImport();
      if (scope !== this._scope || !this.isConnected) return;
      const dialog = document.createElement(dialogTag); dialog.hass = scope.update(this._withTranslations(this._hass));
      dialog.addEventListener("dialog-closed", () => dialog.remove(), { once: true });
      this._dialogRoot.append(dialog);
      await dialog.showDialog(dialogParams);
    } catch(error) { this._error(error); }
  }
  _nameDialog(rename) {
    this._renaming = rename;
    this.shadowRoot.querySelector("#dialog-title").textContent = rename ? "Rename location" : "Add location";
    const input = this.shadowRoot.querySelector("#name"); input.value = rename ? this._selection().location.name : "";
    this.shadowRoot.querySelector("#name-dialog").showModal(); input.focus();
  }
  async _saveName(event) {
    event.preventDefault();
    const name = this.shadowRoot.querySelector("#name").value.trim(); if (!name) return;
    const submit = event.target.querySelector('[type="submit"]'); submit.disabled = true;
    try {
      const current = this._selection().location;
      const result = this._renaming ? await this._call("locations/rename", { location_id: current.id, name }) : await this._call("locations/create", { name });
      await this._refreshLocations(); this.shadowRoot.querySelector("dialog").close();
      if (result?.id) navigate(`${ROOT}/${result.id}/configure/electricity`);
      else await this._renderContent();
    } catch(error) {this._error(error);} finally {submit.disabled = false;}
  }
}
customElements.define("mle-panel", MlePanel);
