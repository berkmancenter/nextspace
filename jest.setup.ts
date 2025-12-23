import "@testing-library/jest-dom";

// Polyfill fetch for Node.js test environment
global.fetch = jest.fn();
