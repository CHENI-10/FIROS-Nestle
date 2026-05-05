/**
 * scoreCalculator.js
 * 
 * Shared logic for calculating distributor performance scores.
 * Ensures 100% consistency between Dashboard and Scorecard detail pages.
 */

const calculateLiveMetrics = ({
    totalDispatches,
    avgFrsAtDispatch,
    avgCollectionDelayDays,
    totalReturns,
    rejectedReturns,
    missCount
}) => {
    const returnRate = totalDispatches > 0 ? (totalReturns / totalDispatches) * 100 : 0;
    const returnRejectionRate = totalReturns > 0 ? (rejectedReturns / totalReturns) * 100 : 0;
    const avgDelay = parseFloat(avgCollectionDelayDays) || 0;
    const avgFrs = parseFloat(avgFrsAtDispatch) || 0;

    // NEW FAIR SCORING LOGIC (100% Distributor Responsibility)
    // 1. Return Rate Component (40 pts) - Linear penalty up to 50% return rate
    const returnScore = 40 * (1 - Math.min(returnRate / 50, 1));
    
    // 2. Collection Delay Component (40 pts) - Linear penalty up to 7 days delay
    const delayScore = 40 * (1 - Math.min(avgDelay / 7, 1));
    
    // 3. Return Rejection Component (20 pts) - Linear penalty up to 100% rejection
    const rejectionScore = 20 * (1 - Math.min(returnRejectionRate / 100, 1));
    
    // 4. Missed Delivery Penalty (-5 per miss)
    const missPenalty = missCount * 5;

    const overallScoreRaw = returnScore + delayScore + rejectionScore - missPenalty;
    const finalScore = Math.max(0, Math.min(100, overallScoreRaw)).toFixed(1);

    
    return {
        totalDispatches,
        totalReturns,
        avgFrsAtDispatch: avgFrs.toFixed(1),
        returnRate: returnRate.toFixed(1),
        returnRejectionRate: returnRejectionRate.toFixed(1),
        avgCollectionDelayDays: avgDelay.toFixed(1),
        missCount: missCount,
        overallScore: finalScore
    };
};

module.exports = { calculateLiveMetrics };
