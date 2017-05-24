
const test = require("./Store");

const MemoryStore = require("../lib/MemoryStore");
const store = new MemoryStore();

store.__getUserRights = test.getUserRights;
store._data = test.data;

test.describeStore("MemoryStore", store);
