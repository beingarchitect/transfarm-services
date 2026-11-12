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
export { recordDailyRainfall } from "./features/rainfall";
export { deletePlotTerrain, getPlotTerrain } from "./features/terrain";
export { claimPendingMemberships, createFarmInvite, joinFarmWithInvite } from "./features/members";
export { initNewFarmSubscription, syncOwnerSubscription } from "./features/subscriptions";
export { deleteMyAccount, getAccountDeletionPreview } from "./features/account";
export { recordConsent } from "./features/consent";
export { seedNewFarmDefaults } from "./features/farmDefaults";
export {
  cleanupBudgetAttachments,
  cleanupExpenseAttachments,
  cleanupIncomeAttachments,
  cleanupSoilTestAttachments,
} from "./features/attachments";
export {
  adminAuditLog,
  adminFindUser,
  adminGetFarm,
  adminImportEvents,
  adminListEvents,
  adminListFarms,
  adminListGrants,
  adminListUsers,
  adminSeedDefaultLists,
  adminSetTier,
  adminStats,
  adminUsage,
  adminWhoAmI,
  buildAdminStats,
} from "./features/admin";
