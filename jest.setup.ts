import "@testing-library/jest-dom";

// Mock react-markdown and remark-gfm since they're ESM-only
jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => children,
}));

jest.mock("remark-gfm", () => ({
  __esModule: true,
  default: () => {},
}));
