import { setGlobalOptions } from "firebase-functions/v2";

setGlobalOptions({
  region: "asia-south1",
  memory: "512MiB",
  minInstances: 1,
});

export {
  getMandiMarketPrices,
  getMandiMarketSummary,
  getMarketCommodities,
  syncKarnatakaMandiPricesDaily,
} from "./features/market";
export { getWeatherForecast } from "./features/weather";
export { askAiAssistant } from "./features/ai";
