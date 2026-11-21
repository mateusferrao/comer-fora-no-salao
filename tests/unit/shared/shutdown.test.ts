import { describe, expect, it, vi } from "vitest";
import { runShutdown } from "@/src/shared/shutdown";

describe("runShutdown", () => {
  it("roda as tarefas em ordem e sai com 143 no SIGTERM", async () => {
    const order: string[] = [];
    const exit = vi.fn();
    await runShutdown("SIGTERM", [{ name: "a", run: async () => void order.push("a") }, { name: "b", run: async () => void order.push("b") }], { exit });
    expect(order).toEqual(["a", "b"]);
    expect(exit).toHaveBeenCalledWith(143);
  });
  it("tarefa que falha não impede as seguintes; SIGINT → 130", async () => {
    const exit = vi.fn();
    const b = vi.fn(async () => {});
    await runShutdown("SIGINT", [{ name: "a", run: async () => { throw new Error("x"); } }, { name: "b", run: b }], { exit });
    expect(b).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(130);
  });
  it("tarefa que trava: sai no limite de tempo", async () => {
    const exit = vi.fn();
    const t0 = Date.now();
    await runShutdown("SIGTERM", [{ name: "trava", run: () => new Promise(() => {}) }], { exit, timeoutMs: 50 });
    expect(Date.now() - t0).toBeLessThan(1_000);
    expect(exit).toHaveBeenCalledWith(143);
  });
});
