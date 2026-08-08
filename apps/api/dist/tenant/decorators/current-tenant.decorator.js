"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentTenant = void 0;
const common_1 = require("@nestjs/common");
exports.CurrentTenant = (0, common_1.createParamDecorator)((_data, context) => {
    const request = context.switchToHttp().getRequest();
    if (!request.tenantContext) {
        throw new common_1.ForbiddenException('Tenant context is required');
    }
    return request.tenantContext;
});
//# sourceMappingURL=current-tenant.decorator.js.map