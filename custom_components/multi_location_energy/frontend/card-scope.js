/** Shared native collections for reusable cards. Preferences never leave a location. */
import { createLocationScope } from "./scope.js?v=0.3.0-beta.3";

const connections = new WeakMap();
const encode = value => Array.from(new TextEncoder().encode(value), byte => byte.toString(16).padStart(2, "0")).join("");
export const collectionKey = (group, id) => `energy_mle_${encode(group)}_${encode(id)}`;

export function acquireCardScope(hass, location, groupName) {
  let groups = connections.get(hass.connection);
  if (!groups) connections.set(hass.connection, groups = new Map());
  let group = groups.get(groupName);
  if (!group) groups.set(groupName, group = { entries: new Map(), collections: new Set(), selection: {}, applying: false });
  let entry = group.entries.get(location.id);
  if (!entry) {
    const key = collectionKey(groupName, location.id);
    entry = { key, refs: 0, collections: new Map() };
    const attach = (connectionKey, collection) => {
      if (connectionKey !== `_${key}` || !collection?.setPeriod || !collection?.setCompare || entry.collections.has(collection)) return;
      const period = collection.setPeriod.bind(collection);
      const compare = collection.setCompare.bind(collection);
      entry.collections.set(collection, { period, compare, originalPeriod: collection.setPeriod, originalCompare: collection.setCompare });
      group.collections.add(collection);
      const apply = (method, args) => {
        if (group.applying) return;
        group.applying = true;
        try {
          for (const other of group.collections) {
            if (other === collection) continue;
            other[method](...args);
            if (other.isActive()) Promise.resolve(other.refresh()).catch(() => {});
          }
        } finally { group.applying = false; }
      };
      collection.setPeriod = (start, end) => {
        period(start, end);
        if (!group.applying) {
          group.selection.period = [new Date(start), end ? new Date(end) : undefined];
          apply("setPeriod", group.selection.period);
        }
      };
      collection.setCompare = value => {
        compare(value);
        if (!group.applying) {
          group.selection.compare = [value];
          apply("setCompare", [value]);
        }
      };
      // A card added after a date selection must start on that same range.
      if (group.selection.period) period(...group.selection.period);
      else group.selection.period = [new Date(collection.start), collection.end ? new Date(collection.end) : undefined];
      if (group.selection.compare) compare(...group.selection.compare);
      else group.selection.compare = [collection.compare];
    };
    entry.scope = createLocationScope(hass, location.id, { name: location.name, onCollection: attach });
    group.entries.set(location.id, entry);
  }
  entry.refs++;
  let released = false;
  return {
    key: entry.key,
    update: value => entry.scope.update(value),
    release() {
      if (released) return;
      released = true;
      entry.refs--;
      queueMicrotask(() => {
        if (entry.refs) return;
        for (const [collection, methods] of entry.collections) {
          group.collections.delete(collection);
          collection.setPeriod = methods.originalPeriod;
          collection.setCompare = methods.originalCompare;
        }
        entry.scope.dispose();
        group.entries.delete(location.id);
        if (!group.entries.size) groups.delete(groupName);
      });
    },
  };
}
