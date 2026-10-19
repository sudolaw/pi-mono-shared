// Runs async jobs one at a time, in arrival order (spec §6, §12). Every change to a match
// or a series goes through its queue, so two calls never interleave.

export function createQueue() {
  let tail = Promise.resolve();
  return {
    run(job) {
      const result = tail.then(job);
      tail = result.catch(() => {});
      return result;
    },
  };
}
