/**
 * Categorises a single batch based on the specific root cause logic.
 * @param {Object} batch
 * @returns {Object} { category, icon, color }
 */
const categoriseBatch = (batch) => {
    // 1. Temperature-Driven
    if (batch.total_temp_breach_windows > 3) {
        return {
            category: 'Temperature-Driven',
            icon: '🌡',
            color: '#ef4444' // red
        };
    }

    // 2. Long Storage
    if (batch.days_in_warehouse > 120 && batch.total_temp_breach_windows <= 3) {
        return {
            category: 'Long Storage',
            icon: '📦',
            color: '#f59e0b' // amber
        };
    }

    // 3. Distributor Delay
    if (batch.collected_at && batch.dispatched_at) {
        const collectedDate = new Date(batch.collected_at);
        const dispatchedDate = new Date(batch.dispatched_at);
        const diffTime = Math.abs(collectedDate - dispatchedDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 14) {
            return {
                category: 'Distributor Delay',
                icon: '🚛',
                color: '#8b5cf6' // purple
            };
        }
    }

    // 4. Market Saturation
    if (batch.market_saturation_score !== null && batch.market_saturation_score !== undefined && batch.market_saturation_score < 1.5) {
        return {
            category: 'Market Saturation',
            icon: '📉',
            color: '#8b5cf6' // purple
        };
    }

    // 4. Unclassified
    return {
        category: 'Unclassified',
        icon: '❓',
        color: '#94a3b8' // grey
    };
};

/**
 * Detects patterns in an array of categorised batches.
 * @param {Array} categorisedBatches - Array of batches that have been categorised
 * @returns {Array} Array of pattern objects
 */
