export function makePerfCounter(windowCalls = 600) {
    const window = new Array(windowCalls);
    let wIndex = 0;
    let wCount = 0;
    let wSum = 0;

    let count = 0;
    let total = 0;
    let min = Infinity;
    let max = -Infinity;
    let sumSq = 0;

    function record(dt) {
        // global stats
        count++;
        total += dt;
        min = dt < min ? dt : min;
        max = dt > max ? dt : max;
        sumSq += dt * dt;

        // moving window (fixed-size ring buffer)
        if (wCount < windowCalls) {
            window[wCount++] = dt;
            wSum += dt;
        } else {
            const old = window[wIndex];
            wSum -= old;
            window[wIndex] = dt;
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

        // moving window stats (last N calls)
        get windowCount() { return wCount },
        get windowTotal() { return wSum },
        get windowAvg() { return wCount ? wSum / wCount : 0 }
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

