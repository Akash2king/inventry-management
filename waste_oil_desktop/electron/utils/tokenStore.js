const Store = require("electron-store");

const store = new Store({
  name: "waste-oil-auth",
});

function getAccessToken() {
  return store.get("accessToken") || null;
}

function setAccessToken(t) {
  if (t == null || t === "") {
    store.delete("accessToken");
    return;
  }
  store.set("accessToken", t);
}

function getRefreshToken() {
  return store.get("refreshToken") || null;
}

function setRefreshToken(t) {
  if (t == null || t === "") {
    store.delete("refreshToken");
    return;
  }
  store.set("refreshToken", t);
}

function clearTokens() {
  store.delete("accessToken");
  store.delete("refreshToken");
}

module.exports = {
  getAccessToken,
  setAccessToken,
  getRefreshToken,
  setRefreshToken,
  clearTokens,
};
