"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APP_NAME = void 0;
exports.createHealthResponse = createHealthResponse;
exports.APP_NAME = 'talento-sin-clave';
function createHealthResponse() {
    return { status: 'ok' };
}
