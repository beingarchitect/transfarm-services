import { GoogleAuth } from "google-auth-library";

// Usage for the admin website, from the app's Google Analytics property.
// The functions' service account is a Viewer on the property, and the
// Analytics Data API is enabled on the project. Reports lag about a day, and
// exclude DebugView traffic.

export const GA_PROPERTY = "563348157";
const ENDPOINT = `https://analyticsdata.googleapis.com/v1beta/properties/${GA_PROPERTY}:batchRunReports`;

/** The app's own events (monitoring_service.dart), for the events report. */
export const APP_EVENTS = [
  "farm_created",
  "expense_added",
  "income_added",
  "task_created",
  "ai_message_sent",
  "farm_setup_finished",
  "farm_ready_action",
  "alerts_opened",
  "alert_action",
  "coming_soon_tapped",
  "error_shown",
  "form_abandoned",
  "upgrade_prompt_shown",
  "access_locked_shown",
  "login",
  "sign_up",
];
export const FRICTION_EVENTS = ["error_shown", "form_abandoned", "upgrade_prompt_shown", "access_locked_shown"];

interface GaReport {
  rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[];
}

/** A report's rows as dimension values and numeric metrics. */
export function rowsOf(report: GaReport | undefined): { dims: string[]; mets: number[] }[] {
  return (report?.rows ?? [])
    .map((r) => ({
      dims: (r.dimensionValues ?? []).map((d) => d.value ?? ""),
      mets: (r.metricValues ?? []).map((m) => Number(m.value ?? 0)),
    }))
    .filter((r) => !r.dims.some((d) => d === "(not set)" || d === ""));
}

const dim = (name: string) => ({ name });
const met = (name: string) => ({ name });
const inList = (field: string, values: string[]) => ({
  filter: { fieldName: field, inListFilter: { values } },
});
const equals = (field: string, value: string) => ({
  filter: { fieldName: field, stringFilter: { value, matchType: "EXACT" } },
});
const byMetric = (name: string) => [{ metric: { metricName: name }, desc: true }];

const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/analytics.readonly"] });

async function batch(requests: object[]): Promise<GaReport[]> {
  const client = await auth.getClient();
  const response = await client.request<{ reports?: GaReport[] }>({
    url: ENDPOINT,
    method: "POST",
    data: { requests },
  });
  return response.data.reports ?? [];
}

export async function usageReport(days: number) {
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "yesterday" }];
  const [[trend, screens, events, friction, comingSoon], [roles, languages, tiers, alerts]] = await Promise.all([
    batch([
      { dateRanges, dimensions: [dim("date")], metrics: [met("activeUsers")], orderBys: [{ dimension: { dimensionName: "date" } }] },
      {
        dateRanges,
        dimensions: [dim("unifiedScreenName")],
        metrics: [met("screenPageViews"), met("userEngagementDuration"), met("activeUsers")],
        orderBys: byMetric("screenPageViews"),
        limit: 30,
      },
      {
        dateRanges,
        dimensions: [dim("eventName")],
        metrics: [met("eventCount"), met("totalUsers")],
        dimensionFilter: inList("eventName", APP_EVENTS),
        orderBys: byMetric("eventCount"),
      },
      {
        dateRanges,
        dimensions: [dim("eventName"), dim("customEvent:screen")],
        metrics: [met("eventCount")],
        dimensionFilter: inList("eventName", FRICTION_EVENTS),
        orderBys: byMetric("eventCount"),
        limit: 50,
      },
      {
        dateRanges,
        dimensions: [dim("customEvent:tool")],
        metrics: [met("eventCount"), met("totalUsers")],
        dimensionFilter: equals("eventName", "coming_soon_tapped"),
        orderBys: byMetric("eventCount"),
      },
    ]),
    batch([
      { dateRanges, dimensions: [dim("customUser:farm_role")], metrics: [met("activeUsers")], orderBys: byMetric("activeUsers") },
      { dateRanges, dimensions: [dim("customUser:app_language")], metrics: [met("activeUsers")], orderBys: byMetric("activeUsers") },
      { dateRanges, dimensions: [dim("customUser:plan_tier")], metrics: [met("activeUsers")], orderBys: byMetric("activeUsers") },
      {
        dateRanges,
        dimensions: [dim("customEvent:kind"), dim("customEvent:action")],
        metrics: [met("eventCount")],
        dimensionFilter: equals("eventName", "alert_action"),
        orderBys: byMetric("eventCount"),
      },
    ]),
  ]);

  const split = (report: GaReport) => rowsOf(report).map((r) => ({ name: r.dims[0], users: r.mets[0] }));
  return {
    days,
    generatedAt: new Date().toISOString(),
    trend: rowsOf(trend).map((r) => ({
      date: `${r.dims[0].slice(0, 4)}-${r.dims[0].slice(4, 6)}-${r.dims[0].slice(6, 8)}`,
      users: r.mets[0],
    })),
    screens: rowsOf(screens).map((r) => ({
      name: r.dims[0],
      views: r.mets[0],
      users: r.mets[2],
      // Engagement time per user, in seconds: how long people stay.
      secondsPerUser: r.mets[2] > 0 ? Math.round(r.mets[1] / r.mets[2]) : 0,
    })),
    events: rowsOf(events).map((r) => ({ name: r.dims[0], count: r.mets[0], users: r.mets[1] })),
    friction: rowsOf(friction).map((r) => ({ event: r.dims[0], screen: r.dims[1], count: r.mets[0] })),
    comingSoon: rowsOf(comingSoon).map((r) => ({ tool: r.dims[0], count: r.mets[0], users: r.mets[1] })),
    roles: split(roles),
    languages: split(languages),
    tiers: split(tiers),
    alerts: rowsOf(alerts).map((r) => ({ kind: r.dims[0], action: r.dims[1], count: r.mets[0] })),
  };
}
