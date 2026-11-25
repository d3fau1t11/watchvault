const transferableFields = ["title", "type", "status", "manualStatus", "tmdbId", "poster", "year", "genres", "category", "season", "episode", "rating", "review", "notes", "tags"];

export function createVaultExport(items) {
    return {
        version: 2,
        exportedAt: new Date().toISOString(),
        total: items.length,
        items: items.map(item => ({
            ...Object.fromEntries(transferableFields.filter(field => item[field] !== undefined).map(field => [field, item[field]])),
            addedAt: item.createdAt?.toDate ? item.createdAt.toDate().toISOString() : null
        }))
    };
}

export function importedCuration(item) {
    const details = {};
    if (typeof item.manualStatus === "boolean") details.manualStatus = item.manualStatus;
    ["season", "episode", "year"].forEach(field => {
        if (Number.isInteger(item[field]) && item[field] >= 0) details[field] = item[field];
    });
    if (typeof item.rating === "number" && item.rating >= 0 && item.rating <= 10) details.rating = item.rating;
    ["review", "notes", "category"].forEach(field => {
        if (typeof item[field] === "string") details[field] = item[field];
    });
    ["tags", "genres"].forEach(field => {
        if (Array.isArray(item[field])) details[field] = item[field].filter(value => typeof value === "string");
    });
    return details;
}