const detectPatterns = (categorisedBatches) => {
    const patterns = [];

    // Group by category
    const categories = {
        'Temperature-Driven': [],
        'Long Storage': [],
        'Distributor Delay': [],
        'Market Saturation': [],
        'Unclassified': []
    };

    categorisedBatches.forEach(batch => {
        if (categories[batch.category]) {
            categories[batch.category].push(batch);
        }
    });

    // 1. Pattern Detection for TEMPERATURE-DRIVEN
    const tempBatches = categories['Temperature-Driven'];
    if (tempBatches.length > 0) {
        let patternDetected = false;
        let patternText = "No recurring pattern this month";
        let suggestedAction = getSuggestedAction('Temperature-Driven');
        
        // Group by zone
        const zoneCounts = {};
        tempBatches.forEach(b => {
            zoneCounts[b.zone] = (zoneCounts[b.zone] || 0) + 1;
        });

        let mostFailedZone = null;
        let mostFailedZoneCount = 0;
        for (const [zone, count] of Object.entries(zoneCounts)) {
            if (count > mostFailedZoneCount) {
                mostFailedZoneCount = count;
                mostFailedZone = zone;
            }
        }

        // Group by day of week dispatched (0 = Sunday, 1 = Monday, etc.)
        const dayCounts = {};
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        tempBatches.forEach(b => {
            if (b.dispatch_day_of_week !== undefined && b.dispatch_day_of_week !== null) {
                dayCounts[b.dispatch_day_of_week] = (dayCounts[b.dispatch_day_of_week] || 0) + 1;
            }
        });

        let mostFailedDayIdx = null;
        let mostFailedDayCount = 0;
        for (const [dayIdx, count] of Object.entries(dayCounts)) {
            if (count > mostFailedDayCount) {
                mostFailedDayCount = count;
                mostFailedDayIdx = parseInt(dayIdx);
            }
        }

        if (mostFailedZoneCount >= 3) {
            patternDetected = true;
            patternText = `Zone ${mostFailedZone} appears in ${mostFailedZoneCount} of your ${tempBatches.length} temperature failures this month.`;
            suggestedAction = getSuggestedAction('Temperature-Driven', { zoneName: mostFailedZone });
        } else if (mostFailedDayCount >= (tempBatches.length / 2) && tempBatches.length >= 2) {
            patternDetected = true;
            const dayName = daysOfWeek[mostFailedDayIdx];
            patternText = `You dispatched ${mostFailedDayCount} of these on ${dayName} — consider checking Zone cooling before ${dayName} dispatches.`;
        }

        const tempSkuCounts = {};
        tempBatches.forEach(b => {
            if (!tempSkuCounts[b.sku]) tempSkuCounts[b.sku] = { sku: b.sku, productName: b.productName, count: 0 };
            tempSkuCounts[b.sku].count++;
        });

        patterns.push({
            category: 'Temperature-Driven',
            icon: '🌡',
            color: '#ef4444',
            count: tempBatches.length,
            batches: tempBatches,
            patternDetected,
            patternText,
            suggestedAction,
            affectedSkus: Object.values(tempSkuCounts),
            affectedZones: [...new Set(tempBatches.map(b => b.zone))]
        });
    }

    // 2. Pattern Detection for LONG STORAGE
    const longStorageBatches = categories['Long Storage'];
    if (longStorageBatches.length > 0) {
        let patternDetected = false;
        let patternText = "No recurring pattern this month";
        let suggestedAction = getSuggestedAction('Long Storage');

        // Group by SKU
        const skuData = {};
        longStorageBatches.forEach(b => {
            if (!skuData[b.productName]) {
                skuData[b.productName] = { count: 0, totalDays: 0 };
            }
            skuData[b.productName].count += 1;
            skuData[b.productName].totalDays += parseInt(b.days_in_warehouse) || 0;
        });

        let mostFailedSku = null;
        let mostFailedSkuCount = 0;
        let avgDaysHeld = 0;

        for (const [sku, data] of Object.entries(skuData)) {
            if (data.count > mostFailedSkuCount) {
                mostFailedSkuCount = data.count;
                mostFailedSku = sku;
                avgDaysHeld = Math.round(data.totalDays / data.count);
            }
        }

        if (mostFailedSkuCount > 0) {
            patternDetected = true;
            patternText = `You held ${mostFailedSku} an average of ${avgDaysHeld} days — longest held SKU in your dispatches this month.`;
            suggestedAction = getSuggestedAction('Long Storage', { sku: mostFailedSku });
        }

        const lsSkuCounts = {};
        longStorageBatches.forEach(b => {
            if (!lsSkuCounts[b.sku]) lsSkuCounts[b.sku] = { sku: b.sku, productName: b.productName, count: 0 };
            lsSkuCounts[b.sku].count++;
        });

        patterns.push({
            category: 'Long Storage',
            icon: '📦',
            color: '#f59e0b',
            count: longStorageBatches.length,
            batches: longStorageBatches,
            patternDetected,
            patternText,
            suggestedAction,
            affectedSkus: Object.values(lsSkuCounts),
            affectedZones: [...new Set(longStorageBatches.map(b => b.zone))]
        });
    }

    // 3. Pattern Detection for DISTRIBUTOR DELAY
    const delayBatches = categories['Distributor Delay'];
    if (delayBatches.length > 0) {
        let patternDetected = false;
        let patternText = "No recurring pattern this month";
        let suggestedAction = getSuggestedAction('Distributor Delay');

        // Group by distributor
        const distCounts = {};
        delayBatches.forEach(b => {
            if (b.distributor_name) {
                distCounts[b.distributor_name] = (distCounts[b.distributor_name] || 0) + 1;
            }
        });

        let mostDelayedDist = null;
        let mostDelayedCount = 0;
        for (const [dist, count] of Object.entries(distCounts)) {
            if (count > mostDelayedCount) {
                mostDelayedCount = count;
                mostDelayedDist = dist;
            }
        }

        if (mostDelayedCount >= 2) {
            patternDetected = true;
            patternText = `This is a recurring issue where ${mostDelayedDist} exceeded the 14-day collection window in your dispatches.`;
            suggestedAction = getSuggestedAction('Distributor Delay', { distributorName: mostDelayedDist });
        }

        const ddSkuCounts = {};
        delayBatches.forEach(b => {
            if (!ddSkuCounts[b.sku]) ddSkuCounts[b.sku] = { sku: b.sku, productName: b.productName, count: 0 };
            ddSkuCounts[b.sku].count++;
        });

        patterns.push({
            category: 'Distributor Delay',
            icon: '🚛',
            color: '#8b5cf6',
            count: delayBatches.length,
            batches: delayBatches,
            patternDetected,
            patternText,
            suggestedAction,
            affectedSkus: Object.values(ddSkuCounts),
            affectedZones: [...new Set(delayBatches.map(b => b.zone))]
        });
    }

    // 4. Pattern Detection for MARKET SATURATION
    const satBatches = categories['Market Saturation'];
    if (satBatches && satBatches.length > 0) {
        let patternDetected = true; // By definition, it's a pattern if it fires
        
        // Group by product & region
        let mostAffectedSku = null;
        let mostAffectedRegion = null;
        if (satBatches.length > 0) {
            mostAffectedSku = satBatches[0].productName;
            mostAffectedRegion = satBatches[0].distributorRegion || 'the region';
        }

        let patternText = `Field reports show ${mostAffectedSku} is moving slowly in ${mostAffectedRegion}. The warehouse risk may be driven by low market demand, not just storage conditions.`;
        let suggestedAction = `Consider redirecting this SKU to a region where sales rep reports show faster movement before dispatch. Check the Market Pulse dashboard for regional demand data.`;

        const satSkuCounts = {};
        satBatches.forEach(b => {
            if (!satSkuCounts[b.sku]) satSkuCounts[b.sku] = { sku: b.sku, productName: b.productName, count: 0 };
            satSkuCounts[b.sku].count++;
        });

        patterns.push({
            category: 'Market Saturation',
            icon: '📉',
            color: '#8b5cf6',
            count: satBatches.length,
            batches: satBatches,
            patternDetected,
            patternText,
            suggestedAction,
            affectedSkus: Object.values(satSkuCounts),
            affectedZones: [...new Set(satBatches.map(b => b.zone))]
        });
    }

    // 5. Unclassified
    const unclassifiedBatches = categories['Unclassified'];
    if (unclassifiedBatches && unclassifiedBatches.length > 0) {
        const ucSkuCounts = {};
        unclassifiedBatches.forEach(b => {
            if (!ucSkuCounts[b.sku]) ucSkuCounts[b.sku] = { sku: b.sku, productName: b.productName, count: 0 };
            ucSkuCounts[b.sku].count++;
        });

        patterns.push({
            category: 'Unclassified',
            icon: '❓',
            color: '#94a3b8',
            count: unclassifiedBatches.length,
            batches: unclassifiedBatches,
            patternDetected: false,
            patternText: "No recurring pattern this month",
            suggestedAction: getSuggestedAction('Unclassified'),
            affectedSkus: Object.values(ucSkuCounts),
            affectedZones: [...new Set(unclassifiedBatches.map(b => b.zone))]
        });
    }

    return patterns;
};

/**
 * Returns suggested action text based on category and dynamic values.
 * @param {string} category 
 * @param {Object} context 
 * @returns {string}
 */
const getSuggestedAction = (category, context = {}) => {
    switch (category) {
        case 'Temperature-Driven':
            if (!context.zoneName || context.zoneName === 'undefined' || context.zoneName === 'null') {
                return `Review cooling logs for the zone where these batches were stored.`;
            }
            return `Review Zone ${context.zoneName} cooling logs — particularly nights before your mid-week dispatches.`;
        case 'Long Storage':
            return `Increase dispatch frequency for ${context.sku || 'this product'} — consider prioritising it in your next dispatch queue.`;
        case 'Distributor Delay':
            return `Flag ${context.distributorName || 'this distributor'} collection performance — this is a recurring pattern in your dispatch history.`;
        case 'Unclassified':
            return 'Review these batches manually — no clear pattern identified.';
        default:
            return '';
    }
};

module.exports = {
    categoriseBatch,
    detectPatterns,
    getSuggestedAction
};
