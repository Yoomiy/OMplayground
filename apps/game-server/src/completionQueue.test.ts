import { CompletionQueue } from "./completionQueue";
test("a failed terminal write remains queued and retries after its room has gone", async () => {
  const queue = new CompletionQueue();
  const write = jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
  queue.stage("game", write);
  await expect(queue.flush("game")).rejects.toThrow("offline");
  expect(queue.has("game")).toBe(true);
  await queue.flush("game");
  expect(queue.has("game")).toBe(false);
  expect(write).toHaveBeenCalledTimes(2);
});
test("concurrent retries share one write and cannot overwrite an original outcome", async () => {
  const queue = new CompletionQueue();
  let done!: () => void;
  const write = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        done = resolve;
      }),
  );
  const replacement = jest.fn();
  queue.stage("game", write);
  queue.stage("game", replacement);
  const first = queue.flush("game");
  const second = queue.flush("game");
  await Promise.resolve();
  done();
  await Promise.all([first, second]);
  expect(write).toHaveBeenCalledTimes(1);
  expect(replacement).not.toHaveBeenCalled();
});
