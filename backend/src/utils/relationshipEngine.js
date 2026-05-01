/**
 * relationshipEngine.js
 * 
 * Refined logic to calculate distributor relationship metrics based on 
 * Return Rate, Collection Delay, and FRS at Dispatch.
 */

const buildRelationshipProfile = ({
    distributorId,
    distributorName,
    distributorRegion,
    managerDispatches,   // array of dispatch records
    managerReturns,      // array of return records
    systemAvgReturnRate, // for comparison
    systemAvgCollectionDelay,
    systemAvgFrsAtDispatch,
    overallScore         // from distributor_scorecards
}) => {
    // 1. BASIC METRICS
    const totalDispatches = managerDispatches.length;
    if (totalDispatches === 0) return null;

    const totalReturns = managerReturns.length;
    const managerReturnRate = (totalReturns / totalDispatches) * 100;

    // Collection Delay
    const collectedRecords = managerDispatches.filter(d => d.collected_at !== null);
    const avgCollectionDelay = collectedRecords.length > 0
        ? parseFloat((collectedRecords.reduce((sum, d) => sum + parseFloat(d.collection_delay_days || 0), 0) / collectedRecords.length).toFixed(1))
        : null;

    // FRS at Dispatch
    const avgFrsAtDispatch = parseFloat((managerDispatches.reduce((sum, d) => sum + parseInt(d.frs_at_dispatch || 0), 0) / totalDispatches).toFixed(1));

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

    // 3. OVERALL RELATIONSHIP HEALTH
    const poorWarningCount = [returnSignal, delaySignal, frsSignal].filter(s => s.signal === 'poor' || s.signal === 'warning').length;
    const poorCount = [returnSignal, delaySignal, frsSignal].filter(s => s.signal === 'poor').length;

    let health = 'Excellent';
    let healthColor = '#22c55e';
    let badge = '⭐ Top Partner';

    if (poorCount >= 2) {
        health = 'Poor';
        healthColor = '#ef4444';
        badge = '🚨 Requires Review';
    } else if (poorCount === 1 || poorWarningCount >= 2) {
        health = 'Fair';
        healthColor = '#f59e0b';
        badge = '⚠ Needs Attention';
    } else if (poorWarningCount === 1) {
        health = 'Good';
        healthColor = '#22c55e';
        badge = '✅ Performing Well';
    }

    // 4. PLAIN ENGLISH SUMMARY
    let summaryText = "";
    
    // Return Sentence
    if (totalReturns === 0) {
        summaryText = `${totalDispatches} batches were dispatched to ${distributorName} with zero returns recorded.`;
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
    } else if (health === 'Fair') {
        suggestedAction = "Monitor relationship metrics closely over the next period. Observe for any worsening trends.";
        actionSeverity = 'warning';
    }

    // Monthly History
    const now = new Date();
    const monthlyHistory = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const m = d.getMonth() + 1;
        const y = d.getFullYear();
        const monthLabel = d.toLocaleString('default', { month: 'short' });

        const dispatchesInMonth = managerDispatches.filter(disp => parseInt(disp.month) === m && parseInt(disp.year) === y);
        const returnsInMonth = managerReturns.filter(ret => parseInt(ret.month) === m && parseInt(ret.year) === y);
        
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
        managerReturnRate: parseFloat(managerReturnRate.toFixed(1)),
        avgCollectionDelay,
        avgFrsAtDispatch,
        systemAvgReturnRate,
        systemAvgCollectionDelay,
        systemAvgFrsAtDispatch,
        signals: {
            returnSignal,
            delaySignal,
            frsSignal
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
