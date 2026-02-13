/**
 * Browser-compatible utility functions for generating user metrics reports
 * Combines server data with Matomo analytics
 */

import { RetrieveData } from "./Api";

interface MatomoUserData {
  label: string; // userId/pseudonym
  [key: string]: string | number; // Dynamic columns from Matomo
}

interface ServerReportData {
  pseudonym: string;
  directMessages: string | number;
  [key: string]: string | number; // Additional channel columns
}

/**
 * Fetch detailed visit information including device types and location types (local/remote) per user
 */
async function fetchMatomoVisitDetails(
  siteId: string,
  conversationDate: Date,
  conversationId: string,
): Promise<Map<
  string,
  { deviceTypes: Set<string>; locationTypes: Set<string> }
> | null> {
  if (!siteId || !conversationId) {
    return null;
  }

  const segment = `pageUrl=@assistant?conversationId=${conversationId}`;

  try {
    const formatDate = (date: Date) => date.toISOString().split("T")[0];

    const params: Record<string, string> = {
      module: "API",
      method: "Live.getLastVisitsDetails",
      idSite: siteId,
      period: "day",
      date: formatDate(conversationDate),
      segment,
      format: "JSON",
      filter_limit: "-1",
    };

    console.log(
      `Fetching Matomo visit details for conversationId: ${conversationId}`,
    );

    const response = await fetch("/api/matomo-proxy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ params }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(
        `Matomo visit details request failed with status ${response.status}:`,
        errorData,
      );
      return null;
    }

    const visits = (await response.json()) as any[];

    // Aggregate device types and location types per user
    const userDetails = new Map<
      string,
      { deviceTypes: Set<string>; locationTypes: Set<string> }
    >();

    for (const visit of visits) {
      if (!visit.userId) continue;

      // Check if this visit accessed the specific conversation
      let hasRelevantAction = false;
      const locationTypesForConversation = new Set<string>();

      // Extract location types from action details, filtering for this specific conversation
      if (visit.actionDetails && Array.isArray(visit.actionDetails)) {
        for (const action of visit.actionDetails) {
          if (
            action.url &&
            action.url.includes(`assistant?conversationId=${conversationId}`)
          ) {
            hasRelevantAction = true;

            // Categorize as local or remote
            if (action.url.includes("location=local")) {
              locationTypesForConversation.add("local");
            } else {
              locationTypesForConversation.add("remote");
            }
          }
        }
      }

      // Only add device type if this visit actually accessed this specific conversation
      if (hasRelevantAction) {
        if (!userDetails.has(visit.userId)) {
          userDetails.set(visit.userId, {
            deviceTypes: new Set<string>(),
            locationTypes: new Set<string>(),
          });
        }

        const details = userDetails.get(visit.userId)!;

        // Add device type only if we found relevant actions
        if (visit.deviceType) {
          details.deviceTypes.add(visit.deviceType);
        }

        // Add location types
        for (const locationType of locationTypesForConversation) {
          details.locationTypes.add(locationType);
        }
      }
    }

    console.log(
      `Aggregated device/location data for ${userDetails.size} users from ${visits.length} visits`,
    );
    return userDetails;
  } catch (error: any) {
    console.error(`Error fetching Matomo visit details: ${error.message}`);
    return null;
  }
}

/**
 * Fetch Matomo UserId report for a specific conversation ID
 */
async function fetchMatomoUserIdReport(
  siteId: string,
  conversationDate: Date,
  conversationId: string,
): Promise<{ data: MatomoUserData[]; columns: string[] } | null> {
  if (!siteId || !conversationId) {
    console.log("Matomo configuration incomplete, skipping Matomo data fetch");
    return null;
  }

  // Construct segment to filter for URLs containing 'assistant?conversationId=...'
  const segment = `pageUrl=@assistant?conversationId=${conversationId}`;

  try {
    const formatDate = (date: Date) => date.toISOString().split("T")[0];

    const params: Record<string, string> = {
      module: "API",
      method: "UserId.getUsers",
      idSite: siteId,
      period: "day",
      date: formatDate(conversationDate),
      segment,
      format: "JSON",
      filter_limit: "-1", // Get all rows
    };

    console.log(
      `Fetching Matomo UserId report for date ${formatDate(conversationDate)} for conversationId: ${conversationId}`,
    );

    const response = await fetch("/api/matomo-proxy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ params }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(
        `Matomo API request failed with status ${response.status}:`,
        errorData,
      );
      return null;
    }

    const data = (await response.json()) as MatomoUserData[];

    if (!Array.isArray(data) || data.length === 0) {
      console.log("No Matomo data returned");
      return { data: [], columns: [] };
    }

    // Extract column names from the first row (excluding 'label' which is the userId)
    const columns = Object.keys(data[0]).filter((key) => key !== "label");

    console.log(
      `Fetched ${data.length} user records from Matomo with ${columns.length} metrics`,
    );

    return { data, columns };
  } catch (error: any) {
    console.error(`Error fetching Matomo data: ${error.message}`);
    return null;
  }
}

