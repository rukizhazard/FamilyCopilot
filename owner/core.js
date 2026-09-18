"use strict";
(function (root) {
  const initial = () => ({ phase: "idle", generation: 0, acknowledged: false, used: false, calendars: [], selected: [] });
  function validList(data) {
    return data && ["listed", "empty"].includes(data.status) && data.eventsRead === 0 && data.completeness === "unknown" &&
      data.ownership === "unverified" && data.cleanup === "workflow_disabled" && Array.isArray(data.calendars) &&
      data.calendars.length <= 100 && data.count === data.calendars.length && (data.status === "empty") === (data.count === 0) &&
      data.calendars.every(c => c && typeof c.key === "string" &&
        /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(c.key) && typeof c.name === "string" && c.name.length <= 1024) &&
      new Set(data.calendars.map(c => c.key)).size === data.count;
  }
  function transition(state, action) {
    if (action.type === "clear") return { ...initial(), phase: "cleared", generation: state.generation + 1, used: state.used };
    if (action.type === "ack") return action.value === true ? { ...state, acknowledged: true } :
      { ...initial(), phase: "cleared", used: state.used, generation: state.generation + 1 };
    if (action.type === "load" && state.acknowledged && !state.used) return { ...state, phase: "loading", used: true, generation: state.generation + 1, calendars: [], selected: [] };
    if (action.type === "loaded" && state.phase === "loading" && action.generation === state.generation && validList(action.data)) {
      return { ...state, phase: action.data.count ? "selecting" : "empty", calendars: action.data.calendars.map(({ key, name }) => ({ key, name })), selected: [] };
    }
    if (action.type === "failed" && state.phase === "loading" && action.generation === state.generation) return { ...state, phase: "unavailable", calendars: [], selected: [] };
    if (action.type === "select" && ["selecting", "summary"].includes(state.phase) && state.calendars.some(c => c.key === action.key)) {
      return { ...state, phase: "selecting", selected: action.value ? [...new Set([...state.selected, action.key])] : state.selected.filter(key => key !== action.key) };
    }
    if (action.type === "review" && state.phase === "selecting" && state.selected.length) return { ...state, phase: "summary" };
    if (action.type === "back" && state.phase === "summary") return { ...state, phase: "selecting" };
    return state;
  }
  const api = { initial, validList, transition };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OwnerCalendar = api;
})(typeof globalThis !== "undefined" ? globalThis : this);