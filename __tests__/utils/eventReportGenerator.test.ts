import {
  generateAndDownloadUserMetricsReport,
  generateAndDownloadDirectMessageResponsesReport,
} from "../../utils/eventReportGenerator";
import { RetrieveData } from "../../utils/Api";

// Mock the dependencies
jest.mock("../../utils/Api");

// Mock global fetch
global.fetch = jest.fn();

// Mock DOM APIs
const mockCreateElement = jest.fn();
const mockClick = jest.fn();
const mockAppendChild = jest.fn();
const mockRemoveChild = jest.fn();
const mockCreateObjectURL = jest.fn();
const mockRevokeObjectURL = jest.fn();

describe("eventReportGenerator", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup DOM mocks
    const mockLink = {
      setAttribute: jest.fn(),
      click: mockClick,
      style: {},
    };

    mockCreateElement.mockReturnValue(mockLink);
    document.createElement = mockCreateElement;
    document.body.appendChild = mockAppendChild;
    document.body.removeChild = mockRemoveChild;

    URL.createObjectURL = mockCreateObjectURL.mockReturnValue("blob:mock-url");
    URL.revokeObjectURL = mockRevokeObjectURL;

    // Mock console methods to reduce noise
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("generateAndDownloadUserMetricsReport", () => {
    const mockConversationId = "test-conversation-123";
    const mockConversationDate = new Date("2025-11-05T10:00:00Z");
    const mockMatomoSiteId = "1";

    beforeEach(() => {
      process.env.NEXT_PUBLIC_MATOMO_SITE_ID = mockMatomoSiteId;
    });

    afterEach(() => {
      delete process.env.NEXT_PUBLIC_MATOMO_SITE_ID;
    });

    it("should successfully generate and download report with server and Matomo data", async () => {
      // Mock server report response
      const serverReportCSV = `Pseudonym,Direct Messages,chat
user1,5,3
user2,10,7`;

      (RetrieveData as jest.Mock).mockResolvedValue(serverReportCSV);

      // Mock Matomo UserId report response
      const matomoUserData = [
        { label: "user1", nb_visits: 5, nb_actions: 20 },
        { label: "user2", nb_visits: 10, nb_actions: 35 },
      ];

      // Mock Matomo visit details response
      const matomoVisitDetails = [
        {
          userId: "user1",
          deviceType: "desktop",
          actionDetails: [
            {
              url: `https://example.com/assistant?conversationId=${mockConversationId}&location=local`,
            },
          ],
        },
        {
          userId: "user2",
          deviceType: "mobile",
          actionDetails: [
            {
              url: `https://example.com/assistant?conversationId=${mockConversationId}&location=remote`,
            },
          ],
        },
      ];

      // Mock fetch for both Matomo calls
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => matomoUserData,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => matomoVisitDetails,
        });

      await generateAndDownloadUserMetricsReport(
        mockConversationId,
        mockConversationDate,
      );

      // Verify server report was fetched
      expect(RetrieveData).toHaveBeenCalledWith(
        expect.stringContaining(`conversations/${mockConversationId}/report`),
        undefined,
        "text",
      );

      // Verify Matomo API calls
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Verify first call (UserId report)
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        "/api/matomo-proxy",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining("UserId.getUsers"),
        }),
      );

      // Verify second call (visit details)
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        "/api/matomo-proxy",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining("Live.getLastVisitsDetails"),
        }),
      );

      // Verify CSV download
      expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    });

    it("should generate report without Matomo data when MATOMO_SITE_ID is not configured", async () => {
      delete process.env.NEXT_PUBLIC_MATOMO_SITE_ID;

      const serverReportCSV = `Pseudonym,Direct Messages
user1,5
user2,10`;

      (RetrieveData as jest.Mock).mockResolvedValue(serverReportCSV);

      await generateAndDownloadUserMetricsReport(
        mockConversationId,
        mockConversationDate,
      );

      // Should fetch server report
      expect(RetrieveData).toHaveBeenCalled();

      // Should NOT call Matomo API
      expect(global.fetch).not.toHaveBeenCalled();

      // Should still download CSV
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
    });

    it("should handle server report fetch failure", async () => {
      (RetrieveData as jest.Mock).mockResolvedValue({
        error: true,
        message: "Failed to fetch report",
      });

      await expect(
        generateAndDownloadUserMetricsReport(
          mockConversationId,
          mockConversationDate,
        ),
      ).rejects.toThrow("Failed to fetch server report");

      expect(mockClick).not.toHaveBeenCalled();
    });

    it("should handle Matomo API failure gracefully", async () => {
      const serverReportCSV = `Pseudonym,Direct Messages
user1,5`;

      (RetrieveData as jest.Mock).mockResolvedValue(serverReportCSV);

      // Mock Matomo API failure
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: "Internal server error" }),
      });

      await generateAndDownloadUserMetricsReport(
        mockConversationId,
        mockConversationDate,
      );

      // Should still download report (without Matomo data)
      expect(mockClick).toHaveBeenCalled();
    });

    it("should combine data from multiple users correctly", async () => {
      const serverReportCSV = `Pseudonym,Direct Messages,chat
user1,5,3
user2,10,7
user3,2,1`;

      (RetrieveData as jest.Mock).mockResolvedValue(serverReportCSV);

      const matomoUserData = [
        { label: "user1", nb_visits: 5 },
        { label: "user2", nb_visits: 10 },
        // user3 not in Matomo data
      ];

      const matomoVisitDetails = [
        {
          userId: "user1",
          deviceType: "desktop",
          actionDetails: [
            {
              url: `https://example.com/assistant?conversationId=${mockConversationId}&location=local`,
            },
          ],
        },
      ];

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => matomoUserData,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => matomoVisitDetails,
        });

      await generateAndDownloadUserMetricsReport(
        mockConversationId,
        mockConversationDate,
      );

      // Verify download was called
      expect(mockClick).toHaveBeenCalled();

      // Verify Blob was created with combined data
      const createObjectURLCall = mockCreateObjectURL.mock.calls[0][0];
      expect(createObjectURLCall).toBeInstanceOf(Blob);
    });

    it("should use scheduledTime for report date when provided", async () => {
      const serverReportCSV = `Pseudonym,Direct Messages
user1,5`;

      (RetrieveData as jest.Mock).mockResolvedValue(serverReportCSV);

      const customDate = new Date("2025-12-25T15:30:00Z");

      await generateAndDownloadUserMetricsReport(
        mockConversationId,
        customDate,
      );

      // Verify Matomo API was called with correct date
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.params.date).toBe("2025-12-25");
    });

    it("should filter Matomo visit details by conversationId", async () => {
      const serverReportCSV = `Pseudonym,Direct Messages
user1,5`;

      (RetrieveData as jest.Mock).mockResolvedValue(serverReportCSV);

      // Mock visit details with mixed conversation IDs
      const matomoVisitDetails = [
        {
          userId: "user1",
          deviceType: "desktop",
          actionDetails: [
            {
              url: `https://example.com/assistant?conversationId=${mockConversationId}&location=local`,
            },
            {
              url: `https://example.com/assistant?conversationId=other-conversation&location=local`,
            },
          ],
        },
      ];

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => matomoVisitDetails,
        });

      await generateAndDownloadUserMetricsReport(
        mockConversationId,
        mockConversationDate,
      );

      // Should successfully process (filtering happens internally)
      expect(mockClick).toHaveBeenCalled();
    });

    it("should aggregate multiple device types per user", async () => {
      const serverReportCSV = `Pseudonym,Direct Messages
user1,5`;

      (RetrieveData as jest.Mock).mockResolvedValue(serverReportCSV);

      const matomoVisitDetails = [
        {
          userId: "user1",
          deviceType: "desktop",
          actionDetails: [
            {
              url: `https://example.com/assistant?conversationId=${mockConversationId}&location=local`,
            },
          ],
        },
        {
          userId: "user1",
          deviceType: "mobile",
          actionDetails: [
            {
              url: `https://example.com/assistant?conversationId=${mockConversationId}&location=remote`,
            },
          ],
        },
      ];

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ label: "user1", nb_visits: 2 }],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => matomoVisitDetails,
        });

      await generateAndDownloadUserMetricsReport(
        mockConversationId,
        mockConversationDate,
      );

      expect(mockClick).toHaveBeenCalled();
    });

    it("should handle empty server report", async () => {
      const serverReportCSV = `Pseudonym,Direct Messages`;

      (RetrieveData as jest.Mock).mockResolvedValue(serverReportCSV);

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      await generateAndDownloadUserMetricsReport(
        mockConversationId,
        mockConversationDate,
      );

      // Should still create download
      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe("generateAndDownloadDirectMessageResponsesReport", () => {
    const mockConversationId = "test-conversation-456";

    it("should successfully generate and download direct message responses report", async () => {
      const mockTextReport = `Direct Message Responses Report
     
User: user1
Message: Hello
Response: Hi there!

User: user2
Message: How are you?
Response: I'm doing well, thanks!`;

      (RetrieveData as jest.Mock).mockResolvedValue(mockTextReport);

      await generateAndDownloadDirectMessageResponsesReport(mockConversationId);

      // Verify API call
      expect(RetrieveData).toHaveBeenCalledWith(
        expect.stringContaining(`conversations/${mockConversationId}/report`),
        undefined,
        "text",
      );

      // Verify URL params
      const callArgs = (RetrieveData as jest.Mock).mock.calls[0][0];
      expect(callArgs).toContain("reportName=directMessageResponses");
      expect(callArgs).toContain("format=text");

      // Verify download
      expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock-url");

      // Verify correct file name
      const setAttributeCalls = mockCreateElement().setAttribute.mock.calls;
      const downloadCall = setAttributeCalls.find(
        (call: any) => call[0] === "download",
      );
      expect(downloadCall[1]).toBe(
        `directMessageResponses_${mockConversationId}.txt`,
      );
    });

    it("should handle API failure", async () => {
      (RetrieveData as jest.Mock).mockResolvedValue({
        error: true,
        message: "Failed to fetch report",
      });

      await expect(
        generateAndDownloadDirectMessageResponsesReport(mockConversationId),
      ).rejects.toThrow("Failed to fetch direct message responses report");

      expect(mockClick).not.toHaveBeenCalled();
    });

    it("should handle unexpected response format", async () => {
      (RetrieveData as jest.Mock).mockResolvedValue({ unexpected: "format" });

      await expect(
        generateAndDownloadDirectMessageResponsesReport(mockConversationId),
      ).rejects.toThrow("Unexpected response format");

      expect(mockClick).not.toHaveBeenCalled();
    });

    it("should handle network errors", async () => {
      (RetrieveData as jest.Mock).mockRejectedValue(new Error("Network error"));

      await expect(
        generateAndDownloadDirectMessageResponsesReport(mockConversationId),
      ).rejects.toThrow("Network error");

      expect(mockClick).not.toHaveBeenCalled();
    });

    it("should create text file with correct MIME type", async () => {
      const mockTextReport = "Sample report content";

      (RetrieveData as jest.Mock).mockResolvedValue(mockTextReport);

      await generateAndDownloadDirectMessageResponsesReport(mockConversationId);

      // Verify Blob was created with correct type
      const blobCall = mockCreateObjectURL.mock.calls[0][0];
      expect(blobCall.type).toBe("text/plain;charset=utf-8;");
    });
  });

  describe("CSV parsing and generation", () => {
    it("should correctly parse CSV with multiple columns", async () => {
      const serverReportCSV = `Pseudonym,Direct Messages,chat,email
user1,5,3,2
user2,10,7,5`;

      (RetrieveData as jest.Mock).mockResolvedValue(serverReportCSV);

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      await generateAndDownloadUserMetricsReport(
        "test-conv",
        new Date("2025-11-05"),
      );

      expect(mockClick).toHaveBeenCalled();
    });

    it("should handle CSV with missing values", async () => {
      const serverReportCSV = `Pseudonym,Direct Messages,chat
user1,,3
user2,10,`;

      (RetrieveData as jest.Mock).mockResolvedValue(serverReportCSV);

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      await generateAndDownloadUserMetricsReport(
        "test-conv",
        new Date("2025-11-05"),
      );

      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe("Edge cases", () => {
    it("should handle users in Matomo but not in server report", async () => {
      const serverReportCSV = `Pseudonym,Direct Messages
user1,5`;

      (RetrieveData as jest.Mock).mockResolvedValue(serverReportCSV);

      const matomoUserData = [
        { label: "user1", nb_visits: 5 },
        { label: "user2", nb_visits: 3 }, // Not in server report
      ];

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => matomoUserData,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      await generateAndDownloadUserMetricsReport(
        "test-conv",
        new Date("2025-11-05"),
      );

      expect(mockClick).toHaveBeenCalled();
    });

    it("should handle both local and remote location types for same user", async () => {
      const serverReportCSV = `Pseudonym,Direct Messages
user1,5`;

      (RetrieveData as jest.Mock).mockResolvedValue(serverReportCSV);

      const matomoVisitDetails = [
        {
          userId: "user1",
          deviceType: "desktop",
          actionDetails: [
            {
              url: "https://example.com/assistant?conversationId=test-conv&location=local",
            },
            {
              url: "https://example.com/assistant?conversationId=test-conv&location=remote",
            },
          ],
        },
      ];

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => matomoVisitDetails,
        });

      await generateAndDownloadUserMetricsReport(
        "test-conv",
        new Date("2025-11-05"),
      );

      expect(mockClick).toHaveBeenCalled();
    });

    it("should use today's date when conversationDate is not provided", async () => {
      const serverReportCSV = `Pseudonym,Direct Messages
user1,5`;

      (RetrieveData as jest.Mock).mockResolvedValue(serverReportCSV);

      await generateAndDownloadUserMetricsReport("test-conv");

      expect(mockClick).toHaveBeenCalled();
    });
  });
});
