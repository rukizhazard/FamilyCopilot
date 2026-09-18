import { authFactory } from "./msal-adapter.js";
import { mount } from "./ui.js";
import config from "./public-config.json";

mount({ config, origin:location.origin, authFactory, fetcher:fetch.bind(globalThis) });