/**
 * Parse CSV string into array of objects
 */
function parseCSV(csvString: string): ServerReportData[] {
  const lines = csvString.trim().split("\n");
  if (lines.length === 0) return [];

  const headers = lines[0].split(",");
  const data: ServerReportData[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    const row: ServerReportData = { pseudonym: "", directMessages: "" };

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j].toLowerCase().replace(/\s+/g, "");
      if (header === "pseudonym") {
        row.pseudonym = values[j];
      } else if (header === "directmessages") {
        row.directMessages = values[j];
      } else {
        row[headers[j]] = values[j];
      }
    }

    data.push(row);
  }

  return data;
}

/**
 * Fetch user metrics report from the backend
 */
async function fetchUserMetricsReport(
  conversationId: string,
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      reportName: "userMetrics",
      format: "csv",
      additionalChannels: "chat",
      agent: "eventAssistantPlus",
    });

    const urlSuffix = `conversations/${conversationId}/report?${params.toString()}`;
    console.log(`Fetching user metrics report for conversation: ${conversationId}`);

    const response = await RetrieveData(urlSuffix, undefined, "text");

    if (response && typeof response === "object" && "error" in response) {
      console.error(
        `Failed to fetch user metrics report:`,
        response.message,
      );
      return null;
    }

    return response as string;
  } catch (error: any) {
    console.error(`Error fetching user metrics report: ${error.message}`);
    return null;
  }
}

/**
 * Combine server data with Matomo data and generate CSV
 */
function generateCombinedCSV(
  serverData: ServerReportData[],
  matomoData: MatomoUserData[] | null,
  matomoColumns: string[] | null,
  matomoDeviceTypes: Map<
    string,
    { deviceTypes: Set<string>; locationTypes: Set<string> }
  > | null,
): string {
  // Create a map of pseudonym -> Matomo metrics for quick lookup
  const matomoMap = new Map<string, MatomoUserData>();
  if (matomoData) {
    for (const row of matomoData) {
      matomoMap.set(row.label, row);
    }
  }

  // Get all unique pseudonyms from both sources
  const allPseudonyms = new Set<string>();
  serverData.forEach((row) => allPseudonyms.add(row.pseudonym));
  if (matomoData) {
    matomoData.forEach((row) => allPseudonyms.add(row.label));
  }
  if (matomoDeviceTypes) {
    Array.from(matomoDeviceTypes.keys()).forEach((pseudonym) =>
      allPseudonyms.add(pseudonym),
    );
  }

  const pseudonyms = Array.from(allPseudonyms).sort();

  // Get additional channel names from server data (all columns except Pseudonym and Direct Messages)
  const additionalChannels: string[] = [];
  if (serverData.length > 0) {
    const firstRow = serverData[0];
    Object.keys(firstRow).forEach((key) => {
      if (key !== "pseudonym" && key !== "directMessages") {
        additionalChannels.push(key);
      }
    });
  }

  // Build headers: Pseudonym, [Matomo columns], Device Types, Location Types, Direct Messages, [Additional channels]
  const headers = [
    "Pseudonym",
    ...(matomoColumns || []),
    ...(matomoDeviceTypes ? ["Device Types", "Location Types"] : []),
    "Direct Messages",
    ...additionalChannels,
  ];

  const rows = [headers.join(",")];

  // Create lookup map for server data
  const serverDataMap = new Map<string, ServerReportData>();
  serverData.forEach((row) => serverDataMap.set(row.pseudonym, row));

  // Build data rows
  for (const pseudonym of pseudonyms) {
    const rowValues: (string | number)[] = [pseudonym];

    // Add Matomo metrics
    if (matomoColumns) {
      const matomoRow = matomoMap.get(pseudonym);
      for (const column of matomoColumns) {
        rowValues.push(matomoRow?.[column] ?? "");
      }
    }

    // Add device types and location types
    if (matomoDeviceTypes) {
      const details = matomoDeviceTypes.get(pseudonym);
      rowValues.push(
        details?.deviceTypes ? Array.from(details.deviceTypes).join("; ") : "",
      );
      rowValues.push(
        details?.locationTypes
          ? Array.from(details.locationTypes).join("; ")
          : "",
      );
    }

    // Add direct message count from server data
    const serverRow = serverDataMap.get(pseudonym);
    rowValues.push(serverRow?.directMessages ?? "");

    // Add additional channel counts
    for (const channel of additionalChannels) {
      rowValues.push(serverRow?.[channel] ?? "");
    }

    rows.push(rowValues.join(","));
  }

  return rows.join("\n");
}

