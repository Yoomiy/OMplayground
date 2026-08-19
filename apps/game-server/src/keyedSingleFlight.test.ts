import { KeyedSingleFlight } from "./keyedSingleFlight";

describe("KeyedSingleFlight", () => {
  it("shares one in-flight operation per drawing session", async () => {
    const flights = new KeyedSingleFlight();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const work = jest.fn(() => pending);

    const first = flights.run("session", work);
    const second = flights.run("session", work);

    expect(first.started).toBe(true);
    expect(second.started).toBe(false);
    expect(second.promise).toBe(first.promise);
    expect(work).toHaveBeenCalledTimes(1);
    release();
    await first.promise;

    const third = flights.run("session", work);
    expect(third.started).toBe(true);
    expect(work).toHaveBeenCalledTimes(2);
  });
});
