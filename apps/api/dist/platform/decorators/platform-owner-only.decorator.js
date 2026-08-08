"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformOwnerOnly = exports.PLATFORM_OWNER_ONLY_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.PLATFORM_OWNER_ONLY_KEY = 'platform_owner_only';
const PlatformOwnerOnly = () => (0, common_1.SetMetadata)(exports.PLATFORM_OWNER_ONLY_KEY, true);
exports.PlatformOwnerOnly = PlatformOwnerOnly;
//# sourceMappingURL=platform-owner-only.decorator.js.map