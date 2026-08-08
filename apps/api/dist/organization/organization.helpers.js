"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wouldCreateParentCycle = wouldCreateParentCycle;
exports.wouldCreateReportingCycle = wouldCreateReportingCycle;
exports.assertNoCycle = assertNoCycle;
exports.emptyToNull = emptyToNull;
exports.normalizeEmail = normalizeEmail;
const common_1 = require("@nestjs/common");
function wouldCreateParentCycle(nodeId, parentId, parentsById) {
    if (nodeId === parentId) {
        return true;
    }
    let current = parentId;
    const visited = new Set();
    while (current) {
        if (current === nodeId) {
            return true;
        }
        if (visited.has(current)) {
            return true;
        }
        visited.add(current);
        current = parentsById.get(current) ?? null;
    }
    return false;
}
function wouldCreateReportingCycle(employeeId, managerId, reportsToByEmployee) {
    if (employeeId === managerId) {
        return true;
    }
    const stack = [managerId];
    const visited = new Set();
    while (stack.length > 0) {
        const current = stack.pop();
        if (!current) {
            continue;
        }
        if (current === employeeId) {
            return true;
        }
        if (visited.has(current)) {
            continue;
        }
        visited.add(current);
        const managers = reportsToByEmployee.get(current) ?? [];
        for (const next of managers) {
            stack.push(next);
        }
    }
    return false;
}
function assertNoCycle(condition, message) {
    if (condition) {
        throw new common_1.BadRequestException(message);
    }
}
function emptyToNull(value) {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
}
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
//# sourceMappingURL=organization.helpers.js.map