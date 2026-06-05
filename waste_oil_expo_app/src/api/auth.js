import { unwrap } from "./_unwrap.js";

export function login(username, password) {
  return unwrap(
    window.api.auth.login({ username, password })
  );
}

export function logout(refreshToken) {
  return unwrap(
    window.api.auth.logout({ refresh_token: refreshToken })
  );
}

export function me(token) {
  return unwrap(window.api.auth.me(token));
}
