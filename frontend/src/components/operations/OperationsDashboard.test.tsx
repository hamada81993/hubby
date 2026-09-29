import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OperationsDashboard from "./OperationsDashboard";
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), org: 1 }));
vi.mock("@/lib/api", () => ({ default: { get: mocks.get, post: mocks.post } }));
vi.mock("@/i18n", () => ({ useI18n: () => ({ locale: "en" }) }));
vi.mock("@/store/auth", () => ({
  useAuthStore: (select: (s: { activeOrgId: number }) => unknown) =>
    select({ activeOrgId: mocks.org }),
}));
const summary = {
  base_currency: "SAR",
  stores: [{ id: 1, name: "Test shop" }],
  queues: [{ key: "fulfillment", count: 3 }],
  generated_at: "2026-09-29",
};
describe("Operations dashboard", () => {
  beforeEach(() => {
    mocks.org = 1;
    mocks.get.mockReset();
    mocks.post.mockReset();
  });
  afterEach(cleanup);
  it("shows restricted financial data as unavailable rather than a zero profit", async () => {
    mocks.get.mockImplementation((url: string) => {
      if (url === "/operations") return Promise.resolve({ data: summary });
      if (url === "/operations/health") return Promise.resolve({ data: [] });
      if (url === "/analytics/profit")
        return Promise.reject({ response: { status: 403 } });
      return Promise.resolve({
        data: {
          data: [
            { id: 5, label: "ORDER-5", status: "pending", href: "/orders/5" },
          ],
          last_page: 1,
        },
      });
    });
    render(<OperationsDashboard />);
    expect(
      await screen.findByText(
        "Your role does not allow access to financial reports.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Estimated net profit")).not.toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: /ORDER-5/ }),
    ).toHaveAttribute("href", "/orders/5");
  });
  it("loads the selected exception queue and reports request failure", async () => {
    mocks.get.mockImplementation((url: string) => {
      if (url === "/operations") return Promise.resolve({ data: summary });
      if (url === "/operations/health") return Promise.resolve({ data: [] });
      if (url === "/operations/queues/cod" || url === "/analytics/profit")
        return Promise.reject(new Error("Offline"));
      return Promise.resolve({ data: { data: [], last_page: 1 } });
    });
    render(<OperationsDashboard />);
    fireEvent.click(screen.getByRole("button", { name: /Overdue COD/ }));
    expect(
      await screen.findByText("Could not load this queue."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.get).toHaveBeenCalledWith(
        "/operations/queues/cod",
        expect.anything(),
      ),
    );
  });
});
