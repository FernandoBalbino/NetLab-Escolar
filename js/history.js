(function () {
  "use strict";

  var NetLab = window.NetLab = window.NetLab || {};
  var past = [];
  var future = [];
  var MAX_STATES = 50;

  function serialized(snapshot) { return JSON.stringify(snapshot); }

  function initialize() {
    past = [NetLab.State.captureProject()];
    future = [];
    NetLab.State.emit("history");
  }

  function record() {
    var snapshot = NetLab.State.captureProject();
    if (past.length && serialized(past[past.length - 1]) === serialized(snapshot)) return false;
    past.push(snapshot);
    if (past.length > MAX_STATES) past.shift();
    future = [];
    NetLab.State.emit("history");
    return true;
  }

  function undo() {
    if (past.length <= 1) return false;
    future.push(past.pop());
    NetLab.State.restoreProject(past[past.length - 1], "undo");
    return true;
  }

  function redo() {
    if (!future.length) return false;
    var snapshot = future.pop();
    past.push(snapshot);
    NetLab.State.restoreProject(snapshot, "redo");
    return true;
  }

  function reset() { initialize(); }
  function canUndo() { return past.length > 1; }
  function canRedo() { return future.length > 0; }

  NetLab.History = { initialize: initialize, record: record, undo: undo, redo: redo, reset: reset, canUndo: canUndo, canRedo: canRedo };
}());