/**
 * Download a CSV file in the browser
 */
function downloadCSV(csvContent: string, fileName: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Main function to generate and download user metrics report
 */
export async function generateAndDownloadUserMetricsReport(
  conversationId: string,
  conversationDate?: Date,
): Promise<void> {
  try {
    // Parse report date or use today
    const reportDate = conversationDate || new Date();

    // Get Matomo Site ID from environment variables
    const matomoSiteId = process.env.NEXT_PUBLIC_MATOMO_SITE_ID;

    console.log(
      `Generating user metrics report for conversation ${conversationId}`,
    );
    console.log(`Using report date: ${reportDate.toISOString().split("T")[0]}`);

    // Fetch server report
    const serverReportCSV = await fetchUserMetricsReport(conversationId);
    if (!serverReportCSV) {
      throw new Error("Failed to fetch server report");
    }

    // Parse server report
    const serverData = parseCSV(serverReportCSV);
    console.log(`Parsed ${serverData.length} rows from server report`);

    // Fetch Matomo data if configured
    let matomoResult: { data: MatomoUserData[]; columns: string[] } | null =
      null;
    let matomoVisitDetails: Map<
      string,
      { deviceTypes: Set<string>; locationTypes: Set<string> }
    > | null = null;

    if (matomoSiteId) {
      matomoResult = await fetchMatomoUserIdReport(
        matomoSiteId,
        reportDate,
        conversationId,
      );

      matomoVisitDetails = await fetchMatomoVisitDetails(
        matomoSiteId,
        reportDate,
        conversationId,
      );
    } else {
      console.log(
        "Matomo configuration not found, generating report without Matomo data",
      );
    }

    // Generate combined CSV
    const combinedCSV = generateCombinedCSV(
      serverData,
      matomoResult?.data || null,
      matomoResult?.columns || null,
      matomoVisitDetails,
    );

    // Download the file
    const outputFileName = `userMetrics_${conversationId}.csv`;
    downloadCSV(combinedCSV, outputFileName);

    console.log(`\nReport generated successfully: ${outputFileName}`);
    console.log(`Total users: ${serverData.length}`);
    if (matomoResult) {
      console.log(`Matomo data included for ${matomoResult.data.length} users`);
    }
  } catch (error: any) {
    console.error("Error generating report:", error);
    throw error;
  }
}

/**
 * Download a text file in the browser
 */
function downloadText(textContent: string, fileName: string) {
  const blob = new Blob([textContent], { type: "text/plain;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Generate and download direct message responses report
 */
export async function generateAndDownloadDirectMessageResponsesReport(
  conversationId: string,
): Promise<void> {
  try {
    const params = new URLSearchParams({
      reportName: "directMessageResponses",
      format: "text",
      additionalChannels: "chat",
    });

    const urlSuffix = `conversations/${conversationId}/report?${params.toString()}`;
    console.log(
      `Fetching direct message responses report for conversation: ${conversationId}`,
    );

    const response = await RetrieveData(urlSuffix, undefined, "text");

    if (response && typeof response === "object" && "error" in response) {
      console.error(
        `Failed to fetch direct message responses report:`,
        response.message,
      );
      throw new Error("Failed to fetch direct message responses report");
    }

    if (typeof response === "string") {
      const outputFileName = `directMessageResponses_${conversationId}.txt`;
      downloadText(response, outputFileName);
      console.log(
        `Direct message responses report generated successfully: ${outputFileName}`,
      );
    } else {
      throw new Error("Unexpected response format");
    }
  } catch (error: any) {
    console.error("Error generating direct message responses report:", error);
    throw error;
  }
}
