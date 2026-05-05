/**
 * relationshipEngine.js
 * 
 * Refined logic to calculate distributor relationship metrics based on 
 * Return Rate, Collection Delay, and FRS at Dispatch.
 */

const { calculateLiveMetrics } = require('./scoreCalculator');

const buildRelationshipProfile = ({
    distributorId,
    distributorName,
    distributorRegion,
    managerDispatches,   // array of dispatch records
    managerReturns,      // array of return records
    managerClearances,   // array of clearance records
    systemAvgReturnRate, // for comparison
    systemAvgCollectionDelay,
    systemAvgFrsAtDispatch,
    overallScore: storedScore,         // from distributor_scorecards
    missCount             // from sales rep audits
}) => {
    // 1. BASIC METRICS
    const totalDispatches = managerDispatches.length;
    if (totalDispatches === 0) return null;

    const totalReturns = managerReturns.length;
    const totalClearances = managerClearances.length;
    const managerReturnRate = (totalReturns / totalDispatches) * 100;

    // Loss Summary
    const totalReturnsCount = managerReturns.length;
    const totalClearancesCount = managerClearances.length;
    const totalReturnsUnits = managerReturns.reduce((sum, r) => sum + parseInt(r.quantity || 0), 0);
    const totalClearancesUnits = managerClearances.reduce((sum, c) => sum + parseInt(c.quantity || 0), 0);
    const totalUnitsLost = totalReturnsUnits + totalClearancesUnits;

    // Collection Delay
    const collectedRecords = managerDispatches.filter(d => d.collected_at !== null);
    const avgCollectionDelay = collectedRecords.length > 0
        ? parseFloat((collectedRecords.reduce((sum, d) => sum + parseFloat(d.collection_delay_days || 0), 0) / collectedRecords.length).toFixed(1))
        : 0;

    // FRS at Dispatch
    const avgFrsAtDispatch = parseFloat((managerDispatches.reduce((sum, d) => sum + parseInt(d.frs_at_dispatch || 0), 0) / totalDispatches).toFixed(1));

    // 1.1 LIVE SCORE CALCULATION (Unified Sync)
    const rejectedReturnsCount = managerReturns.filter(r => r.decision === 'rejected').length;
    const liveMetrics = calculateLiveMetrics({
        totalDispatches,
        avgFrsAtDispatch,
        avgCollectionDelayDays: avgCollectionDelay,
        totalReturns,
        rejectedReturns: rejectedReturnsCount,
        missCount
    });

    const liveScore = parseFloat(liveMetrics.overallScore);

    // 2. HEALTH SIGNALS
    
    // Return Signal
    let returnSignal = { signal: 'good', label: 'No returns', color: '#22c55e', value: '0%' };
    if (managerReturnRate === 0) {
        returnSignal = { signal: 'good', label: 'No returns', color: '#22c55e', value: '0%' };
    } else if (managerReturnRate <= 15) {
        returnSignal = { signal: 'fair', label: 'Low returns', color: '#22c55e', value: `${managerReturnRate.toFixed(1)}%` };
    } else if (managerReturnRate <= 30) {
        returnSignal = { signal: 'warning', label: 'High returns', color: '#f59e0b', value: `${managerReturnRate.toFixed(1)}%` };
    } else {
        returnSignal = { signal: 'poor', label: 'Very high returns', color: '#ef4444', value: `${managerReturnRate.toFixed(1)}%` };
    }

    // Delay Signal
    let delaySignal = { signal: 'unknown', label: 'No data', color: '#94a3b8', value: 'N/A' };
    if (avgCollectionDelay === null) {
        delaySignal = { signal: 'unknown', label: 'No data', color: '#94a3b8', value: 'N/A' };
    } else if (avgCollectionDelay <= 2) {
        delaySignal = { signal: 'good', label: 'Collects quickly', color: '#22c55e', value: `${avgCollectionDelay}d` };
    } else if (avgCollectionDelay <= 7) {
        delaySignal = { signal: 'fair', label: 'Moderate delay', color: '#f59e0b', value: `${avgCollectionDelay}d` };
    } else if (avgCollectionDelay <= 14) {
        delaySignal = { signal: 'warning', label: 'Slow to collect', color: '#f59e0b', value: `${avgCollectionDelay}d` };
    } else {
        delaySignal = { signal: 'poor', label: 'Very slow collection', color: '#ef4444', value: `${avgCollectionDelay}d` };
    }

    // FRS Signal
    let frsSignal = { signal: 'good', label: 'Fresh stock sent', color: '#22c55e', value: avgFrsAtDispatch };
    if (avgFrsAtDispatch >= 75) {
        frsSignal = { signal: 'good', label: 'Fresh stock sent', color: '#22c55e', value: avgFrsAtDispatch };
    } else if (avgFrsAtDispatch >= 55) {
        frsSignal = { signal: 'fair', label: 'Moderate freshness', color: '#f59e0b', value: avgFrsAtDispatch };
    } else {
        frsSignal = { signal: 'poor', label: 'Low freshness sent', color: '#ef4444', value: avgFrsAtDispatch };
    }

    // Miss Signal
    let missSignal = { signal: 'good', label: 'Deliveries fulfilled', color: '#22c55e', value: '0' };
    if (missCount > 0) {
        missSignal = { signal: 'poor', label: 'Deliveries missed', color: '#ef4444', value: missCount };
    }

    // 3. OVERALL RELATIONSHIP HEALTH
    // 3. OVERALL RELATIONSHIP HEALTH (Traffic Light System based on Score)
    const overallScore = liveScore;
    let health = 'Excellent';
    let healthColor = '#22c55e'; // Green
    let badge = '⭐ Top Partner';

    if (overallScore >= 80) {
        health = 'Excellent';
        healthColor = '#22c55e';
        badge = '⭐ Top Partner';
    } else if (overallScore >= 60) {
        health = 'Fair';
        healthColor = '#f59e0b'; // Gold/Amber
        badge = '📊 Stable Partner';
    } else {
        health = 'Poor';
        healthColor = '#ef4444'; // Red
        badge = '🚨 Requires Review';
    }

    // Override badge if there are critical field misses
    if (missCount >= 3 && overallScore >= 60) {
        badge = '⚠️ Field Audit Alert';
    }

    // 4. PLAIN ENGLISH SUMMARY
    let summaryText = "";
    
    // Return & Miss Sentence
    if (totalReturns === 0 && missCount === 0) {
        summaryText = `${totalDispatches} batches were dispatched to ${distributorName} with zero returns or delivery failures recorded.`;
    } else if (missCount > 0) {
        summaryText = `${totalDispatches} batches were dispatched to ${distributorName}, but sales reps reported ${missCount} cases of items not being delivered.`;
        if (totalReturns > 0) summaryText += ` Additionally, ${totalReturns} batches resulted in returns.`;
    } else {
        summaryText = `${totalDispatches} batches were dispatched to ${distributorName} and ${totalReturns} resulted in returns — a ${managerReturnRate.toFixed(1)}% return rate.`;
    }

    // Delay Sentence
    if (avgCollectionDelay !== null) {
        if (delaySignal.signal === 'good') {
            summaryText += ` Collection was efficient with an average pickup time of ${avgCollectionDelay} days.`;
        } else if (delaySignal.signal === 'fair') {
            summaryText += ` Average collection time was ${avgCollectionDelay} days — within acceptable limits but requires monitoring.`;
        } else if (delaySignal.signal === 'warning') {
            summaryText += ` However, the average collection time was ${avgCollectionDelay} days after dispatch, which impacted freshness scores while stock waited in storage.`;
        } else {
            summaryText += ` A critical concern is the collection delay, which averaged ${avgCollectionDelay} days. Significant freshness loss occurred during the waiting period.`;
        }
    }

    // FRS Sentence
    if (frsSignal.signal === 'good') {
        summaryText += ` The stock dispatched to this partner was in high-quality condition (avg FRS ${avgFrsAtDispatch}).`;
    } else if (frsSignal.signal === 'fair') {
        summaryText += ` The stock dispatched had a moderate average freshness score of ${avgFrsAtDispatch}.`;
    } else if (frsSignal.signal === 'poor' && returnSignal.signal === 'poor') {
        summaryText += ` The dispatched stock also had a low average freshness score of ${avgFrsAtDispatch}, which likely contributed to the high return volume.`;
    } else if (frsSignal.signal === 'poor') {
        summaryText += ` The dispatched batches had a low average freshness score of ${avgFrsAtDispatch}. Prioritising higher-FRS stock may reduce future return risk.`;
    }

    // Comparison Sentence
    if (managerReturnRate < systemAvgReturnRate) {
        summaryText += ` The return rate for these dispatches is lower than the system average of ${systemAvgReturnRate.toFixed(1)}%.`;
    } else if (managerReturnRate > systemAvgReturnRate) {
        summaryText += ` The return rate for these dispatches is higher than the system average of ${systemAvgReturnRate.toFixed(1)}%.`;
    } else {
        summaryText += ` The return rate for these dispatches is consistent with the system average of ${systemAvgReturnRate.toFixed(1)}%.`;
    }

    // 5. SUGGESTED ACTION
    let suggestedAction = "No action needed — performance is within acceptable range.";
    let actionSeverity = 'neutral';

    if (health === 'Excellent') {
        suggestedAction = "Strong relationship — this distributor is recommended for high-priority dispatches.";
        actionSeverity = 'positive';
    } else if (delaySignal.signal === 'poor' && returnSignal.signal === 'good') {
        suggestedAction = "Returns are low but collection delay is impacting freshness metrics. Review collection efficiency with the distributor.";
        actionSeverity = 'warning';
    } else if (returnSignal.signal === 'poor' && frsSignal.signal === 'poor') {
        suggestedAction = "Both return rate and stock freshness are concerning. Recommend prioritizing high-FRS stock for these routes and monitoring results.";
        actionSeverity = 'critical';
    } else if (returnSignal.signal === 'poor' && frsSignal.signal === 'good') {
        suggestedAction = "High-quality stock was dispatched but returns remain high. The issue is likely external to product quality — distributor review recommended.";
        actionSeverity = 'critical';
    } else if (missCount > 0) {
        suggestedAction = "Field reps reported missed deliveries. Verify distributor logs and ensure scheduled batches were actually dropped off.";
        actionSeverity = 'critical';
    } else if (health === 'Fair') {
        suggestedAction = "Monitor relationship metrics closely over the next period. Observe for any worsening trends.";
        actionSeverity = 'warning';
    }

    // Performance Trend (Compare Last 30 days vs Previous 30 days)
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = prevDate.getMonth() + 1;
    const prevYear = prevDate.getFullYear();

    const currMonthReturns = managerReturns.filter(r => parseInt(r.month) === currentMonth && parseInt(r.year) === currentYear).length;
    const currMonthDispatches = managerDispatches.filter(d => parseInt(d.month) === currentMonth && parseInt(d.year) === currentYear).length;
    const prevMonthReturns = managerReturns.filter(r => parseInt(r.month) === prevMonth && parseInt(r.year) === prevYear).length;
    const prevMonthDispatches = managerDispatches.filter(d => parseInt(d.month) === prevMonth && parseInt(d.year) === prevYear).length;

    const currRate = currMonthDispatches > 0 ? (currMonthReturns / currMonthDispatches) * 100 : 0;
    const prevRate = prevMonthDispatches > 0 ? (prevMonthReturns / prevMonthDispatches) * 100 : 0;

    let performanceTrend = 'Stable';
    if (currMonthDispatches === 0 || prevMonthDispatches === 0) {
        performanceTrend = 'Stable'; // Not enough data for trend
    } else if (currRate < prevRate - 2) {
        performanceTrend = 'Improving';
    } else if (currRate > prevRate + 2) {
        performanceTrend = 'Declining';
    }

    // Monthly History
    const monthlyHistory = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const m = d.getMonth() + 1;
        const y = d.getFullYear();
        const monthLabel = d.toLocaleString('default', { month: 'short' });

        const dispatchesInMonth = managerDispatches.filter(disp => parseInt(disp.month) === m && parseInt(disp.year) === y);
        const returnsInMonth = managerReturns.filter(ret => parseInt(ret.month) === m && parseInt(ret.year) === y);
        const clearancesInMonth = managerClearances.filter(clr => parseInt(clr.month) === m && parseInt(clr.year) === y);
        
        const delayRecords = dispatchesInMonth.filter(d => d.collected_at !== null);
        const avgDelayInMonth = delayRecords.length > 0
            ? (delayRecords.reduce((sum, d) => sum + parseFloat(d.collection_delay_days || 0), 0) / delayRecords.length)
            : 0;
            
        const avgFrsInMonth = dispatchesInMonth.length > 0
            ? (dispatchesInMonth.reduce((sum, d) => sum + parseInt(d.frs_at_dispatch || 0), 0) / dispatchesInMonth.length)
            : 0;

        monthlyHistory.push({
            month: m,
            year: y,
            label: monthLabel,
            dispatched: dispatchesInMonth.length,
            returned: returnsInMonth.length,
            cleared: clearancesInMonth.length,
            avgDelay: parseFloat(avgDelayInMonth.toFixed(1)),
            avgFrs: parseFloat(avgFrsInMonth.toFixed(1))
        });
    }

    return {
        distributorId,
        distributorName,
        distributorRegion,
        overallScore,
        totalDispatches,
        totalReturns,
        totalClearances,
        managerReturnRate: parseFloat(managerReturnRate.toFixed(1)),
        avgCollectionDelay,
        avgFrsAtDispatch,
        systemAvgReturnRate,
        systemAvgCollectionDelay,
        systemAvgFrsAtDispatch,
        totalReturnsCount,
        totalClearancesCount,
        totalReturnsUnits,
        totalClearancesUnits,
        totalUnitsLost,
        performanceTrend,
        signals: {
            returnSignal,
            delaySignal,
            frsSignal,
            missSignal
        },
        health,
        healthColor,
        badge,
        plainEnglishSummary: summaryText,
        suggestedAction,
        actionSeverity,
        monthlyHistory
    };
};

module.exports = { buildRelationshipProfile };
