import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { TracePage } from "./TracePage.tsx";
import "./styles.css";

const page = window.location.pathname.startsWith("/traces") ? <TracePage /> : <App />;
createRoot(document.getElementById("root")!).render(page);
