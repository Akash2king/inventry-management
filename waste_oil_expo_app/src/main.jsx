import "@/platform/installBrowserApi.js";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "@/assets/styles/global.css";

const IS_PRODUCTION = import.meta.env.PROD;

function applyProductionUiHardening() {
  if (!IS_PRODUCTION) {
    return;
  }

  // Prevent webview/browser context menu in production bundles.
  window.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
}

applyProductionUiHardening();

ReactDOM.createRoot(document.getElementById("root")).render(
  IS_PRODUCTION ? (
    <App />
  ) : (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
);
