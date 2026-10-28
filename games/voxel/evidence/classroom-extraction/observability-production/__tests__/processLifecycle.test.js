"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const processLifecycle_1 = require("../processLifecycle");
describe("process drain status", () => {
    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });
    it("exits unsuccessfully when a normal termination cannot finish its drain", () => {
        jest.useFakeTimers();
        const exit = jest
            .spyOn(process, "exit")
            .mockImplementation((() => undefined));
        const logger = { info: jest.fn(), fatal: jest.fn() };
        const dispose = (0, processLifecycle_1.installProcessLifecycle)({
            logger,
            timeoutMs: 100,
            shutdown: () => new Promise(() => { }),
        });
        try {
            process.emit("SIGTERM");
            jest.advanceTimersByTime(100);
            expect(exit).toHaveBeenCalledWith(1);
            expect(logger.fatal).toHaveBeenCalledWith(expect.objectContaining({
                context: expect.objectContaining({
                    event: "SERVICE_SHUTDOWN_TIMEOUT",
                }),
            }));
        }
        finally {
            dispose();
        }
    });
    it("a successful termination exits normally after its drain resolves", async () => {
        jest.useFakeTimers();
        const exit = jest
            .spyOn(process, "exit")
            .mockImplementation((() => undefined));
        const logger = { info: jest.fn(), fatal: jest.fn() };
        let release;
        const held = new Promise((r) => (release = r));
        const dispose = (0, processLifecycle_1.installProcessLifecycle)({
            logger,
            timeoutMs: 100,
            shutdown: () => held,
        });
        try {
            process.emit("SIGTERM");
            expect(exit).not.toHaveBeenCalled();
            release();
            await held;
            await Promise.resolve();
            expect(exit).toHaveBeenCalledWith(0);
            jest.advanceTimersByTime(100);
            expect(logger.fatal).not.toHaveBeenCalled();
        }
        finally {
            dispose();
        }
    });
});
//# sourceMappingURL=processLifecycle.test.js.map