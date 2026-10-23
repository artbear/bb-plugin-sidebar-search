import { definePluginApp } from "@get-bb/plugin-sdk/app";
import { mountHeaderSearch } from "./header-search";
import "./app.css";

export default definePluginApp((app) => {
  app.contentScripts.register({
    id: "header-search",
    mount: ({ signal }) => mountHeaderSearch(document, signal),
  });
});
