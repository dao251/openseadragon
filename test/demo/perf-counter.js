export function makePerfCounter(windowCalls = 600) {
    // ring buffers
    const dtWindow = new Array(windowCalls);     // durations
    const timeWindow = new Array(windowCalls);   // timestamps

    let wIndex = 0;      // ring buffer index
    let wCount = 0;      // number of samples currently in window
    let wSum = 0;        // sum of dt values (ms)

    // global stats
    let count = 0;
    let total = 0;
    let min = Infinity;
    let max = -Infinity;
    let sumSq = 0;

    const startTime = performance.now();

    function record(dt) {
        const now = performance.now();

        // global stats
        count++;
        total += dt;
        min = dt < min ? dt : min;
        max = dt > max ? dt : max;
        sumSq += dt * dt;

        // moving window
        if (wCount < windowCalls) {
            dtWindow[wCount] = dt;
            timeWindow[wCount] = now;
            wSum += dt;
            wCount++;
        } else {
            // overwrite oldest
            const oldDt = dtWindow[wIndex];

            wSum -= oldDt;
            dtWindow[wIndex] = dt;
            timeWindow[wIndex] = now;
            wSum += dt;

            wIndex = (wIndex + 1) % windowCalls;
        }
    }

    return {
        _record: record,

        // global stats
        get count() { return count },
        get total() { return total },
        get avg() { return count ? total / count : 0 },
        get min() { return count ? min : 0 },
        get max() { return count ? max : 0 },
        get variance() {
            if (!count) return 0;
            const mean = total / count;
            return sumSq / count - mean * mean;
        },
        get stddev() { return Math.sqrt(this.variance) },

        // moving window stats
        get windowCount() { return wCount },
        get windowTotal() { return wSum },
        get windowAvg() { return wCount ? wSum / wCount : 0 },

        // global calls per second
        get cps() {
            const elapsedMs = performance.now() - startTime;
            return elapsedMs > 0 ? count / (elapsedMs / 1000) : 0;
        },

        // moving calls per second (correct)
        get windowCps() {
            if (wCount < 2) return 0;

            // oldest sample index
            const firstIndex = wIndex;
            // newest sample index
            const lastIndex = (wIndex + wCount - 1) % windowCalls;

            const firstTime = timeWindow[firstIndex];
            const lastTime = timeWindow[lastIndex];

            const elapsedMs = lastTime - firstTime;
            return elapsedMs > 0 ? wCount / (elapsedMs / 1000) : 0;
        }
    };
}


export function wrapMethodWithPerf(obj, methodName, windowCalls = 600) {
    const original = obj[methodName];
    if (typeof original !== "function")
        throw new Error(`Property ${methodName} is not a function`);

    const perf = makePerfCounter(windowCalls);

    const wrapped = function (...args) {
        const t0 = performance.now();
        const out = original.apply(this, args);
        const dt = performance.now() - t0;
        perf._record(dt);
        return out;
    };

    wrapped.perf = perf;
    obj[methodName] = wrapped;

    return function unwrap() {
        obj[methodName] = original;
    };
}

